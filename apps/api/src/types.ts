export type ConnectionState = 'ACTIVE' | 'IDLE' | 'BACKGROUND' | 'OFFLINE';
export type HumanStatus = 'AVAILABLE' | 'QUIET' | 'BUSY' | 'SLEEPING' | 'TRAVELLING' | 'CUSTOM';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  humanStatus: HumanStatus;
  customStatus: string | null;
  statusExpiresAt: string | null;
}
