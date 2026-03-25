const R = 6371000; // Earth radius in meters
const TO_RAD = Math.PI / 180;

export function haversineDistance(
  [lat1, lng1]: [number, number],
  [lat2, lng2]: [number, number],
): number {
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLng = (lng2 - lng1) * TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geodesic polygon area using equirectangular projection + Shoelace.
 * Accurate for fields (< ~100 km²).
 */
export function calculateArea(points: [number, number][]): number {
  if (points.length < 3) return 0;

  const latMid = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cosLat = Math.cos(latMid * TO_RAD);

  const xy = points.map(([lat, lng]) => [
    lng * TO_RAD * R * cosLat,
    lat * TO_RAD * R,
  ]);

  let area = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xy[i][0] * xy[j][1];
    area -= xy[j][0] * xy[i][1];
  }
  return Math.abs(area / 2);
}

export function calculatePerimeter(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let total = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    total += haversineDistance(points[i], points[(i + 1) % n]);
  }
  return total;
}

export function sqMetersToAcres(sqm: number): number {
  return sqm / 4046.856;
}
export function sqMetersToHectares(sqm: number): number {
  return sqm / 10000;
}
export function sqMetersToSqFeet(sqm: number): number {
  return sqm * 10.7639;
}
export function metersToMiles(m: number): number {
  return m / 1609.344;
}
export function metersToFeet(m: number): number {
  return m * 3.28084;
}
export function feetToInches(ft: number): number {
  return ft * 12;
}
export function metersToKaram(m: number, feetPerKaram: number): number {
  return metersToFeet(m) / feetPerKaram;
}
export function sqMetersToSqKaram(sqm: number, feetPerKaram: number): number {
  const sqFeet = sqm * 10.7639;
  return sqFeet / (feetPerKaram * feetPerKaram);
}

// Compute angle in degrees at `vertex` formed by rays to p1 and p2
export function computeAngle(
  vertex: [number, number],
  p1: [number, number],
  p2: [number, number],
): number {
  const toRad = Math.PI / 180;
  const lat0 = vertex[0] * toRad;
  const lng0 = vertex[1] * toRad;
  const lat1 = p1[0] * toRad;
  const lng1 = p1[1] * toRad;
  const lat2 = p2[0] * toRad;
  const lng2 = p2[1] * toRad;
  const v1 = [lat1 - lat0, (lng1 - lng0) * Math.cos(lat0)];
  const v2 = [lat2 - lat0, (lng2 - lng0) * Math.cos(lat0)];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
  const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return (
    (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI
  );
}

// Pakistani land units (based on sq feet)
// 1 Sarsi = 30.25 sq ft
// 1 Marla = 9 Sarsi = 272.25 sq ft
// 1 Kanal = 20 Marla = 5445 sq ft
// 1 Acre = 8 Kanal
export function sqMetersToMarla(sqm: number): number {
  return (sqm * 10.7639) / 272.25;
}
export function sqMetersToKanal(sqm: number): number {
  return (sqm * 10.7639) / 5445;
}
export function sqMetersToSarsi(sqm: number): number {
  return (sqm * 10.7639) / 30.25;
}
