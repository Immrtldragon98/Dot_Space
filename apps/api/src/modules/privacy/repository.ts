import { db } from '../../db/pool.js';

export type PrivacyPermissions = {
  sharePresence: boolean;
  shareStatus: boolean;
  shareLastSeen: boolean;
  allowSignals: boolean;
};

const DEFAULTS: PrivacyPermissions = {
  sharePresence: true,
  shareStatus: false,
  shareLastSeen: false,
  allowSignals: true,
};

export async function areAccepted(ownerId: string, viewerId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM connections
     WHERE ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1))
       AND status='ACCEPTED' LIMIT 1`,
    [ownerId, viewerId]
  );
  return result.rowCount === 1;
}

export async function getPermissions(ownerId: string, viewerId: string): Promise<PrivacyPermissions> {
  const result = await db.query<{share_presence:boolean;share_status:boolean;share_last_seen:boolean;allow_signals:boolean}>(
    `SELECT share_presence, share_status, share_last_seen, allow_signals
     FROM privacy_permissions WHERE owner_id=$1 AND viewer_id=$2`, [ownerId, viewerId]);
  const row = result.rows[0];
  return row ? {sharePresence:row.share_presence,shareStatus:row.share_status,shareLastSeen:row.share_last_seen,allowSignals:row.allow_signals} : DEFAULTS;
}

export async function upsertPermissions(ownerId: string, viewerId: string, p: PrivacyPermissions): Promise<PrivacyPermissions> {
  const result = await db.query<{share_presence:boolean;share_status:boolean;share_last_seen:boolean;allow_signals:boolean}>(
    `INSERT INTO privacy_permissions(owner_id, viewer_id, share_presence, share_status, share_last_seen, allow_signals)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (owner_id, viewer_id) DO UPDATE SET
       share_presence=EXCLUDED.share_presence, share_status=EXCLUDED.share_status,
       share_last_seen=EXCLUDED.share_last_seen, allow_signals=EXCLUDED.allow_signals, updated_at=now()
     RETURNING share_presence, share_status, share_last_seen, allow_signals`,
    [ownerId, viewerId, p.sharePresence, p.shareStatus, p.shareLastSeen, p.allowSignals]);
  const row=result.rows[0];
  return {sharePresence:row.share_presence,shareStatus:row.share_status,shareLastSeen:row.share_last_seen,allowSignals:row.allow_signals};
}

export async function viewersAllowed(ownerId: string, field: 'presence'|'status'|'lastSeen'): Promise<string[]> {
  const result = await db.query<{viewer_id:string}>(
    `SELECT CASE WHEN c.requester_id=$1 THEN c.addressee_id ELSE c.requester_id END AS viewer_id
     FROM connections c
     LEFT JOIN privacy_permissions p ON p.owner_id=$1 AND p.viewer_id=CASE WHEN c.requester_id=$1 THEN c.addressee_id ELSE c.requester_id END
     WHERE (c.requester_id=$1 OR c.addressee_id=$1) AND c.status='ACCEPTED'
       AND CASE WHEN $2='presence' THEN COALESCE(p.share_presence, TRUE)
                WHEN $2='status' THEN COALESCE(p.share_status, FALSE)
                WHEN $2='lastSeen' THEN COALESCE(p.share_last_seen, FALSE)
                ELSE FALSE END`, [ownerId, field]);
  return result.rows.map(r=>r.viewer_id);
}
