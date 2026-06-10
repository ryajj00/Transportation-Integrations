const assert = require('assert');
const { calculateFareForSegment, calculateTotalFare } = require('../utils/fareCalculator');

function approx(a, b) {
  return a === b;
}

// Tests
const tests = [];

tests.push(() => {
  // jeepney short
  const f = calculateFareForSegment({ mode: 'jeepney', distance_km: 3.2 });
  assert.strictEqual(f, 12);
});

tests.push(() => {
  // jeepney longer
  const f = calculateFareForSegment({ mode: 'jeepney', distance_km: 6 });
  // base 12 + 2 * ceil(2) = 16
  assert.strictEqual(f, 16);
});

tests.push(() => {
  // e_jeep
  const f = calculateFareForSegment({ mode: 'e_jeep', distance_km: 5 });
  assert.strictEqual(f, 13);
});

tests.push(() => {
  // train short
  const f = calculateFareForSegment({ mode: 'train', distance_km: 3 });
  assert.strictEqual(f, 13);
});

tests.push(() => {
  // motorcycle
  const f = calculateFareForSegment({ mode: 'motorcycle', distance_km: 2.3 });
  assert.strictEqual(f, 54);
});

tests.push(() => {
  const segments = [
    { mode: 'walk', distance_km: 0.2, fare_php: 0 },
    { mode: 'jeepney', distance_km: 5, fare_php: calculateFareForSegment({ mode: 'jeepney', distance_km: 5 }) }
  ];
  const total = calculateTotalFare(segments);
  assert.strictEqual(total, segments[1].fare_php);
});

module.exports = tests;
