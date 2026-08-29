import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/pool.js';
import { redis } from './redis.js';
import type { ConnectionState, HumanStatus } from '../types.js';
import { getPermissions, viewersAllowed } from '../modules/privacy/repository.js';
import { clearExpiredStatuses, toPublicUser } from '../modules/users/repository.js';
import { isSessionActive } from '../modules/devices/repository.js';

type LiveState = Exclude<ConnectionState, 'OFFLINE'>;
type DevicePresence = {
  socketId: string;
  deviceId: string;
  state: LiveState;
  connectedAt: number;
  updatedAt: number;
};

const DEVICE_TTL_SECONDS = config.presenceTtlSeconds;
const SWEEP_INTERVAL_MS = config.presenceSweepMs;
const deviceKey = (userId: string, deviceId: string) => `presence:device:${userId}:${deviceId}`;
const devicesKey = (userId: string) => `presence:user:${userId}:devices`;
const lastSeenKey = (userId: string) => `presence:user:${userId}:last-seen`;
const aggregateKey = (userId: string) => `presence:user:${userId}:aggregate`;
const ONLINE_USERS_KEY = 'presence:online-users';
let ioRef: Server | null = null;
let sweepTimer: NodeJS.Timeout | null = null;

async function acceptedPersonIds(userId: string): Promise<string[]> {
  const result = await db.query<{ person_id: string }>(
    `SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END AS person_id
     FROM connections
     WHERE (requester_id=$1 OR addressee_id=$1) AND status='ACCEPTED'`,
    [userId]
  );
  return result.rows.map(r => r.person_id);
}

async function readDevices(userId: string): Promise<DevicePresence[]> {
  const ids = await redis.sMembers(devicesKey(userId));
  if (!ids.length) return [];
  const keys = ids.map(id => deviceKey(userId, id));
  const values = await redis.mGet(keys);
  const stale: string[] = [];
  const devices: DevicePresence[] = [];
  values.forEach((value, index) => {
    if (!value) { stale.push(ids[index]); return; }
    try { devices.push(JSON.parse(value) as DevicePresence); }
    catch { stale.push(ids[index]); }
  });
  if (stale.length) await redis.sRem(devicesKey(userId), stale);
  return devices;
}

function aggregate(devices: DevicePresence[]): ConnectionState {
  if (!devices.length) return 'OFFLINE';
  const states = devices.map(d => d.state);
  if (states.includes('ACTIVE')) return 'ACTIVE';
  if (states.includes('IDLE')) return 'IDLE';
  return 'BACKGROUND';
}

async function emitPresence(userId: string, force = false) {
  if (!ioRef) return;
  const devices = await readDevices(userId);
  const connectionState = aggregate(devices);
  const previous = await redis.get(aggregateKey(userId));
  if (!force && previous === connectionState) return;

  await redis.set(aggregateKey(userId), connectionState);
  if (connectionState === 'OFFLINE') {
    const lastSeen = Date.now();
    await redis.set(lastSeenKey(userId), String(lastSeen));
    await redis.sRem(ONLINE_USERS_KEY, userId);
    await redis.del(devicesKey(userId));
  } else {
    await redis.sAdd(ONLINE_USERS_KEY, userId);
  }

  const rawLastSeen = await redis.get(lastSeenKey(userId));
  const lastSeenAt = rawLastSeen ? Number(rawLastSeen) : null;
  const [presenceViewers, lastSeenViewers] = await Promise.all([viewersAllowed(userId, 'presence'), viewersAllowed(userId, 'lastSeen')]);
  const personIds = [...new Set([...presenceViewers, ...lastSeenViewers])];
  await Promise.all(personIds.map(async viewerId => {
    const permissions = await getPermissions(userId, viewerId);
    ioRef!.to(`user:${viewerId}`).emit('presence:changed', {
      userId,
      connectionState,
      lastSeenAt: permissions.shareLastSeen ? lastSeenAt : null,
    });
  }));
}

async function writeDevice(userId: string, device: DevicePresence) {
  await Promise.all([
    redis.set(deviceKey(userId, device.deviceId), JSON.stringify(device), { EX: DEVICE_TTL_SECONDS }),
    redis.sAdd(devicesKey(userId), device.deviceId),
    redis.sAdd(ONLINE_USERS_KEY, userId),
  ]);
}

export async function getPresenceSnapshot(userId: string): Promise<{ connectionState: ConnectionState; lastSeenAt: number | null }> {
  const connectionState = aggregate(await readDevices(userId));
  const rawLastSeen = await redis.get(lastSeenKey(userId));
  return { connectionState, lastSeenAt: rawLastSeen ? Number(rawLastSeen) : null };
}

