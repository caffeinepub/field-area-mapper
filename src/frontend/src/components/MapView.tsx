import { LocateFixed } from "lucide-react";
/* global L */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  feetToInches,
  haversineDistance,
  metersToFeet,
  sqMetersToSqKaram,
} from "../utils/geomath";

declare const L: any;

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS_URL =
  "https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png";

export type TileMode = "osm" | "satellite" | "hybrid";
export type DrawTool = "polygon" | "polyline" | "line" | "rectangle" | "circle";

interface MapViewProps {
  points: [number, number][];
  drawMode: boolean;
  tileMode: TileMode;
  fitBoundsKey: number;
  area: number;
  karamScale?: number;
  drawTool: DrawTool;
  onAddPoint: (lat: number, lng: number) => void;
  onSetPoints?: (points: [number, number][]) => void;
}

function formatSegmentDistance(meters: number): string {
  const ft = metersToFeet(meters);
  if (ft < 100) {
    const wholeFt = Math.floor(ft);
    const inches = Math.round(feetToInches(ft - wholeFt));
    return `${wholeFt} ft ${inches} in`;
  }
  return `${ft.toFixed(1)} ft`;
}

/** Compute 32-point circle approximation from center + edge point */
function circlePoints(
  center: [number, number],
  edge: [number, number],
  numPts = 32,
): [number, number][] {
  const R = 6371000; // Earth radius in meters
  const lat1 = (center[0] * Math.PI) / 180;
  const lng1 = (center[1] * Math.PI) / 180;
  const lat2 = (edge[0] * Math.PI) / 180;
  const lng2 = (edge[1] * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  const radius = 2 * R * Math.asin(Math.sqrt(a)); // meters

  const pts: [number, number][] = [];
  for (let i = 0; i < numPts; i++) {
    const angle = (2 * Math.PI * i) / numPts;
    const dr = radius / R;
    const lat = Math.asin(
      Math.sin(lat1) * Math.cos(dr) +
        Math.cos(lat1) * Math.sin(dr) * Math.cos(angle),
    );
    const lng =
      lng1 +
      Math.atan2(
        Math.sin(angle) * Math.sin(dr) * Math.cos(lat1),
        Math.cos(dr) - Math.sin(lat1) * Math.sin(lat),
      );
    pts.push([(lat * 180) / Math.PI, (lng * 180) / Math.PI]);
  }
  return pts;
}

/** Compute 4-corner rectangle from two diagonal corners */
function rectanglePoints(
  a: [number, number],
  b: [number, number],
): [number, number][] {
  return [
    [a[0], a[1]],
    [a[0], b[1]],
    [b[0], b[1]],
    [b[0], a[1]],
  ];
}

const DIST_LABEL_STYLE_ID = "terra-dist-label-style";
const GPS_PULSE_STYLE_ID = "terra-gps-pulse-style";

function ensureDistLabelStyle() {
  if (document.getElementById(DIST_LABEL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DIST_LABEL_STYLE_ID;
  style.textContent = `
    .dist-label {
      background: rgba(20, 24, 29, 0.82) !important;
      border: none !important;
      box-shadow: none !important;
      color: #fff !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      padding: 2px 5px !important;
      border-radius: 3px !important;
      white-space: nowrap !important;
      pointer-events: none !important;
    }
    .dist-label::before { display: none !important; }
  `;
  document.head.appendChild(style);
}

function ensureGpsPulseStyle() {
  if (document.getElementById(GPS_PULSE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GPS_PULSE_STYLE_ID;
  style.textContent = `
    .gps-dot { width:14px; height:14px; background:#22C57A; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 0 rgba(34,197,122,0.4); animation: gps-pulse 1.5s infinite; }
    @keyframes gps-pulse { 0%{box-shadow:0 0 0 0 rgba(34,197,122,0.4)} 70%{box-shadow:0 0 0 12px rgba(34,197,122,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,122,0)} }
  `;
  document.head.appendChild(style);
}

export function MapView({
  points,
  drawMode,
  tileMode,
  fitBoundsKey,
  area,
  karamScale,
  drawTool,
  onAddPoint,
  onSetPoints,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const baseTileRef = useRef<any>(null);
  const overlayTileRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const onAddPointRef = useRef(onAddPoint);
  const onSetPointsRef = useRef(onSetPoints);
  const tempPointRef = useRef<[number, number] | null>(null);

  // GPS tracking refs
  const watchIdRef = useRef<number | null>(null);
  const gpsMarkerRef = useRef<any>(null);
  const gpsCircleRef = useRef<any>(null);
  const firstFixRef = useRef(true);

  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  useEffect(() => {
    onSetPointsRef.current = onSetPoints;
  }, [onSetPoints]);

  // Initialize map once (empty deps is intentional)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensureDistLabelStyle();
    ensureGpsPulseStyle();

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [40.7128, -74.006],
      13,
    );
    mapRef.current = map;

    const tileLayer = L.tileLayer(OSM_URL, {
      maxZoom: 20,
      attribution: "\u00a9 OpenStreetMap contributors",
    }).addTo(map);
    baseTileRef.current = tileLayer;

    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update cursor based on draw mode
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current.getContainer() as HTMLElement;
    container.style.cursor = drawMode ? "crosshair" : "";
  }, [drawMode]);

  // Click handler — re-attached when drawMode or drawTool changes
  useEffect(() => {
    if (!mapRef.current) return;
    // Reset temp point when tool or mode changes
    tempPointRef.current = null;
    const map = mapRef.current;
    const handler = (e: any) => {
      if (!drawMode) return;
      const lat = e.latlng.lat as number;
      const lng = e.latlng.lng as number;

      if (drawTool === "rectangle") {
        if (!tempPointRef.current) {
          // First corner
          tempPointRef.current = [lat, lng];
        } else {
          // Second corner — compute rectangle
          const pts = rectanglePoints(tempPointRef.current, [lat, lng]);
          tempPointRef.current = null;
          onSetPointsRef.current?.(pts);
        }
        return;
      }

      if (drawTool === "circle") {
        if (!tempPointRef.current) {
          // Center
          tempPointRef.current = [lat, lng];
        } else {
          // Edge — compute circle approximation
          const pts = circlePoints(tempPointRef.current, [lat, lng]);
          tempPointRef.current = null;
          onSetPointsRef.current?.(pts);
        }
        return;
      }

      // polygon, polyline, line
      onAddPointRef.current(lat, lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [drawMode, drawTool]);

  // Update tile layers
  useEffect(() => {
    if (!mapRef.current || !baseTileRef.current) return;
    const map = mapRef.current;

    if (overlayTileRef.current) {
      overlayTileRef.current.remove();
      overlayTileRef.current = null;
    }

    if (tileMode === "osm") {
      baseTileRef.current.setUrl(OSM_URL);
    } else if (tileMode === "satellite") {
      baseTileRef.current.setUrl(SAT_URL);
    } else {
      baseTileRef.current.setUrl(SAT_URL);
      overlayTileRef.current = L.tileLayer(LABELS_URL, {
        maxZoom: 20,
        opacity: 0.7,
      }).addTo(map);
    }
  }, [tileMode]);

  // Render polygon/polyline/markers
  useEffect(() => {
    if (!mapRef.current || !layersGroupRef.current) return;
    const group = layersGroupRef.current;
    group.clearLayers();

    if (points.length === 0) return;

    const GREEN = "#22C57A";

    const isClosedShape =
      drawTool === "polygon" ||
      drawTool === "rectangle" ||
      drawTool === "circle";
    const isOpenPath = drawTool === "polyline" || drawTool === "line";

    if (points.length >= 3 && isClosedShape) {
      L.polygon(points, {
        color: GREEN,
        weight: 2.5,
        fillColor: GREEN,
        fillOpacity: 0.22,
      }).addTo(group);

      if (area > 0) {
        const acres = (area / 4046.856).toFixed(2);
        const bounds = L.latLngBounds(points);
        const center = bounds.getCenter();

        let areaContent = `Area: ${acres} ac`;
        if (karamScale && karamScale > 0) {
          const sqKaram = sqMetersToSqKaram(area, karamScale).toFixed(2);
          areaContent += `<br/>${sqKaram} karam²`;
        }

        L.tooltip({
          permanent: true,
          direction: "center",
          className: "area-tooltip",
          offset: [0, 0],
        })
          .setContent(areaContent)
          .setLatLng(center)
          .addTo(group);
      }
    } else if (isOpenPath && points.length >= 2) {
      L.polyline(points, { color: GREEN, weight: 2.5 }).addTo(group);

      // Total distance label at midpoint of last segment
      let totalDist = 0;
      for (let i = 0; i < points.length - 1; i++) {
        totalDist += haversineDistance(points[i], points[i + 1]);
      }
      const mid = points[Math.floor(points.length / 2)];
      L.tooltip({
        permanent: true,
        direction: "top",
        className: "dist-label",
      })
        .setContent(`Total: ${formatSegmentDistance(totalDist)}`)
        .setLatLng(mid)
        .addTo(group);
    } else if (points.length === 2 && isClosedShape) {
      L.polyline(points, { color: GREEN, weight: 2.5 }).addTo(group);
    } else if (points.length === 1 && isClosedShape) {
      // single point - just marker below
    }

    // Draw segment distance labels for open paths
    if (isOpenPath) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const midLat = (a[0] + b[0]) / 2;
        const midLng = (a[1] + b[1]) / 2;
        const dist = haversineDistance(a, b);
        const label = formatSegmentDistance(dist);
        L.tooltip({
          permanent: true,
          direction: "center",
          className: "dist-label",
        })
          .setContent(label)
          .setLatLng([midLat, midLng])
          .addTo(group);
      }
    }

    // Draw segment distance labels for closed shapes
    if (isClosedShape && points.length >= 3) {
      const segmentPoints = [...points, points[0]];
      for (let i = 0; i < segmentPoints.length - 1; i++) {
        const a = segmentPoints[i];
        const b = segmentPoints[i + 1];
        const midLat = (a[0] + b[0]) / 2;
        const midLng = (a[1] + b[1]) / 2;
        const dist = haversineDistance(a, b);
        const label = formatSegmentDistance(dist);
        L.tooltip({
          permanent: true,
          direction: "center",
          className: "dist-label",
        })
          .setContent(label)
          .setLatLng([midLat, midLng])
          .addTo(group);
      }
    }

    // Vertex markers (skip for circle/rectangle which have many points)
    const showVertices =
      drawTool === "polygon" || drawTool === "polyline" || drawTool === "line";
    if (showVertices) {
      for (const pt of points) {
        L.circleMarker(pt, {
          radius: 5,
          color: GREEN,
          fillColor: GREEN,
          fillOpacity: 1,
          weight: 2,
        }).addTo(group);
      }
    }

    // Dashed closing line for polygon during drawing
    if (isClosedShape && points.length > 2) {
      L.polyline([points[points.length - 1], points[0]], {
        color: GREEN,
        weight: 1.5,
        dashArray: "6 4",
        opacity: 0.6,
      }).addTo(group);
    }
  }, [points, area, karamScale, drawTool]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on key change
  useEffect(() => {
    if (!mapRef.current || points.length < 2 || fitBoundsKey === 0) return;
    mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [fitBoundsKey]);

  // Cleanup GPS on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.remove();
      gpsMarkerRef.current = null;
    }
    if (gpsCircleRef.current) {
      gpsCircleRef.current.remove();
      gpsCircleRef.current = null;
    }
    firstFixRef.current = true;
    setIsTracking(false);
  }

  function startTracking() {
    if (!navigator.geolocation) {
      toast.error("GPS not available");
      return;
    }

    firstFixRef.current = true;
    setIsTracking(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const map = mapRef.current;
        if (!map) return;

        if (firstFixRef.current) {
          map.setView([lat, lng], 16);
          firstFixRef.current = false;
        }

        if (gpsMarkerRef.current) {
          gpsMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            className: "",
            html: `<div class="gps-dot"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          gpsMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }

        if (gpsCircleRef.current) {
          gpsCircleRef.current.setLatLng([lat, lng]);
          gpsCircleRef.current.setRadius(accuracy);
        } else {
          gpsCircleRef.current = L.circle([lat, lng], {
            radius: accuracy,
            color: "#4A90D9",
            fillColor: "#4A90D9",
            fillOpacity: 0.15,
            weight: 1.5,
          }).addTo(map);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("GPS not available");
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    watchIdRef.current = watchId;
  }

  function handleLocateClick() {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - 56px)",
        width: "100%",
      }}
    >
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
        data-ocid="map.canvas_target"
      />
      <button
        type="button"
        onClick={handleLocateClick}
        data-ocid="map.locate_button"
        title={isTracking ? "Stop tracking" : "Locate Me"}
        style={{
          position: "absolute",
          top: 80,
          right: 10,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "#2B3138",
          border: "1px solid #3A424C",
          borderRadius: 6,
          color: isTracking ? "#22C57A" : "#cbd5e1",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          transition: "color 0.2s",
        }}
      >
        <LocateFixed
          size={14}
          style={{
            color: isTracking ? "#22C57A" : "#cbd5e1",
            animation: isTracking ? "gps-pulse 1.5s infinite" : "none",
          }}
        />
        {isTracking ? "Tracking..." : "Locate Me"}
      </button>
    </div>
  );
}
