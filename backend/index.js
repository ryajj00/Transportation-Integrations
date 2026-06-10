const express = require('express');
const cors = require('cors');
const { calculateFareForSegment, calculateTotalFare, DEFAULT_RULES } = require('./utils/fareCalculator');
const routesData = require('./data/routes.json');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// runtime rules (can be updated via admin API)
let currentRules = JSON.parse(JSON.stringify(DEFAULT_RULES));
const GEOJSON_DIR = path.join(__dirname, 'data', 'geojson');

// ensure geojson dir exists
if (!fs.existsSync(GEOJSON_DIR)) {
  try { fs.mkdirSync(GEOJSON_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

// load geojson features into memory for quick matching
let geojsonFeatures = [];
const CATALOG_FILE = path.join(GEOJSON_DIR, 'catalog.json');

function loadGeoJSONFiles() {
  geojsonFeatures = [];
  try {
    const files = fs.readdirSync(GEOJSON_DIR).filter(f => f.toLowerCase().endsWith('.geojson'));
    // try using existing catalog if mtimes match
    if (fs.existsSync(CATALOG_FILE)) {
      try {
        const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
        const catalogFiles = (catalog.files || []).map(f => f.file).sort();
        const actualFiles = files.slice().sort();
        if (JSON.stringify(catalogFiles) === JSON.stringify(actualFiles)) {
          // verify mtimes
          let mtOk = true;
          for (const entry of (catalog.files || [])) {
            try {
              const st = fs.statSync(path.join(GEOJSON_DIR, entry.file));
              if (st.mtimeMs !== entry.mtimeMs) { mtOk = false; break; }
            } catch (e) { mtOk = false; break; }
          }
          if (mtOk) {
            // load from catalog
            for (const entry of (catalog.files || [])) {
              geojsonFeatures.push(entry);
            }
            return;
          }
        }
      } catch (e) {
        // fallthrough to rebuild
      }
    }

    // rebuild catalog
    const newCatalog = { files: [] };
    for (const f of files) {
      try {
        const full = path.join(GEOJSON_DIR, f);
        const raw = fs.readFileSync(full, 'utf8');
        const js = JSON.parse(raw);
        const features = js.features || [];
        for (const feat of features) {
          const coords = feat.geometry && feat.geometry.coordinates || [];
          const length = polylineLengthKm(coords);
          const props = feat.properties || {};
          const entry = { file: f, properties: props, geometry: feat.geometry, coords, length, mtimeMs: fs.statSync(full).mtimeMs };
          geojsonFeatures.push(entry);
          newCatalog.files.push(entry);
        }
      } catch (e) {
        // ignore invalid files
      }
    }

    try { fs.writeFileSync(CATALOG_FILE, JSON.stringify(newCatalog, null, 2)); } catch (e) { /* ignore */ }
  } catch (e) {
    geojsonFeatures = [];
  }
}

function polylineLengthKm(coords) {
  if (!coords || coords.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i-1];
    const [lng2, lat2] = coords[i];
    sum += haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  }
  return sum;
}

function pointToCoordsMinDistKm(pt, coords) {
  if (!coords || coords.length === 0) return Infinity;
  let best = Infinity;
  for (const c of coords) {
    const [lng, lat] = c;
    const d = haversineKm(pt, { lat, lng });
    if (d < best) best = d;
  }
  return best;
}

function findMatchingTrack(startHub, endHub, mode) {
  let best = null;
  for (const feat of geojsonFeatures) {
    const fmode = (feat.properties && feat.properties.mode) || '';
    // prefer same mode but allow others
    if (fmode && mode && fmode !== mode) continue;
    const d1 = pointToCoordsMinDistKm({ lat: startHub.lat, lng: startHub.lng }, feat.coords);
    const d2 = pointToCoordsMinDistKm({ lat: endHub.lat, lng: endHub.lng }, feat.coords);
    // both endpoints should be reasonably close to the line
    if (d1 <= 1.5 && d2 <= 1.5) {
      const length = polylineLengthKm(feat.coords);
      const score = d1 + d2 + length * 0.01; // prefer shorter d1+d2
      if (!best || score < best.score) best = { feat, score, length };
    }
  }
  return best;
}

// initial load
loadGeoJSONFiles();

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDlat = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon), Math.sqrt(1 - (sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon)));
  return R * c;
}

