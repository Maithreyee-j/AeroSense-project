# AeroSense

AeroSense is a blue/white responsive web + mobile-ready PWA for **real-time atmospheric risk mapping**, environmental exposure/susceptibility estimation, WHO outbreak information, family location sharing, notifications, expert accounts and emergency hospital discovery.

> **Important:** AeroSense is a safety/information tool, not a medical diagnostic system. The susceptibility score is an environmental risk estimate and must not be presented as a diagnosis or treatment recommendation. Health alerts should be reviewed by a qualified clinician.

## Data sources
- WHO Disease Outbreak News API for current outbreak notices.
- WHO Global Health Observatory (GHO) OData API for health indicators.
- Open-Meteo weather + air-quality APIs for live atmospheric measurements.
- OpenStreetMap Overpass for nearby hospital/healthcare map features.

The application does **not** invent disease counts. If a source is unavailable, the UI states that live data could not be retrieved rather than fabricating values.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000`
6. Run all automated cases: `npm run test:300`

## Demo accounts
The app can create users from the UI. For a quick demo, register a normal user or expert. Do not use real passwords in source control.

## GitHub
Create an empty GitHub repository, then:
```bash
git init
git add .
git commit -m "Initial AeroSense application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aerosense.git
git push -u origin main
```

## Android
The frontend is PWA-ready. The `android/` folder contains a WebView-style Android shell specification. For production Android packaging, use Android Studio/Gradle or Capacitor with the deployed web URL. Do not embed API secrets in the APK.

## 300 test cases
`tests/testcases.json` contains exactly 300 cases. `tests/run300.mjs` boots the backend and executes every case against localhost. Cases are deterministic and do not depend on WHO/OpenStreetMap being online; live-source routes are tested for safe response handling.
