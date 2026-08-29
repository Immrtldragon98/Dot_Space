import { Platform } from 'react-native';

const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallback;

export type HumanStatus = 'AVAILABLE' | 'QUIET' | 'BUSY' | 'SLEEPING' | 'TRAVELLING' | 'CUSTOM';
export type ConnectionState = 'ACTIVE' | 'IDLE' | 'BACKGROUND' | 'OFFLINE';
export type User = { id:string; email:string; displayName:string; humanStatus:HumanStatus; customStatus:string|null; statusExpiresAt:string|null };
export type PrivacyPermissions = { sharePresence:boolean; shareStatus:boolean; shareLastSeen:boolean; allowSignals:boolean };
export type SpacePerson = {
  id:string; email:string; displayName:string; connectionId:string;
  humanStatus:HumanStatus|null; customStatus:string|null; statusExpiresAt:string|null;
  connectionState:ConnectionState|null; lastSeenAt:number|null;
  visibility:PrivacyPermissions;
};
export type ConnectionRequest = { connectionId:string; direction:'INCOMING'|'OUTGOING'; person:User };
export type SignalKind = 'THINKING_OF_YOU' | 'AROUND' | 'WAVE';
export type DeviceSession = { id:string; userId:string; deviceId:string|null; deviceName:string|null; platform:string|null; pushToken:string|null; notificationsEnabled:boolean; createdAt:string; lastSeenAt:string; revokedAt:string|null };
export type Signal = { id:string; senderId:string; recipientId:string; kind:SignalKind; createdAt:string; acknowledgedAt:string|null; senderDisplayName?:string };

async function request<T>(path:string, options:RequestInit={}, token?:string):Promise<T>{
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(token) headers.Authorization=`Bearer ${token}`;
  const response=await fetch(`${API_URL}${path}`,{...options,headers:{...headers,...(options.headers??{})}});
  const data=await response.json(); if(!response.ok) throw new Error(data.error??'Request failed'); return data;
}

export const api={
  register:(email:string,password:string,displayName:string)=>request<{token:string;user:User;sessionId:string}>('/auth/register',{method:'POST',body:JSON.stringify({email,password,displayName})}),
  login:(email:string,password:string)=>request<{token:string;user:User;sessionId:string}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
  setStatus:(token:string,humanStatus:HumanStatus,customStatus?:string|null,expiresInMinutes?:number|null)=>request<{user:User}>('/users/me/status',{method:'PATCH',body:JSON.stringify({humanStatus,customStatus,expiresInMinutes})},token),
  space:(token:string)=>request<{self:User&{connectionState:ConnectionState;lastSeenAt:number|null};people:SpacePerson[]}>('/space',{},token),
  requests:(token:string)=>request<{requests:ConnectionRequest[]}>('/connections/requests',{},token),
  addPerson:(token:string,email:string)=>request<{connectionId:string;status:string}>('/connections/requests',{method:'POST',body:JSON.stringify({email})},token),
  accept:(token:string,id:string)=>request(`/connections/${id}/accept`,{method:'POST'},token), reject:(token:string,id:string)=>request(`/connections/${id}/reject`,{method:'POST'},token),
  getPrivacy:(token:string,viewerId:string)=>request<{permissions:PrivacyPermissions}>(`/privacy/${viewerId}`,{},token),
  setPrivacy:(token:string,viewerId:string,permissions:PrivacyPermissions)=>request<{permissions:PrivacyPermissions}>(`/privacy/${viewerId}`,{method:'PATCH',body:JSON.stringify(permissions)},token),
  signals:(token:string)=>request<{signals:Signal[]}>('/signals/inbox',{},token),
  sendSignal:(token:string,recipientId:string,kind:SignalKind)=>request<{signal:Signal}>('/signals',{method:'POST',body:JSON.stringify({recipientId,kind})},token),
  acknowledgeSignal:(token:string,id:string)=>request<{signal:Signal}>(`/signals/${id}/acknowledge`,{method:'POST'},token),
  devices:(token:string)=>request<{devices:DeviceSession[]}>('/devices',{},token),
  registerDevice:(token:string,body:{deviceId:string;deviceName?:string|null;platform?:'android'|'ios'|'web'|'unknown';pushToken?:string|null})=>request<{device:DeviceSession}>('/devices/current',{method:'PUT',body:JSON.stringify(body)},token),
  revokeDevice:(token:string,sessionId:string)=>request<void>(`/devices/${sessionId}`,{method:'DELETE'},token),
  logoutCurrent:(token:string)=>request<void>('/devices/current',{method:'DELETE'},token),
};