const ROUTING_ENGINE_URL = process.env.ROUTING_ENGINE_URL || null;
const ROUTING_ENGINE = (process.env.ROUTING_ENGINE || 'mock').toLowerCase();

function findNearestHub(point) {
  let best = null;
  for (const hub of routesData.hubs) {
    const d = haversineKm(point, { lat: hub.lat, lng: hub.lng });
    if (!best || d < best.dist) best = { hub, dist: d };
  }
  return best;
}

async function fetchRouteFromEngine(startPt, endPt, engine = 'osrm') {
  if (!ROUTING_ENGINE_URL) return null;
  const baseUrl = ROUTING_ENGINE_URL.replace(/\/+$/, '');
  try {
    if (engine === 'osrm') {
      const params = new URLSearchParams({ geometries: 'geojson', overview: 'simplified', steps: 'true' });
      const url = `${baseUrl}/route/v1/driving/${startPt.lng},${startPt.lat};${endPt.lng},${endPt.lat}?${params}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.routes || !data.routes.length || data.code !== 'Ok') return null;
      const route = data.routes[0];
      return {
        engine: 'osrm',
        distance_km: route.distance / 1000,
        duration_min: Math.round(route.duration / 60),
        geometry: route.geometry,
        raw: data
      };
    }

    if (engine === 'valhalla') {
      const url = `${baseUrl}/route`;
      const body = {
        locations: [
          { lat: startPt.lat, lon: startPt.lng },
          { lat: endPt.lat, lon: endPt.lng }
        ],
        costing: 'auto',
        directions_options: { units: 'kilometers' }
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.trip || !data.trip.summary) return null;
      const summary = data.trip.summary;
      return {
        engine: 'valhalla',
        distance_km: summary.length / 1000,
        duration_min: Math.round(summary.time / 60),
        geometry: data.trip.legs?.[0]?.shape ? { type: 'LineString', coordinates: data.trip.legs[0].shape } : null,
        raw: data
      };
    }
  } catch (e) {
    return null;
  }
  return null;
}

app.get('/api/plan', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Provide start and end as lat,lng' });
  const [sLat, sLng] = start.split(',').map(Number);
  const [eLat, eLng] = end.split(',').map(Number);
  const startPt = { lat: sLat, lng: sLng };
  const endPt = { lat: eLat, lng: eLng };

  const routeEngineQuery = ((req.query.engine || ROUTING_ENGINE) || 'mock').toLowerCase();
  let routeEngineInfo = null;
  if (ROUTING_ENGINE_URL && routeEngineQuery !== 'mock') {
    routeEngineInfo = await fetchRouteFromEngine(startPt, endPt, routeEngineQuery);
  }

  if (routeEngineInfo) {
    const engineSegment = {
      mode: 'transit',
      from: 'origin',
      to: 'destination',
      distance_km: +routeEngineInfo.distance_km.toFixed(3),
      duration_min: routeEngineInfo.duration_min,
      fare_php: calculateFareForSegment({ mode: 'train', distance_km: routeEngineInfo.distance_km }, { rules: currentRules }),
      route_engine: { engine: routeEngineInfo.engine, service: ROUTING_ENGINE_URL }
    };
    const totalFare = calculateTotalFare([engineSegment], { rules: currentRules });
    return res.json({
      segments: [engineSegment],
      totalFare,
      totalTime: engineSegment.duration_min,
      routeEngineUsed: true,
      routeEngine: { engine: routeEngineInfo.engine, url: ROUTING_ENGINE_URL }
    });
  }

  const nearestStart = findNearestHub(startPt);
  const nearestEnd = findNearestHub(endPt);

  // Simple mock planner: walk -> transit -> walk
  const segments = [];

  const walkToHubKm = nearestStart.dist;
  if (walkToHubKm > 0.05) {
    segments.push({ mode: 'walk', from: 'user', to: nearestStart.hub.name, distance_km: +(walkToHubKm).toFixed(3) });
  }

  // choose transit mode: prefer train if both hubs have line === 'train'
  let transitMode = 'jeepney';
  if (nearestStart.hub.line === 'train' || nearestEnd.hub.line === 'train') transitMode = 'train';

  const interHubKm = haversineKm({ lat: nearestStart.hub.lat, lng: nearestStart.hub.lng }, { lat: nearestEnd.hub.lat, lng: nearestEnd.hub.lng });
  if (interHubKm > 0.02) {
    // try to match a GeoJSON transit track
    const match = findMatchingTrack(nearestStart.hub, nearestEnd.hub, transitMode);
    if (match) {
      const seg = {
        mode: transitMode,
        from: match.feat.properties && match.feat.properties.name ? match.feat.properties.name : nearestStart.hub.name,
        to: nearestEnd.hub.name,
        distance_km: +match.length.toFixed(3),
        // avoid large geometry payloads in /api/plan: include a lightweight reference
        matched_feature: {
          file: match.feat.file,
          properties: match.feat.properties || {},
          length_km: +match.length.toFixed(3)
        }
      };
      segments.push(seg);
    } else {
      segments.push({ mode: transitMode, from: nearestStart.hub.name, to: nearestEnd.hub.name, distance_km: +interHubKm.toFixed(3) });
    }
  }

  const walkFromHubKm = nearestEnd.dist;
  if (walkFromHubKm > 0.05) {
    segments.push({ mode: 'walk', from: nearestEnd.hub.name, to: 'destination', distance_km: +(walkFromHubKm).toFixed(3) });
  }

  // enrich segments with duration and fare
  const speeds = { walk: 5, jeepney: 20, train: 40, e_jeep: 25, motorcycle: 30 };
  for (const seg of segments) {
    const speed = speeds[seg.mode] || 25;
    seg.duration_min = Math.round((seg.distance_km / speed) * 60);
    seg.fare_php = calculateFareForSegment(seg, { rules: currentRules });
  }

  const totalFare = calculateTotalFare(segments, { rules: currentRules });
  const totalTime = segments.reduce((s, x) => s + (x.duration_min || 0), 0);

  res.json({ segments, totalFare, totalTime, routeEngineUsed: false, routeEngineService: ROUTING_ENGINE_URL || null });
});

app.get('/api/routing', async (req, res) => {
  const { start, end } = req.query;
  const engine = ((req.query.engine || ROUTING_ENGINE) || 'osrm').toLowerCase();
  if (!start || !end) return res.status(400).json({ error: 'Provide start and end as lat,lng' });
  if (!ROUTING_ENGINE_URL) return res.status(501).json({ error: 'Routing engine not configured. Set ROUTING_ENGINE_URL' });
  if (!['osrm', 'valhalla'].includes(engine)) return res.status(400).json({ error: 'Unsupported engine. Use osrm or valhalla' });

  const [sLat, sLng] = start.split(',').map(Number);
  const [eLat, eLng] = end.split(',').map(Number);
  const routeResult = await fetchRouteFromEngine({ lat: sLat, lng: sLng }, { lat: eLat, lng: eLng }, engine);
  if (!routeResult) return res.status(502).json({ error: 'Routing engine call failed or returned no route' });

  res.json({
    engine: routeResult.engine,
    service: ROUTING_ENGINE_URL,
    route: {
      distance_km: +routeResult.distance_km.toFixed(3),
      duration_min: routeResult.duration_min,
      geometry: routeResult.geometry
    }
  });
});

app.get('/api/deeplink', (req, res) => {
  const { provider, start, end } = req.query;
  if (!provider || !start || !end) return res.status(400).json({ error: 'Provide provider, start and end' });
  const [sLat, sLng] = start.split(',').map(Number);
  const [eLat, eLng] = end.split(',').map(Number);

  // Format deep links per provider (best-effort placeholders)
  let url = null;
  switch ((provider || '').toLowerCase()) {
    case 'angkas':
      url = `angkas://book?pickup=${sLat},${sLng}&drop=${eLat},${eLng}`;
      break;
    case 'moveit':
      url = `moveit://request?pickup=${sLat},${sLng}&drop=${eLat},${eLng}`;
      break;
    case 'joyride':
      url = `joyride://book?pickup=${sLat},${sLng}&drop=${eLat},${eLng}`;
      break;
    default:
      return res.status(400).json({ error: 'Unknown provider' });
  }

  // Also provide web fallback link (placeholder)
  const webFallback = `https://example.com/deeplink/${provider}?pickup=${sLat},${sLng}&drop=${eLat},${eLng}`;
  res.json({ deepLink: url, webFallback });
});

