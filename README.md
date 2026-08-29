# Dot Space V0.8 — Push + Device Sessions

Privacy-first presence for close relationships. V0.8 adds persistent device identity, server-side sessions, device revocation, and push delivery for tiny signals when the recipient is background/offline. Location remains intentionally absent.

## Stack
- Expo / React Native / TypeScript
- Node.js / Express / TypeScript
- PostgreSQL
- Redis + Socket.IO
- Expo Notifications / Expo Push Service

## Run locally
```powershell
docker compose up -d
Copy-Item .env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
npm install
npm run db:migrate
npm run dev:api
```
In another terminal:
```powershell
npm run dev:mobile
```
For a physical phone set `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:4000` in `apps/mobile/.env`.

## Push notification setup
Realtime presence still works in Expo Go. Remote push notifications on Android require a development build with current Expo SDKs. To enable push:
1. Create/link the Expo project with EAS.
2. Replace `REPLACE_WITH_YOUR_EAS_PROJECT_ID` in `apps/mobile/app.json` with the project's EAS project ID.
3. Configure Android/iOS push credentials in EAS.
4. Build/install a development build, then sign in and allow notifications.

If push is not configured, V0.8 displays `Push unavailable here — realtime still works` and continues normally.

## V0.8 behavior
- Each login creates a server-side `device_sessions` record and a JWT containing that session ID.
- REST and Socket.IO both reject revoked sessions.
- A stable per-install device ID is stored with SecureStore.
- An Expo push token is attached only after notification permission is granted.
- Device settings list active sessions and allow remote revocation.
- Signals still require accepted connections + the recipient's `allowSignals` permission + rate limits.
- Active recipients get Socket.IO only. Background/offline recipients can additionally receive push.
- No location permissions, APIs, database columns, or tracking features are included.

## Upgrade from V0.7
Run `npm run db:migrate` after starting Postgres/Redis. The migration adds `device_sessions` without deleting existing users, connections, privacy permissions, or signals.
