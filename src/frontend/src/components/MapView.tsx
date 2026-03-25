import { LocateFixed } from "lucide-react";
/* global L */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OverlayItem } from "../App";
import {
  computeAngle,
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
const GOOGLE_SAT_URL = "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";

export type TileMode = "osm" | "satellite" | "hybrid" | "google";
export type DrawTool =
  | "polygon"
  | "polyline"
  | "line"
  | "rectangle"
  | "circle"
  | "angle";

interface MapViewProps {
  points: [number, number][];
  drawMode: boolean;
  editMode: boolean;
  tileMode: TileMode;
  fitBoundsKey: number;
  area: number;
  karamScale?: number;
  drawTool: DrawTool;
  searchTarget: { lat: number; lng: number; key: number } | null;
  overlays: OverlayItem[];
  onAddPoint: (lat: number, lng: number) => void;
  onSetPoints?: (points: [number, number][]) => void;
  onOverlayUpdate: (
    id: string,
    bounds: [[number, number], [number, number]],
    rotation: number,
    opacity: number,
  ) => void;
  onBoundsChange?: (bounds: [[number, number], [number, number]]) => void;
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
  const R = 6371000;
  const lat1 = (center[0] * Math.PI) / 180;
  const lng1 = (center[1] * Math.PI) / 180;
  const lat2 = (edge[0] * Math.PI) / 180;
  const lng2 = (edge[1] * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  const radius = 2 * R * Math.asin(Math.sqrt(a));

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
const EDIT_HANDLE_STYLE_ID = "terra-edit-handle-style";
const OVERLAY_HANDLE_STYLE_ID = "terra-overlay-handle-style";

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

function ensureEditHandleStyle() {
  if (document.getElementById(EDIT_HANDLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = EDIT_HANDLE_STYLE_ID;
  style.textContent = `
    .edit-handle {
      width: 14px;
      height: 14px;
      background: #f59e0b;
      border-radius: 50%;
      border: 2px solid #fff;
      cursor: grab;
      box-shadow: 0 0 0 2px rgba(245,158,11,0.4);
      transition: transform 0.1s;
    }
    .edit-handle:hover { transform: scale(1.4); cursor: grab; }
    .edit-handle:active { cursor: grabbing; }
  `;
  document.head.appendChild(style);
}

function ensureOverlayHandleStyle() {
  if (document.getElementById(OVERLAY_HANDLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = OVERLAY_HANDLE_STYLE_ID;
  style.textContent = `
    .overlay-handle {
      width: 12px;
      height: 12px;
      background: #a78bfa;
      border-radius: 3px;
      border: 2px solid #fff;
      cursor: move;
      box-shadow: 0 0 0 2px rgba(167,139,250,0.4);
    }
    .overlay-handle:hover { background: #c4b5fd; }
  `;
  document.head.appendChild(style);
}

export function MapView({
  points,
  drawMode,
  editMode,
  tileMode,
  fitBoundsKey,
  area,
  karamScale,
  drawTool,
  searchTarget,
  overlays,
  onAddPoint,
  onSetPoints,
  onOverlayUpdate,
  onBoundsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const baseTileRef = useRef<any>(null);
  const overlayTileRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const editGroupRef = useRef<any>(null);
  const overlayGroupRef = useRef<any>(null);
  const onAddPointRef = useRef(onAddPoint);
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);
  const onSetPointsRef = useRef(onSetPoints);
  const tempPointRef = useRef<[number, number] | null>(null);
  const pointsRef = useRef(points);
  const coordPopupRef = useRef<any>(null);
  const searchPinRef = useRef<any>(null);

  // GPS tracking refs
  const watchIdRef = useRef<number | null>(null);
  const gpsMarkerRef = useRef<any>(null);
  const gpsCircleRef = useRef<any>(null);
  const firstFixRef = useRef(true);

  const drawModeRef = useRef(drawMode);
  const editModeRef = useRef(editMode);

  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  useEffect(() => {
    onSetPointsRef.current = onSetPoints;
  }, [onSetPoints]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensureDistLabelStyle();
    ensureGpsPulseStyle();
    ensureEditHandleStyle();
    ensureOverlayHandleStyle();

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [40.7128, -74.006],
      13,
    );
    mapRef.current = map;

    const tileLayer = L.tileLayer(OSM_URL, {
      maxZoom: 22,
      maxNativeZoom: 19,
      attribution: "\u00a9 OpenStreetMap contributors",
    }).addTo(map);
    baseTileRef.current = tileLayer;

    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;

    const editGroup = L.layerGroup().addTo(map);
    editGroupRef.current = editGroup;

    const overlayGroup = L.layerGroup().addTo(map);
    overlayGroupRef.current = overlayGroup;

    // Coordinate popup on map click
    const coordPopup = L.popup({
      closeButton: true,
      className: "coord-popup",
    });
    coordPopupRef.current = coordPopup;

    const emitBounds = () => {
      if (onBoundsChangeRef.current) {
        const b = map.getBounds();
        onBoundsChangeRef.current([
          [b.getSouth(), b.getWest()],
          [b.getNorth(), b.getEast()],
        ]);
      }
    };
    map.on("moveend", emitBounds);
    emitBounds();

    map.on("click", (e: any) => {
      if (drawModeRef.current || editModeRef.current) return;
      const lat = (e.latlng.lat as number).toFixed(6);
      const lng = (e.latlng.lng as number).toFixed(6);
      const content = `
        <div style="font-family:monospace;font-size:12px;color:#E9EEF3;background:#2B3138;padding:8px 10px;border-radius:6px;min-width:180px">
          <div style="margin-bottom:4px;"><span style="color:#AAB3BD">Lat:</span> <b>${lat}</b></div>
          <div style="margin-bottom:8px;"><span style="color:#AAB3BD">Lng:</span> <b>${lng}</b></div>
          <button onclick="navigator.clipboard.writeText('${lat}, ${lng}').then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy Coordinates'},1200)})" style="background:#22C57A;color:#14181D;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:700;width:100%">Copy Coordinates</button>
        </div>
      `;
      coordPopup.setLatLng(e.latlng).setContent(content).openOn(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update cursor based on draw/edit mode
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current.getContainer() as HTMLElement;
    if (editMode) {
      container.style.cursor = "default";
    } else if (drawMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [drawMode, editMode]);

  // Click handler for drawing — re-attached when drawMode or drawTool changes
  useEffect(() => {
    if (!mapRef.current) return;
    tempPointRef.current = null;
    const map = mapRef.current;
    const handler = (e: any) => {
      if (!drawModeRef.current || editModeRef.current) return;
      const lat = e.latlng.lat as number;
      const lng = e.latlng.lng as number;

      if (drawTool === "rectangle") {
        if (!tempPointRef.current) {
          tempPointRef.current = [lat, lng];
        } else {
          const pts = rectanglePoints(tempPointRef.current, [lat, lng]);
          tempPointRef.current = null;
          onSetPointsRef.current?.(pts);
        }
        return;
      }

      if (drawTool === "circle") {
        if (!tempPointRef.current) {
          tempPointRef.current = [lat, lng];
        } else {
          const pts = circlePoints(tempPointRef.current, [lat, lng]);
          tempPointRef.current = null;
          onSetPointsRef.current?.(pts);
        }
        return;
      }

      onAddPointRef.current(lat, lng);
    };
    map.on("draw-click", handler);
    // We need a separate named handler to avoid clearing the coord popup handler
    // Use a dedicated event channel via a wrapper
    const drawClickWrapper = (e: any) => {
      if (!drawModeRef.current || editModeRef.current) return;
      handler(e);
    };
    map.on("click", drawClickWrapper);
    return () => {
      map.off("click", drawClickWrapper);
    };
  }, [drawTool]); // drawMode/editMode accessed via refs so not needed as deps

  // Edit handles — render draggable markers when editMode is active
  useEffect(() => {
    if (!editGroupRef.current) return;
    const group = editGroupRef.current;
    group.clearLayers();

    if (!editMode || points.length === 0) return;

    points.forEach((pt, idx) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="edit-handle"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker(pt, {
        icon,
        draggable: true,
        zIndexOffset: 2000,
      });
      marker.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const updated = pointsRef.current.map((p, i) =>
          i === idx ? ([lat, lng] as [number, number]) : p,
        );
        onSetPointsRef.current?.(updated);
      });
      marker.addTo(group);
    });
  }, [editMode, points]);

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
      baseTileRef.current.options.maxNativeZoom = 19;
    } else if (tileMode === "google") {
      baseTileRef.current.setUrl(GOOGLE_SAT_URL);
      baseTileRef.current.options.subdomains = ["0", "1", "2", "3"];
      baseTileRef.current.options.maxNativeZoom = 20;
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

    // Angle tool rendering
    if (drawTool === "angle" && points.length >= 2) {
      const [vertex, p1, p2] = points;
      L.circleMarker(vertex, {
        radius: 5,
        color: "#FFD700",
        fillColor: "#FFD700",
        fillOpacity: 1,
        weight: 2,
      }).addTo(group);
      if (p1)
        L.circleMarker(p1, {
          radius: 5,
          color: "#FFD700",
          fillColor: "#FFD700",
          fillOpacity: 1,
          weight: 2,
        }).addTo(group);
      if (p2) {
        L.circleMarker(p2, {
          radius: 5,
          color: "#FFD700",
          fillColor: "#FFD700",
          fillOpacity: 1,
          weight: 2,
        }).addTo(group);
        L.polyline([p1, vertex, p2], { color: "#FFD700", weight: 2 }).addTo(
          group,
        );
        L.circleMarker(vertex, {
          radius: 8,
          color: "#FFD700",
          fill: false,
          weight: 2,
        }).addTo(group);
        const angleDeg = computeAngle(vertex, p1, p2);
        L.tooltip({
          permanent: true,
          direction: "top",
          className: "dist-label",
        })
          .setContent(`\u2220 ${angleDeg.toFixed(1)}\u00b0`)
          .setLatLng(vertex)
          .addTo(group);
      } else if (p1) {
        L.polyline([vertex, p1], {
          color: "#FFD700",
          weight: 2,
          dashArray: "4 4",
        }).addTo(group);
      }
      return;
    }

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
          areaContent += `<br/>${sqKaram} karam\u00b2`;
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
    }

    // Segment distance labels for open paths
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

    // Segment distance labels for closed shapes
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

    // Vertex markers
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

  // Handle searchTarget — fly to location and drop a search pin
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by searchTarget.key
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return;
    const map = mapRef.current;
    const { lat, lng } = searchTarget;

    map.flyTo([lat, lng], 16, { duration: 1.2 });

    if (searchPinRef.current) {
      searchPinRef.current.remove();
      searchPinRef.current = null;
    }

    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:20px solid #ef4444;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));position:relative;top:-20px;"></div>`,
      iconSize: [16, 20],
      iconAnchor: [8, 20],
    });

    const marker = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 3000 });
    marker
      .bindPopup(
        `<div style="font-family:monospace;font-size:12px;color:#E9EEF3;background:#2B3138;padding:6px 10px;border-radius:6px">
          <b style="color:#ef4444">Search Result</b><br/>
          Lat: ${lat.toFixed(6)}<br/>Lng: ${lng.toFixed(6)}
        </div>`,
        { className: "coord-popup" },
      )
      .addTo(map)
      .openPopup();

    searchPinRef.current = marker;
  }, [searchTarget?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render image overlays
  useEffect(() => {
    if (!overlayGroupRef.current || !mapRef.current) return;
    const group = overlayGroupRef.current;
    group.clearLayers();

    for (const overlay of overlays) {
      const { id, dataUrl, bounds, opacity, rotation, blendMode } = overlay;

      const imgOverlay = L.imageOverlay(dataUrl, bounds, {
        opacity,
        interactive: false,
      }).addTo(group);

      // Apply CSS rotation and blend mode to the image element
      const applyStyles = () => {
        const el = imgOverlay.getElement() as HTMLElement | null;
        if (el) {
          el.style.transformOrigin = "center center";
          el.style.transform = `rotate(${rotation}deg)`;
          el.style.mixBlendMode = blendMode || "normal";
        }
      };
      imgOverlay.on("load", applyStyles);
      applyStyles();

      // Corner handles: NW, NE, SE, SW
      const sw = bounds[0];
      const ne = bounds[1];
      const corners: [number, number][] = [
        [ne[0], sw[1]], // NW
        [ne[0], ne[1]], // NE
        [sw[0], ne[1]], // SE
        [sw[0], sw[1]], // SW
      ];
      const cornerNames = ["NW", "NE", "SE", "SW"];

      corners.forEach((corner, ci) => {
        const icon = L.divIcon({
          className: "",
          html: `<div class="overlay-handle" title="${cornerNames[ci]}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const handle = L.marker(corner, {
          icon,
          draggable: true,
          zIndexOffset: 2500,
        });
        handle.on("drag", (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          // Update the corresponding corner and recompute bounds
          const updatedCorners = corners.map((c, i) =>
            i === ci ? [lat, lng] : c,
          ) as [number, number][];
          // NW=0,NE=1,SE=2,SW=3
          const newSouth = Math.min(updatedCorners[2][0], updatedCorners[3][0]);
          const newNorth = Math.max(updatedCorners[0][0], updatedCorners[1][0]);
          const newWest = Math.min(updatedCorners[0][1], updatedCorners[3][1]);
          const newEast = Math.max(updatedCorners[1][1], updatedCorners[2][1]);
          const newBounds: [[number, number], [number, number]] = [
            [newSouth, newWest],
            [newNorth, newEast],
          ];
          imgOverlay.setBounds(newBounds);
          onOverlayUpdate(id, newBounds, rotation, opacity);
        });
        handle.addTo(group);
      });
    }
  }, [overlays, onOverlayUpdate]);

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
