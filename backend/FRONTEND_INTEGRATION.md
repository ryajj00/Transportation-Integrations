Frontend integration notes for Commuter backend

Overview
- The backend exposes lightweight planning responses and a separate feature endpoint to avoid sending heavy geometries in every plan response.

Key endpoints
- `GET /api/plan?start=LAT,LON&end=LAT,LON`: returns `{ segments: [...], totalFare, totalTime }`. Each segment may include `matched_feature` with: `file`, `properties`, `length_km` (no `geometry`).
- `GET /api/feature?file=FILENAME.geojson&id=FEATURE_ID`: returns `{ feature: <GeoJSON Feature> }` with full `geometry` and `properties`.
- `GET /api/geojson`: lists available geojson files and simple metadata from `catalog.json`.

Typical client flow (mobile/web)
1. Request route plan:
   - `GET /api/plan?start=...&end=...`
   - Render returned `segments` on the UI using simple markers and lines for on-device legs (walking) and highlight matched segments using `matched_feature.properties`.
2. Lazy-load geometry only when needed:
   - When a user taps a matched segment or zooms to route, call `GET /api/feature?file=...&id=...` to fetch the full geometry.
   - Cache the returned Feature locally (in memory or local storage) keyed by `file:id` to avoid repeated fetches.
3. Displaying geometry:
   - Map libraries expect coordinates in `[lon,lat]` order for GeoJSON; the returned features follow GeoJSON spec.
   - Use a lightweight polyline renderer for large geometries (Mapbox LineLayer or native polyline components) and simplify on-device if needed.

Example JS helper (fetch + cache)
```javascript
const featureCache = new Map();

async function fetchFeature(file, id) {
  const key = `${file}:${id}`;
  if (featureCache.has(key)) return featureCache.get(key);
  const res = await fetch(`/api/feature?file=${encodeURIComponent(file)}&id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Feature fetch failed');
  const body = await res.json();
  featureCache.set(key, body.feature);
  return body.feature;
}
```

Performance recommendations
- Avoid rendering full geometry for all segments initially — use `matched_feature.properties` to present summarized UI.
- Prefetch features for visible map viewport or for segments within a short time window of the user's route.
- If large GeoJSON features still cause rendering bottlenecks, run a simplification step server-side (e.g., `topojson-simplify`) and expose simplified variants in `catalog.json`.

Security and rate limiting
- If exposing the backend publicly, protect admin endpoints and consider rate-limiting the `/api/feature` endpoint to prevent excessive geometry downloads.
- Consider adding short-lived signed URLs for large geometry downloads if running behind CDN/private storage.

Data shapes reference
- Plan response: `{"segments":[{"mode","from","to","distance_km","duration_min","fare_php","matched_feature":{"file","properties","length_km"}}],"totalFare", "totalTime"}`
- Feature response: `{ "feature": <GeoJSON Feature> }`

Next steps for frontend
- Add a small React/React Native example that requests `/api/plan` and lazy-loads `/api/feature` when the user taps a segment.
- If offline capability is required, add a sync job to pre-download features for saved routes.

File: backend/FRONTEND_INTEGRATION.md
