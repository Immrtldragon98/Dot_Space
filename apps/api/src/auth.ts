import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { isSessionActive, touchSession } from './modules/devices/repository.js';

export interface AuthRequest extends Request { userId?: string; sessionId?: string }
export function signToken(userId:string,sessionId:string):string{return jwt.sign({sub:userId,sid:sessionId},config.jwtSecret,{expiresIn:'7d'});}
export async function requireAuth(req:AuthRequest,res:Response,next:NextFunction){const value=req.header('authorization');if(!value?.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});try{const payload=jwt.verify(value.slice(7),config.jwtSecret);if(typeof payload==='string'||typeof payload.sub!=='string'||typeof payload.sid!=='string')throw new Error('Invalid token');if(!(await isSessionActive(payload.sid,payload.sub)))return res.status(401).json({error:'Session revoked'});req.userId=payload.sub;req.sessionId=payload.sid;void touchSession(payload.sid,payload.sub);next();}catch{res.status(401).json({error:'Invalid or expired token'});}}
