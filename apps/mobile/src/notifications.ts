import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY='dot-space-device-id';

export async function getPersistentDeviceId(){
  let id=await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if(!id){
    id=`device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY,id);
  }
  return id;
}

export function getDeviceLabel(){
  return Device.deviceName??`${Platform.OS} device`;
}

// Push registration is intentionally deferred in the V0.9 Android preview.
// The app must always boot even when FCM / Expo push credentials are incomplete.
export async function getPushToken():Promise<string|null>{
  return null;
}
