import { Router } from 'express';
import { z } from 'zod';
import { requireAuth,type AuthRequest } from '../../auth.js';
import { listSessions,registerDevice,revokeSession } from './repository.js';
import { revokeSessionRealtime } from '../../realtime/presence.js';

export const devicesRouter=Router(); devicesRouter.use(requireAuth);
const registration=z.object({deviceId:z.string().min(8).max(200),deviceName:z.string().max(100).nullable().optional(),platform:z.enum(['android','ios','web','unknown']).optional(),pushToken:z.string().max(300).nullable().optional()});
devicesRouter.get('/',async(req:AuthRequest,res)=>res.json({devices:await listSessions(req.userId!)}));
devicesRouter.put('/current',async(req:AuthRequest,res)=>{const p=registration.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid device registration'});const device=await registerDevice(req.sessionId!,req.userId!,p.data);if(!device)return res.status(404).json({error:'Session not found'});res.json({device});});
devicesRouter.delete('/current',async(req:AuthRequest,res)=>{const ok=await revokeSession(req.userId!,req.sessionId!);if(ok)revokeSessionRealtime(req.sessionId!);if(!ok)return res.status(404).json({error:'Active session not found'});res.status(204).end();});
devicesRouter.delete('/:sessionId',async(req:AuthRequest,res)=>{const ok=await revokeSession(req.userId!,req.params.sessionId);if(ok)revokeSessionRealtime(req.params.sessionId);if(!ok)return res.status(404).json({error:'Active session not found'});res.status(204).end();});
