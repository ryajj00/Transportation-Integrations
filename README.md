# Commuter Transportation App

## Project Overview

A multi-modal commuter route planner with real-time fare estimation and transit integration. Built with Node.js + Express backend, React Native + Expo frontend, and GeoJSON transit data.

## Architecture

```
commuter-app/
├── backend/              # Node.js/Express API server
│   ├── index.js         # Core API (8 endpoints)
│   ├── utils/
│   │   └── fareCalculator.js  # Fare engine
│   ├── data/
│   │   ├── routes.json  # Transit hubs
│   │   └── geojson/     # Transit tracks (GeoJSON LineStrings)
│   ├── test/            # Unit tests (6/6 passing)
│   └── FRONTEND_INTEGRATION.md
├── mobile/              # React Native + Expo app
│   ├── app.json        # Expo config
│   ├── App.js          # Entry point
│   └── src/
│       ├── MapScreen.js    # Map UI
│       └── utils/featureFetcher.js  # Lazy feature loading
└── README.md (this file)
```

## Backend Setup

### Prerequisites
- Node.js v26+

### Install & Run

```bash
cd backend
npm install
npm start
```

### Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plan?start=LAT,LON&end=LAT,LON` | Get multi-modal route with fare & time |
| GET | `/api/routing?start=LAT,LON&end=LAT,LON&engine=osrm|valhalla` | Query an OSRM/Valhalla routing backend if configured |
| GET | `/api/feature?file=FILENAME&id=FEATURE_ID` | Get full GeoJSON Feature geometry |
| GET | `/api/geojson` | List available GeoJSON files |
| GET | `/api/geojson/:file` | Get specific GeoJSON FeatureCollection |
| GET | `/api/hubs` | List transit hubs |
| GET | `/api/admin/rules` | Get current fare rules |
| POST | `/api/admin/rules` | Update fare rules (optional ADMIN_TOKEN) |
| GET | `/api/deeplink?provider=...` | Deep-link to MC taxi providers |

### Routing Engine Configuration

Set `ROUTING_ENGINE_URL` to an OSRM or Valhalla backend endpoint to enable `/api/routing` and optional engine-aware planning. Example:

```bash
export ROUTING_ENGINE_URL=http://localhost:5000
export ROUTING_ENGINE=osrm
```

When configured, `/api/plan` can also use `?engine=osrm` or `?engine=valhalla` to request the routing service.

### Test Endpoints

```bash
# Get route from Santolan to Cubao
curl "http://localhost:3000/api/plan?start=14.585,-121.045&end=14.61,121.055"

# Get full LRT-2 track geometry
curl "http://localhost:3000/api/feature?file=lrt2_line_sample.geojson&id=lrt2_sample"

# Run tests
npm --prefix backend test
```

### Fare Rules

Edit `backend/utils/fareCalculator.js` → `DEFAULT_RULES` to customize:
- Transit modes: jeepney, e_jeep, train, lrt1, motorcycle
- MC taxi providers: Angkas, Move It, JoyRide
- Support for fare bands (distance-based) or per-km rates

### Admin Rule Updates

```bash
# Update rules (shallow merge)
curl -X POST http://localhost:3000/api/admin/rules \
  -H "Content-Type: application/json" \
  -d '{"jeepney":{"per_km": 0.15}}'

# Reset to defaults
curl -X POST http://localhost:3000/api/admin/rules \
  -H "Content-Type: application/json" \
  -d '{"_reset": true}'
```

## Frontend Setup (React Native + Expo)

### Prerequisites
- Node.js v14+
- (Optional) iOS/Android emulator or Expo Go app on phone

### Install & Run

```bash
cd mobile
npm install --legacy-peer-deps
npm start
```

### Expo Options
- Press `i` → iOS simulator
- Press `a` → Android emulator  
- Press `w` → Web browser (requires additional web packages)
- Scan QR → Expo Go app on phone

