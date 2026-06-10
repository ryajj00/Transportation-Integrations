const BASE_URL = process.env.COMMUTER_BACKEND_URL || 'http://10.0.2.2:3000';
// Note: use 10.0.2.2 for Android emulator to reach localhost on host machine.

const featureCache = new Map();

export async function fetchFeature(file, id) {
  const key = `${file}:${id}`;
  if (featureCache.has(key)) return featureCache.get(key);
  const url = `${BASE_URL}/api/feature?file=${encodeURIComponent(file)}&id=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feature fetch failed: ${res.status}`);
  const body = await res.json();
  featureCache.set(key, body.feature);
  return body.feature;
}
