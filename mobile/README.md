# Expo Map Example (Commuter)

This is a simple Expo example that demonstrates fetching and displaying GeoJSON features from the Commuter backend on a map.

Prerequisites
- Node.js (v14+)
- The Commuter backend running locally on port 3000.

No Mapbox API key needed! Uses Google Maps via `react-native-maps`.

Quick start

Install dependencies:
```bash
cd mobile
npm install
```

Start Expo:
```bash
npm start
```

You can then:
- Press `i` to open on iOS simulator
- Press `a` to open on Android emulator
- Press `w` to open in web browser

How it works
- `App.js` mounts `src/MapScreen.js`.
- `MapScreen` calls the backend via `src/utils/featureFetcher.js` to fetch a feature when the user presses "Load LRT2 Sample".
- The backend endpoint is `GET /api/feature?file=...&id=...`.
- The feature geometry is rendered as a polyline on the map.

Adjusting for your environment
- If your backend is not on localhost:3000, update `BASE_URL` in `src/utils/featureFetcher.js`.

Notes
- Uses Google Maps via `react-native-maps` on iOS and Android.
- Set your Google API keys in `app.json` under `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey`.
- No native compilation or native CLI needed—Expo handles everything.
