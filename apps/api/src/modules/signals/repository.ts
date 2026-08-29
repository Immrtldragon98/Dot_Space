import { db } from '../../db/pool.js';

export type SignalKind = 'THINKING_OF_YOU' | 'AROUND' | 'WAVE';

export type SignalRecord = {
  id: string;
  senderId: string;
  recipientId: string;
  kind: SignalKind;
  createdAt: string;
  acknowledgedAt: string | null;
};

type SignalRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  kind: SignalKind;
  created_at: string;
  acknowledged_at: string | null;
};

function map(row: SignalRow): SignalRecord {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    kind: row.kind,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
  };
}

export async function createSignal(senderId: string, recipientId: string, kind: SignalKind): Promise<SignalRecord> {
  const result = await db.query<SignalRow>(
    `INSERT INTO signals(sender_id, recipient_id, kind)
     VALUES ($1,$2,$3)
     RETURNING id, sender_id, recipient_id, kind, created_at, acknowledged_at`,
    [senderId, recipientId, kind]
  );
  return map(result.rows[0]);
}

export async function getSignal(id: string): Promise<SignalRecord | null> {
  const result = await db.query<SignalRow>(
    `SELECT id, sender_id, recipient_id, kind, created_at, acknowledged_at
     FROM signals WHERE id=$1`, [id]
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}

export async function acknowledgeSignal(id: string, recipientId: string): Promise<SignalRecord | null> {
  const result = await db.query<SignalRow>(
    `UPDATE signals
       SET acknowledged_at = COALESCE(acknowledged_at, now())
     WHERE id=$1 AND recipient_id=$2
     RETURNING id, sender_id, recipient_id, kind, created_at, acknowledged_at`,
    [id, recipientId]
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}

export async function listInbox(userId: string, limit = 30) {
  const result = await db.query<SignalRow & { sender_display_name: string }>(
    `SELECT s.id, s.sender_id, s.recipient_id, s.kind, s.created_at, s.acknowledged_at,
            u.display_name AS sender_display_name
       FROM signals s
       JOIN users u ON u.id=s.sender_id
      WHERE s.recipient_id=$1
      ORDER BY s.created_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(row => ({ ...map(row), senderDisplayName: row.sender_display_name }));
}
