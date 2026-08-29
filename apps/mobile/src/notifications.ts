import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY='dot-space-device-id';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});

export async function getPersistentDeviceId(){let id=await SecureStore.getItemAsync(DEVICE_ID_KEY);if(!id){id=`device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;await SecureStore.setItemAsync(DEVICE_ID_KEY,id);}return id;}
export function getDeviceLabel(){return Device.deviceName??`${Platform.OS} device`;}
export async function getPushToken():Promise<string|null>{
  if(!Device.isDevice)return null;
  const current=await Notifications.getPermissionsAsync();
  let status=current.status;if(status!=='granted')status=(await Notifications.requestPermissionsAsync()).status;
  if(status!=='granted')return null;
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('signals',{name:'Signals',importance:Notifications.AndroidImportance.DEFAULT});
  const projectId=Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if(!projectId||projectId.startsWith('REPLACE_'))return null;
  return (await Notifications.getExpoPushTokenAsync({projectId})).data;
}
