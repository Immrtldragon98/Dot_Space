import { activePushTokens } from './repository.js';

const labels:Record<string,string>={THINKING_OF_YOU:'❤️ Thinking of you',AROUND:'👋 Around?',WAVE:'✨ A little hello'};
export async function sendSignalPush(userId:string,senderName:string,kind:string){
  const tokens=await activePushTokens(userId); if(!tokens.length)return;
  const messages=tokens.map(to=>({to,sound:'default',title:'Dot Space',body:`${senderName} · ${labels[kind]??'sent you a signal'}`,data:{type:'signal'}}));
  try{
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(messages)});
    if(!response.ok) console.error('[push] Expo push service returned',response.status);
  }catch(error){console.error('[push] delivery failed',error);}
}
