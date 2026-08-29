import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../auth.js';
import { areAccepted, getPermissions, upsertPermissions } from './repository.js';
import { notifyPrivacyChanged } from '../../realtime/presence.js';

export const privacyRouter = Router();
privacyRouter.use(requireAuth);

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

privacyRouter.get('/:viewerId', async (req: AuthRequest, res) => {
  const viewerId=routeParam(req.params.viewerId);
  if (!(await areAccepted(req.userId!, viewerId))) return res.status(404).json({error:'Accepted connection not found'});
  res.json({permissions:await getPermissions(req.userId!, viewerId)});
});

privacyRouter.patch('/:viewerId', async (req: AuthRequest, res) => {
  const viewerId=routeParam(req.params.viewerId);
  if (!(await areAccepted(req.userId!, viewerId))) return res.status(404).json({error:'Accepted connection not found'});
  const next={...(await getPermissions(req.userId!, viewerId))};
  for (const key of ['sharePresence','shareStatus','shareLastSeen','allowSignals'] as const) {
    if (typeof req.body?.[key] === 'boolean') next[key]=req.body[key];
  }
  const permissions=await upsertPermissions(req.userId!, viewerId, next);
  notifyPrivacyChanged(req.userId!, viewerId);
  res.json({permissions});
});
