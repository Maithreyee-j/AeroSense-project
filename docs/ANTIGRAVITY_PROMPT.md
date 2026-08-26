# Antigravity execution prompt

Open this folder as the project root. Install dependencies with `npm install`. Start with `npm start`. Open `http://localhost:3000` in the browser preview. Then run `npm run test:300` and require exactly 300 passing cases.

Do not replace live data with hard-coded disease counts. Do not expose JWT secrets or API credentials to the browser. Preserve the WHO/Open-Meteo/OSM source labels. If an external provider is unavailable, show `Live source unavailable` and continue with the rest of the UI.

For Android, point the mobile shell to the deployed HTTPS web application URL. Request location permission only when the user starts Live Tracking. Request notification permission only after an explicit user action.
