import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../auth.js';
import { findUserById, toPublicUser } from '../users/repository.js';
import { listAcceptedPeople } from '../connections/repository.js';
import { getPresenceSnapshot } from '../../realtime/presence.js';
import { getPermissions } from '../privacy/repository.js';

export const spaceRouter = Router();
spaceRouter.use(requireAuth);

spaceRouter.get('/', async (req: AuthRequest, res) => {
  const self = await findUserById(req.userId!);
  if (!self) return res.status(404).json({ error: 'User not found' });
  const accepted = await listAcceptedPeople(req.userId!);
  const people = await Promise.all(accepted.map(async person => {
    const permissions = await getPermissions(person.id, req.userId!);
    const presence = (permissions.sharePresence || permissions.shareLastSeen) ? await getPresenceSnapshot(person.id) : { connectionState: null, lastSeenAt: null };
    return {
      ...person,
      humanStatus: permissions.shareStatus ? person.humanStatus : null,
      customStatus: permissions.shareStatus ? person.customStatus : null,
      statusExpiresAt: permissions.shareStatus ? person.statusExpiresAt : null,
      connectionState: permissions.sharePresence ? presence.connectionState : null,
      lastSeenAt: permissions.shareLastSeen ? presence.lastSeenAt : null,
      visibility: permissions,
    };
  }));
  res.json({ self: { ...toPublicUser(self), ...(await getPresenceSnapshot(req.userId!)) }, people });
});
