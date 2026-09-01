import { db } from '../../db/pool.js';
import type { HumanStatus, PublicUser } from '../../types.js';

type DbUser = {
  id: string; email: string; display_name: string; password_hash: string;
  human_status: HumanStatus; custom_status: string | null; status_expires_at: string | null;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const result = await db.query<DbUser>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0] ?? null;
}

export async function findDisplayNameById(id: string): Promise<string | null> {
  const result = await db.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [id]);
  return result.rows[0]?.display_name ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const result = await db.query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function createUser(email: string, displayName: string, passwordHash: string): Promise<DbUser> {
  const result = await db.query<DbUser>(
    `INSERT INTO users(email, display_name, password_hash)
     VALUES ($1, $2, $3) RETURNING *`,
    [email.toLowerCase(), displayName, passwordHash]
  );
  return result.rows[0];
}

export async function updateHumanStatus(id: string, humanStatus: HumanStatus, customStatus: string | null, statusExpiresAt: Date | null): Promise<DbUser> {
  const result = await db.query<DbUser>(
    `UPDATE users SET human_status=$2, custom_status=$3, status_expires_at=$4, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, humanStatus, customStatus, statusExpiresAt]
  );
  return result.rows[0];
}

export async function clearExpiredStatuses(): Promise<DbUser[]> {
  const result = await db.query<DbUser>(
    `UPDATE users
       SET human_status='AVAILABLE', custom_status=NULL, status_expires_at=NULL, updated_at=now()
     WHERE status_expires_at IS NOT NULL AND status_expires_at <= now()
     RETURNING *`
  );
  return result.rows;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM users WHERE id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export function toPublicUser(user: DbUser): PublicUser {
  return { id: user.id, email: user.email, displayName: user.display_name, humanStatus: user.human_status, customStatus: user.custom_status, statusExpiresAt: user.status_expires_at };
}