### Folder Structure

```
mobile/
├── App.js              # Entry, mounts MapScreen
├── app.json            # Expo config
├── src/
│   ├── MapScreen.js           # Map + feature loading UI
│   └── utils/featureFetcher.js    # Backend API client
└── package.json
```

### How the Frontend Works

1. **MapScreen** displays a map centered on Metro Manila
2. User taps **"Load LRT2 Sample"** button
3. **featureFetcher** calls backend `GET /api/feature?file=lrt2_line_sample.geojson&id=lrt2_sample`
4. Response includes full GeoJSON geometry (coordinates)
5. Polyline rendered on map with react-native-maps

### Customization

To load a different feature, edit [src/MapScreen.js](mobile/src/MapScreen.js#L15):

```javascript
const f = await fetchFeature('YOUR_FILE.geojson', 'FEATURE_ID');
```

## GeoJSON Format

Add transit tracks to `backend/data/geojson/`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "route_id",
      "properties": {
        "name": "Route Name",
        "mode": "jeepney"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[121.06, 14.61], [121.07, 14.62], ...]
      }
    }
  ]
}
```

**Supported modes**: jeepney, e_jeep, train, lrt1, motorcycle

## Testing

### Backend Unit Tests

```bash
npm --prefix backend test
```

Covers: fare calculation, provider rates, transit mode bands (6/6 tests passing)

### Smoke Test

```bash
node backend/smokeTest.js
```

Tests: /api/plan and /api/feature endpoints (must have backend running)

### Manual API Testing

```bash
# Windows PowerShell with execution policy bypass:
powershell -ExecutionPolicy Bypass -Command "npm.cmd --prefix backend test"

# Or use curl.exe directly:
curl.exe "http://localhost:3000/api/plan?start=14.585,-121.045&end=14.61,121.055"
```

## Known Issues & Workarounds

### PowerShell Execution Policy (Windows)

**Problem**: `npm` command blocked by security policy

**Workaround**: Use `npm.cmd` directly or execution policy bypass:
```bash
npm.cmd --prefix backend start
# OR
powershell -ExecutionPolicy Bypass -Command "npm install"
```

### Expo on Windows (Metro node:sea Bug)

**Problem**: Expo @50 has a Metro bundler issue creating `node:sea` directory (colons not allowed on Windows)

**Workaround**: 
- Use iOS/Android emulator or Expo Go app (phone)
- Web support disabled in current setup
- Downgrade to Expo @49 if issues persist

### react-native-maps Version Conflicts

**Problem**: Different React versions may cause peer dependency errors

**Solution**: Use `npm install --legacy-peer-deps` to bypass strict peer checks

## Deployment Checklist

- [x] Backend REST API fully implemented (8 endpoints)
- [x] Fare calculator with provider integration
- [x] GeoJSON track loading with caching
- [x] Admin endpoints for runtime rule editing
- [x] Frontend scaffolding with map integration  
- [x] Lazy feature loading with client-side caching
- [x] Unit tests & smoke tests
- [x] Documentation (this file + FRONTEND_INTEGRATION.md)
- [ ] Persist admin rules to disk (auto-load on restart)
- [ ] Integrate real routing engine (OSRM/Valhalla)
- [ ] Production deployment (Azure App Service / Container Apps)

## Next Steps

1. **Persist Admin Rules**: Save rule changes to `backend/data/rules.json` and load on startup
2. **Real Routing**: Replace mock haversine with OSRM or Valhalla for accurate paths
3. **MC Taxi Integration**: Implement actual deep-links for Angkas, Move It, JoyRide
4. **Geolocation**: Add real-time user location tracking in MapScreen
5. **Search UI**: Add route search form with autocomplete hubs

## License

MIT (Personal project)

## Support

For backend issues, check [backend/FRONTEND_INTEGRATION.md](backend/FRONTEND_INTEGRATION.md)
