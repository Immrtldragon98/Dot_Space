import { io, type Socket } from 'socket.io-client';
import { API_URL, type ConnectionState, type HumanStatus, type Signal } from './api';
export type PresenceChanged={userId:string;connectionState:ConnectionState;lastSeenAt:number|null};
export type StatusChanged={userId:string;humanStatus:HumanStatus;customStatus:string|null;statusExpiresAt:string|null};
export type PrivacyChanged={userId:string}; export type SignalReceived=Signal; export type SignalAcknowledged=Signal;
export function createRealtime(token:string,deviceId:string):Socket{return io(API_URL,{transports:['websocket'],auth:{token,deviceId},reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:500,reconnectionDelayMax:5000});}