app.get('/api/hubs', (req, res) => {
  res.json(routesData.hubs);
});

// GeoJSON endpoints: list and serve sample transit tracks
app.get('/api/geojson', (req, res) => {
  try {
    const files = fs.readdirSync(GEOJSON_DIR).filter(f => f.toLowerCase().endsWith('.geojson'));
    const list = files.map(f => ({ file: f, url: `/api/geojson/${encodeURIComponent(f)}` }));
    res.json({ files: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read geojson directory' });
  }
});

app.get('/api/geojson/:file', (req, res) => {
  const fname = req.params.file || '';
  if (!fname.toLowerCase().endsWith('.geojson')) return res.status(400).json({ error: 'Only .geojson files allowed' });
  // prevent traversal
  const target = path.join(GEOJSON_DIR, fname);
  if (!target.startsWith(GEOJSON_DIR)) return res.status(400).json({ error: 'Invalid file' });
  try {
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
    const raw = fs.readFileSync(target, 'utf8');
    const json = JSON.parse(raw);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Return a single GeoJSON Feature by file and feature id/name (to avoid sending large geometries in /api/plan)
app.get('/api/feature', (req, res) => {
  const file = req.query.file;
  const fid = req.query.id || req.query.name;
  if (!file) return res.status(400).json({ error: 'Provide file query param (filename.geojson)' });
  const target = path.join(GEOJSON_DIR, file);
  if (!target.startsWith(GEOJSON_DIR)) return res.status(400).json({ error: 'Invalid file' });
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found' });
  try {
    const raw = fs.readFileSync(target, 'utf8');
    const js = JSON.parse(raw);
    const features = js.features || [];
    if (!fid) {
      // return first feature
      return res.json({ feature: features[0] || null });
    }
    const found = features.find(f => (f.properties && (f.properties.id === fid || f.properties.name === fid)));
    if (found) return res.json({ feature: found });
    return res.status(404).json({ error: 'Feature not found' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read or parse geojson' });
  }
});

// Admin endpoints to view/update fare rules at runtime
function checkAdmin(req, res) {
  if (!ADMIN_TOKEN) return true; // no token configured -> allow (dev)
  const t = req.headers['x-admin-token'] || req.query.admin_token;
  return t === ADMIN_TOKEN;
}

app.get('/api/admin/rules', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ rules: currentRules });
});

app.post('/api/admin/rules', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const body = req.body || {};
  if (body.action === 'reset') {
    currentRules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    return res.json({ ok: true, rules: currentRules });
  }
  if (body.rules && typeof body.rules === 'object') {
    // merge shallowly
    currentRules = Object.assign({}, currentRules, body.rules);
    return res.json({ ok: true, rules: currentRules });
  }
  return res.status(400).json({ error: 'Provide `rules` object or { action: "reset" }' });
});

app.listen(PORT, () => {
  console.log(`Commuter backend listening on port ${PORT}`);
});
