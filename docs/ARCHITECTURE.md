# Architecture

Browser/PWA -> Express API -> external data providers

Frontend: HTML + CSS + vanilla JavaScript + Leaflet CDN.
Backend: Node.js + Express, JWT authentication, in-memory demo store.
Mobile: Android shell can host the same responsive web app. A production release should use a secure HTTPS API and platform push notifications.

Routes:
- `/` dashboard
- `/login`, `/register`
- `/profile`, `/settings`
- `/family`
- `/tracking`
- `/disease`
- `/precautions`
- `/notifications`
- `/expert`
- `/api/auth/*`
- `/api/profile`, `/api/settings`
- `/api/family/*`
- `/api/atmosphere`
- `/api/risk`
- `/api/who/outbreaks`
- `/api/who/indicators`
- `/api/hospitals`
