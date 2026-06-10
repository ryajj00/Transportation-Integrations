// Fare calculation utilities for the commuter MVP.
// Exported API:
// - `calculateFareForSegment(segment, opts?)` -> number (PHP)
// - `calculateTotalFare(segments)` -> number (sum)
// - `DEFAULT_RULES` -> configurable fare rules

// DEFAULT_RULES is intentionally conservative and uses common current defaults.
// Replace these values with exact government or provider fare matrices when available.
const DEFAULT_RULES = {
  // Traditional jeepney (approximate): base fare for first X km, then per km increment
  jeepney: { base_km: 4, base_fare: 12, per_km: 2 },
  // Modern e-jeep (approximate)
  e_jeep: { base_km: 4, base_fare: 10, per_km: 3 },
  // Train / LRT / MRT distance bands. Bands are ordered; the last band may include per_km pricing.
  train: {
    bands: [
      { max_km: 4, fare: 13 },
      { max_km: 8, fare: 20 },
      { max_km: Infinity, base_fare: 20, per_km: 2 }
    ]
  },
  // LRT-1 specific example (placeholder — verify against official matrix)
  lrt1: {
    bands: [
      { max_km: 2, fare: 10 },
      { max_km: 4, fare: 13 },
      { max_km: 8, fare: 20 },
      { max_km: Infinity, base_fare: 20, per_km: 2 }
    ]
  },
  // Motorcycle taxi defaults (used when provider-specific rule not present)
  motorcycle: { base_fare: 30, per_km: 8, per_min: 0 },
  // Provider-specific motorcycle/taxi examples — replace with official partner rates
  providers: {
    angkas: { base_fare: 40, per_km: 9, per_min: 2 },
    moveit: { base_fare: 35, per_km: 8.5, per_min: 1.8 },
    joyride: { base_fare: 38, per_km: 9, per_min: 2 }
  },
  walk: { fare: 0 }
};

function _ceilKm(d) {
  return Math.max(0, Math.ceil(d));
}

function calculateFareForSegment(segment, opts = {}) {
  const rules = Object.assign({}, DEFAULT_RULES, opts.rules || {});
  const mode = (segment.mode || '').toLowerCase();
  const d = Number(segment.distance_km) || 0;

  if (mode === 'walk') return 0;

  if (mode === 'jeepney') {
    const r = rules.jeepney;
    if (d <= r.base_km) return r.base_fare;
    return Math.round(r.base_fare + r.per_km * _ceilKm(d - r.base_km));
  }

  if (mode === 'e_jeep' || mode === 'e-jeep' || mode === 'ejeep') {
    const r = rules.e_jeep || rules['e-jeep'];
    if (d <= r.base_km) return r.base_fare;
    return Math.round(r.base_fare + r.per_km * _ceilKm(d - r.base_km));
  }

  if (mode === 'train' || mode === 'lrt' || mode === 'mrt') {
    const bands = (rules.train && rules.train.bands) || [];
    let prevMax = 0;
    for (const b of bands) {
      if (typeof b.fare !== 'undefined' && d <= (b.max_km || Infinity)) {
        return b.fare;
      }
      if (typeof b.per_km !== 'undefined' && b.base_fare !== undefined && d > prevMax) {
        return Math.round(b.base_fare + b.per_km * _ceilKm(d - prevMax));
      }
      prevMax = b.max_km || prevMax;
    }
  }

  if (mode === 'motorcycle' || mode === 'mc' || mode === 'motorbike') {
    // allow provider override: segment.provider = 'angkas'|'moveit'|'joyride'
    const provider = (segment.provider || '').toLowerCase();
    const providerRule = (provider && (rules.providers || {})[provider]) || null;
    const r = providerRule || rules.motorcycle;
    return Math.round((r.base_fare || 0) + (r.per_km || 0) * _ceilKm(d));
  }

  // Unknown mode -> 0
  return 0;
}

function calculateTotalFare(segments, opts = {}) {
  return segments.reduce((sum, s) => sum + (Number(s.fare_php ?? calculateFareForSegment(s, opts)) || 0), 0);
}

module.exports = { calculateFareForSegment, calculateTotalFare, DEFAULT_RULES };
