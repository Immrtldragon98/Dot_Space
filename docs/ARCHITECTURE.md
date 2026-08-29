# Dot Space V0.8 architecture

Mobile (Expo/React Native) talks to a Node/Express API for durable operations and Socket.IO for realtime events. PostgreSQL stores users, accepted relationships, directional privacy permissions, signals and device sessions. Redis stores ephemeral per-device presence with TTLs and Socket.IO pub/sub state.

Privacy is enforced server-side. `/space` obtains the viewed person's permission row where `owner = person` and `viewer = requester`, then redacts status, presence and last-seen fields before serialization. Realtime presence/status broadcasts use the same directional permission model and never emit a prohibited field to that viewer's room.

V0.8 adds server-backed device sessions and optional Expo push delivery for signals when a recipient is background/offline.

There is no location collection, permission, schema, API or UI.
