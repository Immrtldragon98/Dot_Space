import { db } from '../../db/pool.js';

export type DeviceSession = {
  id:string; userId:string; deviceId:string|null; deviceName:string|null; platform:string|null;
  pushToken:string|null; notificationsEnabled:boolean; createdAt:string; lastSeenAt:string; revokedAt:string|null;
};

function map(r:any):DeviceSession{return {id:r.id,userId:r.user_id,deviceId:r.device_id,deviceName:r.device_name,platform:r.platform,pushToken:r.push_token,notificationsEnabled:r.notifications_enabled,createdAt:r.created_at,lastSeenAt:r.last_seen_at,revokedAt:r.revoked_at};}
export async function createSession(userId:string){const r=await db.query(`INSERT INTO device_sessions(user_id) VALUES($1) RETURNING *`,[userId]);return map(r.rows[0]);}
export async function isSessionActive(id:string,userId:string){const r=await db.query(`SELECT 1 FROM device_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,[id,userId]);return r.rowCount===1;}
export async function touchSession(id:string,userId:string){await db.query(`UPDATE device_sessions SET last_seen_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,[id,userId]);}
export async function registerDevice(sessionId:string,userId:string,input:{deviceId:string;deviceName?:string|null;platform?:string|null;pushToken?:string|null}){if(input.pushToken)await db.query(`UPDATE device_sessions SET push_token=NULL,notifications_enabled=FALSE WHERE push_token=$1 AND id<>$2`,[input.pushToken,sessionId]);const r=await db.query(`UPDATE device_sessions SET device_id=$3,device_name=$4,platform=$5,push_token=$6,notifications_enabled=COALESCE($6,'') <> '',last_seen_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING *`,[sessionId,userId,input.deviceId,input.deviceName??null,input.platform??null,input.pushToken??null]);return r.rows[0]?map(r.rows[0]):null;}
export async function listSessions(userId:string){const r=await db.query(`SELECT * FROM device_sessions WHERE user_id=$1 ORDER BY revoked_at NULLS FIRST,last_seen_at DESC`,[userId]);return r.rows.map(map);}
export async function revokeSession(userId:string,sessionId:string){const r=await db.query(`UPDATE device_sessions SET revoked_at=now(),push_token=NULL,notifications_enabled=FALSE WHERE user_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id`,[userId,sessionId]);return r.rowCount===1;}
export async function activePushTokens(userId:string){const r=await db.query<{push_token:string}>(`SELECT DISTINCT push_token FROM device_sessions WHERE user_id=$1 AND revoked_at IS NULL AND notifications_enabled=TRUE AND push_token IS NOT NULL`,[userId]);return r.rows.map(x=>x.push_token);}