export async function notifyHumanStatusChanged(userId: string, humanStatus: HumanStatus, customStatus: string | null, statusExpiresAt: string | null = null) {
  if (!ioRef) return;
  const personIds = await viewersAllowed(userId, 'status');
  ioRef.to(personIds.map(id => `user:${id}`)).emit('status:changed', { userId, humanStatus, customStatus, statusExpiresAt });
}

export function revokeSessionRealtime(sessionId:string){if(!ioRef)return;ioRef.in(`session:${sessionId}`).disconnectSockets(true);}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!ioRef) return;
  ioRef.to(`user:${userId}`).emit(event, payload);
}

export function notifyPrivacyChanged(ownerId: string, viewerId: string) {
  if (!ioRef) return;
  ioRef.to(`user:${viewerId}`).emit('privacy:changed', { userId: ownerId });
}

async function sweepExpiredStatuses() {
  const expired = await clearExpiredStatuses();
  await Promise.all(expired.map(async user => {
    const publicUser = toPublicUser(user);
    await notifyHumanStatusChanged(user.id, publicUser.humanStatus, publicUser.customStatus, publicUser.statusExpiresAt);
  }));
}

async function sweepExpiredPresence() {
  const users = await redis.sMembers(ONLINE_USERS_KEY);
  await Promise.all(users.map(userId => emitPresence(userId)));
}

export function installPresenceRealtime(io: Server) {
  ioRef = io;
  if (!sweepTimer) {
    sweepTimer = setInterval(() => {
      Promise.all([sweepExpiredPresence(), sweepExpiredStatuses()]).catch(error => console.error('[presence:sweep]', error));
    }, SWEEP_INTERVAL_MS);
    sweepTimer.unref();
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Missing token');
      const payload = jwt.verify(token, config.jwtSecret);
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('Invalid token');
      if (!(await isSessionActive(payload.sid, payload.sub))) throw new Error('Revoked session');
      socket.data.userId = payload.sub;
      socket.data.sessionId = payload.sid;
      socket.data.deviceId = typeof socket.handshake.auth?.deviceId === 'string' ? socket.handshake.auth.deviceId : socket.id;
      next();
    } catch { next(new Error('Authentication failed')); }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const deviceId = socket.data.deviceId as string;
    const sessionId = socket.data.sessionId as string;
    socket.join(`user:${userId}`);
    socket.join(`session:${sessionId}`);
    const now = Date.now();
    await writeDevice(userId, { socketId: socket.id, deviceId, state: 'ACTIVE', connectedAt: now, updatedAt: now });
    await emitPresence(userId, true);

    socket.on('presence:heartbeat', async (payload: { state?: ConnectionState }) => {
      const nextState = payload?.state;
      if (nextState !== 'ACTIVE' && nextState !== 'IDLE' && nextState !== 'BACKGROUND') return;
      const currentRaw = await redis.get(deviceKey(userId, deviceId));
      const current: DevicePresence = currentRaw ? JSON.parse(currentRaw) : { socketId: socket.id, deviceId, state: nextState, connectedAt: Date.now(), updatedAt: Date.now() };
      current.socketId = socket.id;
      current.state = nextState;
      current.updatedAt = Date.now();
      await writeDevice(userId, current);
      await emitPresence(userId);
    });

    socket.on('presence:set', async (payload: { state?: ConnectionState }) => {
      const nextState = payload?.state;
      if (nextState !== 'ACTIVE' && nextState !== 'IDLE' && nextState !== 'BACKGROUND') return;
      const currentRaw = await redis.get(deviceKey(userId, deviceId));
      const current: DevicePresence = currentRaw ? JSON.parse(currentRaw) : { socketId: socket.id, deviceId, state: nextState, connectedAt: Date.now(), updatedAt: Date.now() };
      current.socketId = socket.id;
      current.state = nextState;
      current.updatedAt = Date.now();
      await writeDevice(userId, current);
      await emitPresence(userId);
    });

    socket.on('disconnect', async () => {
      const key = deviceKey(userId, deviceId);
      const currentRaw = await redis.get(key);
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw) as DevicePresence;
          if (current.socketId === socket.id) {
            await redis.del(key);
            await redis.sRem(devicesKey(userId), deviceId);
          }
        } catch { }
      }
      await emitPresence(userId, true);
    });
  });
}
