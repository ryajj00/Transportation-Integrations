# Commuter App — Backend MVP

This is a small Node.js Express scaffold implementing a mock route planner and fare estimator for the Philippine commuter MVP. It is intentionally simple so it can be extended to integrate OSRM/Valhalla and real GTFS/GeoJSON inputs.

Quick start

1. Open a terminal in `backend`
2. Install dependencies:

```powershell
npm install
```

3. Start the server:

```powershell
npm start
```

Endpoints

- `GET /api/plan?start=lat,lng&end=lat,lng` — returns a simple plan with segments, estimated durations, and fares.
- `GET /api/deeplink?provider=angkas|moveit|joyride&start=lat,lng&end=lat,lng` — returns app deep link placeholder and web fallback.
- `GET /api/hubs` — returns sample hubs used by the mock planner.

Next steps

- Replace the mock planner with a proper routing engine (OSRM or Valhalla) seeded with GTFS and custom jeepney GeoJSON routes.
- Add caching and pre-computed transfers for popular corridors.
- Implement authentication, rate-limiting, and telemetry.
- Scaffold the React Native app with Mapbox and wire the `/api/plan` and `/api/deeplink` endpoints.
