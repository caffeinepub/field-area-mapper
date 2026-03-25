const TO_RAD = Math.PI / 180;
const R = 6371000;

function toLocalXY(points: [number, number][]): { x: number; y: number }[] {
  const latMid = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lngMid = points.reduce((s, p) => s + p[1], 0) / points.length;
  const cosLat = Math.cos(latMid * TO_RAD);
  return points.map(([lat, lng]) => ({
    x: (lng - lngMid) * TO_RAD * R * cosLat,
    y: (lat - latMid) * TO_RAD * R,
  }));
}

export function generateDXF(points: [number, number][], area: number): string {
  if (points.length < 3) return "";
  const xy = toLocalXY(points);
  const vertexPairs = xy
    .map((p) => `10\n${p.x.toFixed(4)}\n20\n${p.y.toFixed(4)}`)
    .join("\n");
  const cx = xy.reduce((s, p) => s + p.x, 0) / xy.length;
  const cy = xy.reduce((s, p) => s + p.y, 0) / xy.length;

  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    "0",
    "LWPOLYLINE",
    "8",
    "0",
    "90",
    String(points.length),
    "70",
    "1",
    vertexPairs,
    "0",
    "TEXT",
    "8",
    "0",
    "10",
    cx.toFixed(4),
    "20",
    cy.toFixed(4),
    "30",
    "0",
    "40",
    String(Math.max(1, Math.sqrt(area) * 0.05)),
    "1",
    `Area: ${area.toFixed(2)} sq m`,
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");
}

export function generateCSV(points: [number, number][]): string {
  const header = "Point,Latitude,Longitude";
  const rows = points.map(
    ([lat, lng], i) => `${i + 1},${lat.toFixed(8)},${lng.toFixed(8)}`,
  );
  return [header, ...rows].join("\n");
}

export function downloadFile(
  content: string,
  filename: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
