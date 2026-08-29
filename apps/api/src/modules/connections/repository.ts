import { db } from '../../db/pool.js';
import type { HumanStatus } from '../../types.js';

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  acted_by: string | null;
  created_at: string;
  updated_at: string;
};

type PersonRow = {
  id: string;
  display_name: string;
  email: string;
  human_status: HumanStatus;
  custom_status: string | null;
  status_expires_at: string | null;
};

export async function createConnection(requesterId: string, addresseeId: string) {
  const result = await db.query<ConnectionRow>(
    `INSERT INTO connections(requester_id, addressee_id)
     VALUES ($1,$2)
     ON CONFLICT (user_low_id, user_high_id) DO UPDATE
       SET requester_id = CASE WHEN connections.status = 'REJECTED' THEN EXCLUDED.requester_id ELSE connections.requester_id END,
           addressee_id = CASE WHEN connections.status = 'REJECTED' THEN EXCLUDED.addressee_id ELSE connections.addressee_id END,
           status = CASE WHEN connections.status = 'REJECTED' THEN 'PENDING' ELSE connections.status END,
           acted_by = CASE WHEN connections.status = 'REJECTED' THEN NULL ELSE connections.acted_by END,
           updated_at = CASE WHEN connections.status = 'REJECTED' THEN now() ELSE connections.updated_at END
     RETURNING *`,
    [requesterId, addresseeId]
  );
  return result.rows[0];
}

export async function getConnection(id: string) {
  const result = await db.query<ConnectionRow>('SELECT * FROM connections WHERE id=$1', [id]);
  return result.rows[0] ?? null;
}

export async function setConnectionStatus(id: string, status: ConnectionStatus, actedBy: string) {
  const result = await db.query<ConnectionRow>(
    `UPDATE connections SET status=$2, acted_by=$3, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, status, actedBy]
  );
  return result.rows[0] ?? null;
}

export async function listConnectionRequests(userId: string) {
  const result = await db.query<ConnectionRow & PersonRow & { direction: 'INCOMING' | 'OUTGOING' }>(
    `SELECT c.id AS connection_id, c.requester_id, c.addressee_id, c.status, c.acted_by, c.created_at, c.updated_at,
       CASE WHEN c.addressee_id=$1 THEN 'INCOMING' ELSE 'OUTGOING' END AS direction,
       u.id AS person_id, u.display_name, u.email, u.human_status, u.custom_status, u.status_expires_at
     FROM connections c
     JOIN users u ON u.id = CASE WHEN c.requester_id=$1 THEN c.addressee_id ELSE c.requester_id END
     WHERE (c.requester_id=$1 OR c.addressee_id=$1) AND c.status='PENDING'
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return result.rows.map(r => ({
    connectionId: (r as any).connection_id,
    direction: r.direction,
    person: { id: (r as any).person_id, displayName: r.display_name, email: r.email, humanStatus: r.human_status, customStatus: r.custom_status, statusExpiresAt: r.status_expires_at },
  }));
}

export async function listAcceptedPeople(userId: string) {
  const result = await db.query<PersonRow & { connection_id: string }>(
    `SELECT u.id, u.display_name, u.email, u.human_status, u.custom_status, u.status_expires_at, c.id AS connection_id
     FROM connections c
     JOIN users u ON u.id = CASE WHEN c.requester_id=$1 THEN c.addressee_id ELSE c.requester_id END
     WHERE (c.requester_id=$1 OR c.addressee_id=$1) AND c.status='ACCEPTED'
     ORDER BY lower(u.display_name), u.id`,
    [userId]
  );
  return result.rows.map(r => ({
    connectionId: r.connection_id,
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    humanStatus: r.human_status,
    customStatus: r.custom_status,
    statusExpiresAt: r.status_expires_at,
    connectionState: 'OFFLINE' as const,
  }));
}
