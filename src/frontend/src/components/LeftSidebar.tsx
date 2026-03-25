import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCheck,
  Circle,
  Edit3,
  FileDown,
  FileText,
  Hexagon,
  Image,
  Layers,
  Minus,
  Route,
  Ruler,
  Save,
  Search,
  Square,
  Trash2,
  Triangle,
  Undo2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { OverlayItem } from "../App";
import { downloadFile, generateCSV, generateDXF } from "../utils/dxf";
import {
  calculateArea,
  calculatePerimeter,
  feetToInches,
  metersToFeet,
  metersToKaram,
  metersToMiles,
  sqMetersToAcres,
  sqMetersToHectares,
  sqMetersToKanal,
  sqMetersToMarla,
  sqMetersToSarsi,
  sqMetersToSqFeet,
  sqMetersToSqKaram,
} from "../utils/geomath";
import type { DrawTool, TileMode } from "./MapView";

interface LeftSidebarProps {
  points: [number, number][];
  drawMode: boolean;
  editMode: boolean;
  tileMode: TileMode;
  projectName: string;
  isSaving: boolean;
  karamScale: number;
  drawTool: DrawTool;
  overlays: OverlayItem[];
  onKaramScaleChange: (value: number) => void;
  onTileModeChange: (mode: TileMode) => void;
  onToggleDrawMode: () => void;
  onToggleEditMode: () => void;
  onUndo: () => void;
  onClosePolygon: () => void;
  onClear: () => void;
  onSave: () => void;
  onRemovePoint: (idx: number) => void;
  onProjectNameChange: (name: string) => void;
  onSearchGPS: (query: string) => void;
  onDrawToolChange: (tool: DrawTool) => void;
  onLatLngJump: (lat: number, lng: number) => void;
  onAddOverlay: (item: OverlayItem) => void;
  onUpdateOverlay: (
    id: string,
    updates: Partial<
      Pick<
        OverlayItem,
        "bounds" | "opacity" | "rotation" | "blendMode" | "scale"
      >
    >,
  ) => void;
  mapBounds: [[number, number], [number, number]] | null;
  onRemoveOverlay: (id: string) => void;
}

const DRAW_TOOLS: {
  tool: DrawTool;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    tool: "polygon",
    label: "Polygon",
    icon: <Hexagon size={13} />,
    desc: "Filled closed shape",
  },
  {
    tool: "polyline",
    label: "Polyline",
    icon: <Route size={13} />,
    desc: "Open multi-segment path",
  },
  {
    tool: "line",
    label: "Line",
    icon: <Minus size={13} />,
    desc: "Single straight line",
  },
  {
    tool: "rectangle",
    label: "Rectangle",
    icon: <Square size={13} />,
    desc: "4-corner rectangle",
  },
  {
    tool: "circle",
    label: "Circle",
    icon: <Circle size={13} />,
    desc: "Radius-based circle",
  },
  {
    tool: "angle" as DrawTool,
    label: "Angle",
    icon: <Triangle size={13} />,
    desc: "Measure angle between 3 points",
  },
];

export function LeftSidebar({
  points,
  drawMode,
  editMode,
  tileMode,
  projectName,
  isSaving,
  karamScale,
  drawTool,
  overlays,
  onKaramScaleChange,
  onTileModeChange,
  onToggleDrawMode,
  onToggleEditMode,
  onUndo,
  onClosePolygon,
  onClear,
  onSave,
  onRemovePoint,
  onProjectNameChange,
  onSearchGPS,
  onDrawToolChange,
  onLatLngJump,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  mapBounds,
}: LeftSidebarProps) {
  const area = calculateArea(points);
  const perimeter = calculatePerimeter(points);
  const acres = sqMetersToAcres(area);
  const hectares = sqMetersToHectares(area);
  const sqFeet = sqMetersToSqFeet(area);
  const perimeterMiles = metersToMiles(perimeter);
  const perimeterFeet = metersToFeet(perimeter);
  const perimeterWholeFt = Math.floor(perimeterFeet);
  const perimeterRemainIn = Math.round(
    feetToInches(perimeterFeet - perimeterWholeFt),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [jumpLat, setJumpLat] = useState("");
  const [jumpLng, setJumpLng] = useState("");
  const [pdfPagePicker, setPdfPagePicker] = useState<{
    totalPages: number;
    currentPage: number;
    pdfDoc: any;
    fileName: string;
  } | null>(null);

  const karamFt = karamScale > 0 ? karamScale : 5.5;
  const karamWholeFt = Math.floor(karamFt);
  const karamRemainIn = Math.round(feetToInches(karamFt - karamWholeFt));

  function handleExportDXF() {
    if (points.length < 3) {
      toast.error("Draw a polygon with at least 3 points first");
      return;
    }
    const dxf = generateDXF(points, area);
    downloadFile(dxf, "field-export.dxf", "application/dxf");
    toast.success("DXF file downloaded");
  }

  function handleExportCSV() {
    if (points.length === 0) {
      toast.error("No points to export");
      return;
    }
    const csv = generateCSV(points);
    downloadFile(csv, "field-coordinates.csv", "text/csv");
    toast.success("CSV file downloaded");
  }

  function handleLatLngJump() {
    const lat = Number.parseFloat(jumpLat);
    const lng = Number.parseFloat(jumpLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Enter valid latitude and longitude");
      return;
    }
    if (lat < -90 || lat > 90) {
      toast.error("Latitude must be between -90 and 90");
      return;
    }
    if (lng < -180 || lng > 180) {
      toast.error("Longitude must be between -180 and 180");
      return;
    }
    onLatLngJump(lat, lng);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const label = `Image ${overlays.filter((o) => o.type === "image").length + 1}`;
      const id = `overlay-${Date.now()}`;
      onAddOverlay({
        id,
        type: "image",
        dataUrl,
        label,
        bounds: [
          [0, 0],
          [0, 0],
        ], // will be replaced in App.tsx
        opacity: 0.8,
        rotation: 0,
        blendMode: "normal",
        scale: 100,
      });
      toast.success(`${label} added to map`);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  async function renderPdfPage(pdfDoc: any, pageNum: number, fileName: string) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");

      const label = `PDF p${pageNum} (${fileName.slice(0, 12)})`;
      const id = `overlay-${Date.now()}`;
      onAddOverlay({
        id,
        type: "pdf",
        dataUrl,
        label,
        bounds: [
          [0, 0],
          [0, 0],
        ],
        opacity: 0.8,
        rotation: 0,
        blendMode: "normal",
        scale: 100,
      });
      setPdfPagePicker(null);
      toast.success(`PDF page ${pageNum} added to map`);
    } catch {
      toast.error("Failed to render PDF page");
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const w = window as any;
    if (!w.pdfjsLib) {
      toast.error("PDF.js not loaded. Please refresh.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await w.pdfjsLib.getDocument({ data: arrayBuffer })
        .promise;
      const totalPages = pdfDoc.numPages;

      if (totalPages === 1) {
        await renderPdfPage(pdfDoc, 1, file.name);
      } else {
        setPdfPagePicker({
          totalPages,
          currentPage: 1,
          pdfDoc,
          fileName: file.name,
        });
      }
    } catch {
      toast.error("Failed to load PDF");
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 280,
        background: "#2B3138",
        borderRight: "1px solid #3A424C",
        flexShrink: 0,
      }}
    >
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Project Name */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Project Name
            </p>
            <Input
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Unnamed Field"
              className="h-8 text-sm bg-background border-border"
              data-ocid="project.input"
            />
          </section>

          <Separator className="opacity-30" />

          {/* Imagery Mode */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Layers size={12} /> Imagery
            </p>
            <div
              className="flex rounded"
              style={{ background: "#1F242A", padding: 2 }}
              data-ocid="map.tab"
            >
              {(["osm", "satellite", "hybrid", "google"] as TileMode[]).map(
                (m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => onTileModeChange(m)}
                    className="flex-1 text-xs py-1 rounded transition-all"
                    style={{
                      background: tileMode === m ? "#22C57A" : "transparent",
                      color: tileMode === m ? "#14181D" : "#AAB3BD",
                      fontWeight: tileMode === m ? 700 : 400,
                    }}
                  >
                    {m === "osm"
                      ? "OSM"
                      : m === "satellite"
                        ? "ESRI Sat"
                        : m === "hybrid"
                          ? "Hybrid"
                          : "Google"}
                  </button>
                ),
              )}
            </div>
          </section>

          {/* Search */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Search size={12} /> Search Location
            </p>
            <div className="flex gap-1.5 mb-2">
              <Input
                ref={searchRef}
                placeholder="Search address or GPS\u2026"
                className="h-8 text-xs bg-background border-border flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSearchGPS((e.target as HTMLInputElement).value);
                  }
                }}
                data-ocid="map.search_input"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2"
                style={{ background: "#3A424C", color: "#E9EEF3" }}
                onClick={() => onSearchGPS(searchRef.current?.value ?? "")}
                data-ocid="map.button"
              >
                <Search size={13} />
              </Button>
            </div>

            {/* Lat/Long Jump */}
            <div
              className="rounded p-2 space-y-1.5"
              style={{ background: "#1F242A", border: "1px solid #3A424C" }}
            >
              <p className="text-xs font-semibold" style={{ color: "#AAB3BD" }}>
                Jump to Coordinates
              </p>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  placeholder="Latitude"
                  value={jumpLat}
                  onChange={(e) => setJumpLat(e.target.value)}
                  className="h-7 text-xs bg-background border-border flex-1"
                  data-ocid="map.search_input"
                />
                <Input
                  type="number"
                  placeholder="Longitude"
                  value={jumpLng}
                  onChange={(e) => setJumpLng(e.target.value)}
                  className="h-7 text-xs bg-background border-border flex-1"
                  data-ocid="map.search_input"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-7 w-full text-xs"
                style={{ background: "#3A424C", color: "#E9EEF3" }}
                onClick={handleLatLngJump}
                data-ocid="map.primary_button"
              >
                Go to Location
              </Button>
            </div>
          </section>

          <Separator className="opacity-30" />

          {/* Map Overlays */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Image size={12} /> Map Overlays
            </p>

            <div className="flex gap-1.5 mb-2">
              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs gap-1"
                style={{ background: "#3A424C", color: "#E9EEF3" }}
                onClick={() => imageInputRef.current?.click()}
                data-ocid="overlay.upload_button"
              >
                <Image size={12} /> Image
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs gap-1"
                style={{ background: "#3A424C", color: "#E9EEF3" }}
                onClick={() => pdfInputRef.current?.click()}
                data-ocid="overlay.upload_button"
              >
                <FileText size={12} /> PDF
              </Button>
            </div>

            {/* PDF Page Picker */}
            {pdfPagePicker && (
              <div
                className="rounded p-2.5 mb-2 space-y-2"
                style={{
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.3)",
                }}
                data-ocid="overlay.dialog"
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#a78bfa" }}
                >
                  PDF has {pdfPagePicker.totalPages} pages — pick one:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={pdfPagePicker.totalPages}
                    value={pdfPagePicker.currentPage}
                    onChange={(e) => {
                      const v = Number.parseInt(e.target.value, 10);
                      if (v >= 1 && v <= pdfPagePicker.totalPages) {
                        setPdfPagePicker((prev) =>
                          prev ? { ...prev, currentPage: v } : prev,
                        );
                      }
                    }}
                    className="h-7 w-16 text-xs text-center bg-background border-border"
                    data-ocid="overlay.input"
                  />
                  <span className="text-xs text-muted-foreground">
                    / {pdfPagePicker.totalPages}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    style={{ background: "#a78bfa", color: "#1a0a2e" }}
                    onClick={() =>
                      renderPdfPage(
                        pdfPagePicker.pdfDoc,
                        pdfPagePicker.currentPage,
                        pdfPagePicker.fileName,
                      )
                    }
                    data-ocid="overlay.confirm_button"
                  >
                    Use This Page
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2"
                    style={{ background: "#3A424C", color: "#E9EEF3" }}
                    onClick={() => setPdfPagePicker(null)}
                    data-ocid="overlay.cancel_button"
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            )}

            {/* Active Overlays */}
            {overlays.length === 0 ? (
              <div
                className="rounded p-2 text-center text-xs text-muted-foreground"
                style={{ background: "#1F242A" }}
                data-ocid="overlay.empty_state"
              >
                No overlays yet
              </div>
            ) : (
              <div className="space-y-2" data-ocid="overlay.list">
                {overlays.map((overlay, idx) => (
                  <div
                    key={overlay.id}
                    className="rounded p-2 space-y-1.5"
                    style={{
                      background: "#1F242A",
                      border: "1px solid #3A424C",
                    }}
                    data-ocid={`overlay.item.${idx + 1}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: "#a78bfa", maxWidth: 160 }}
                      >
                        {overlay.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveOverlay(overlay.id)}
                        className="text-muted-foreground hover:text-destructive"
                        data-ocid={`overlay.delete_button.${idx + 1}`}
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {/* Opacity */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">
                        Opacity
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(overlay.opacity * 100)}
                        onChange={(e) =>
                          onUpdateOverlay(overlay.id, {
                            opacity: Number(e.target.value) / 100,
                          })
                        }
                        className="flex-1 h-1.5 accent-violet-400"
                        data-ocid={`overlay.toggle.${idx + 1}`}
                      />
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(overlay.opacity * 100)}%
                      </span>
                    </div>

                    {/* Rotation */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">
                        Rotate
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={360}
                        value={overlay.rotation}
                        onChange={(e) =>
                          onUpdateOverlay(overlay.id, {
                            rotation: Number(e.target.value) % 360,
                          })
                        }
                        className="h-6 text-xs bg-background border-border flex-1"
                        data-ocid={`overlay.input.${idx + 1}`}
                      />
                      <span className="text-xs text-muted-foreground">°</span>
                    </div>

                    {/* Scale */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">
                        Scale
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOverlay(overlay.id, {
                            scale: Math.max(10, (overlay.scale || 100) - 10),
                          })
                        }
                        className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center hover:bg-violet-500/20"
                        style={{
                          background: "#2A3140",
                          color: "#a78bfa",
                          border: "1px solid #3A424C",
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={overlay.scale || 100}
                        onChange={(e) =>
                          onUpdateOverlay(overlay.id, {
                            scale: Math.min(
                              500,
                              Math.max(10, Number(e.target.value)),
                            ),
                          })
                        }
                        className="flex-1 h-6 text-xs text-center rounded border"
                        style={{
                          background: "#2A3140",
                          color: "#E9EEF3",
                          border: "1px solid #3A424C",
                        }}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOverlay(overlay.id, {
                            scale: Math.min(500, (overlay.scale || 100) + 10),
                          })
                        }
                        className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center hover:bg-violet-500/20"
                        style={{
                          background: "#2A3140",
                          color: "#a78bfa",
                          border: "1px solid #3A424C",
                        }}
                      >
                        +
                      </button>
                    </div>

                    {/* Blend Mode */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">
                        Blend
                      </span>
                      <select
                        value={overlay.blendMode || "normal"}
                        onChange={(e) =>
                          onUpdateOverlay(overlay.id, {
                            blendMode: e.target.value,
                          })
                        }
                        className="flex-1 h-6 text-xs rounded border"
                        style={{
                          background: "#2A3140",
                          color: "#E9EEF3",
                          border: "1px solid #3A424C",
                        }}
                      >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                      </select>
                    </div>

                    {/* Alignment helpers */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">
                        Align
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          ["Center", "Top", "Bottom", "Left", "Right"] as const
                        ).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            disabled={!mapBounds}
                            onClick={() => {
                              if (!mapBounds) return;
                              const [[s, w], [n, e]] = overlay.bounds;
                              const [[ms, mw], [mn, me]] = mapBounds;
                              const halfH = (n - s) / 2;
                              const halfW = (e - w) / 2;
                              const mapCLat = (mn + ms) / 2;
                              const mapCLng = (me + mw) / 2;
                              const curCLng = (e + w) / 2;
                              const curCLat = (n + s) / 2;
                              let newS = s;
                              let newN = n;
                              let newW = w;
                              let newE = e;
                              if (dir === "Center") {
                                newS = mapCLat - halfH;
                                newN = mapCLat + halfH;
                                newW = mapCLng - halfW;
                                newE = mapCLng + halfW;
                              } else if (dir === "Top") {
                                newN = mn;
                                newS = mn - halfH * 2;
                                newW = curCLng - halfW;
                                newE = curCLng + halfW;
                              } else if (dir === "Bottom") {
                                newS = ms;
                                newN = ms + halfH * 2;
                                newW = curCLng - halfW;
                                newE = curCLng + halfW;
                              } else if (dir === "Left") {
                                newW = mw;
                                newE = mw + halfW * 2;
                                newS = curCLat - halfH;
                                newN = curCLat + halfH;
                              } else {
                                newE = me;
                                newW = me - halfW * 2;
                                newS = curCLat - halfH;
                                newN = curCLat + halfH;
                              }
                              onUpdateOverlay(overlay.id, {
                                bounds: [
                                  [newS, newW],
                                  [newN, newE],
                                ],
                              });
                            }}
                            className="text-xs px-2 py-0.5 rounded hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              background: "#2A3140",
                              color: "#a78bfa",
                              border: "1px solid #3A424C",
                            }}
                          >
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator className="opacity-30" />

          {/* Scale / Karam */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Ruler size={12} /> Scale (Karam)
            </p>
            <div
              className="rounded p-2.5 space-y-2"
              style={{ background: "#1F242A" }}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={karamScale}
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) onKaramScaleChange(v);
                  }}
                  className="h-7 w-20 text-xs bg-background border-border text-center"
                  data-ocid="karam.input"
                />
                <span className="text-xs text-muted-foreground">
                  feet = 1 karam
                </span>
              </div>
              <div
                className="text-xs rounded px-2 py-1"
                style={{
                  background: "rgba(34,197,122,0.08)",
                  color: "#22C57A",
                }}
              >
                1 karam = {karamFt.toFixed(1)} ft ({karamWholeFt} ft{" "}
                {karamRemainIn} in)
              </div>
            </div>
          </section>

          <Separator className="opacity-30" />

          {/* Drawing Tools */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Hexagon size={12} /> Drawing Tools
            </p>

            <div className="grid grid-cols-5 gap-1 mb-2">
              {DRAW_TOOLS.map(({ tool, label, icon }) => (
                <button
                  key={tool}
                  type="button"
                  title={label}
                  onClick={() => onDrawToolChange(tool)}
                  className="flex flex-col items-center justify-center gap-0.5 rounded py-1.5 transition-all"
                  style={{
                    background: drawTool === tool ? "#22C57A" : "#1F242A",
                    color: drawTool === tool ? "#14181D" : "#AAB3BD",
                    border:
                      drawTool === tool
                        ? "1px solid #22C57A"
                        : "1px solid #3A424C",
                    fontSize: 9,
                    fontWeight: drawTool === tool ? 700 : 400,
                  }}
                  data-ocid={`tools.${tool}.toggle`}
                >
                  {icon}
                  <span style={{ fontSize: 8, lineHeight: 1 }}>{label}</span>
                </button>
              ))}
            </div>

            <div
              className="text-xs rounded px-2 py-1 mb-2 flex items-center gap-1.5"
              style={{
                background: drawMode
                  ? "rgba(34,197,122,0.1)"
                  : editMode
                    ? "rgba(245,158,11,0.1)"
                    : "rgba(255,255,255,0.03)",
                border: drawMode
                  ? "1px solid rgba(34,197,122,0.4)"
                  : editMode
                    ? "1px solid rgba(245,158,11,0.4)"
                    : "1px solid #3A424C",
                color: drawMode ? "#22C57A" : editMode ? "#f59e0b" : "#7E8994",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {editMode ? (
                  <Edit3 size={12} />
                ) : (
                  DRAW_TOOLS.find((t) => t.tool === drawTool)?.icon
                )}
              </span>
              <span>
                {editMode
                  ? "Edit mode — drag points"
                  : DRAW_TOOLS.find((t) => t.tool === drawTool)?.desc}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1 col-span-2"
                onClick={onToggleDrawMode}
                disabled={editMode}
                style={{
                  background: drawMode ? "#22C57A" : "#3A424C",
                  color: drawMode ? "#14181D" : "#E9EEF3",
                  border: "none",
                  opacity: editMode ? 0.4 : 1,
                }}
                data-ocid="tools.toggle"
              >
                {DRAW_TOOLS.find((t) => t.tool === drawTool)?.icon}
                {drawMode
                  ? "Drawing \u2014 click to stop"
                  : `Start Drawing (${DRAW_TOOLS.find((t) => t.tool === drawTool)?.label})`}
              </Button>

              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1 col-span-2"
                onClick={onToggleEditMode}
                disabled={points.length === 0}
                style={{
                  background: editMode ? "#f59e0b" : "#3A424C",
                  color: editMode ? "#1a0f00" : "#E9EEF3",
                  border: editMode
                    ? "1px solid #d97706"
                    : "1px solid transparent",
                  fontWeight: editMode ? 700 : 400,
                }}
                data-ocid="tools.edit_button"
              >
                <Edit3 size={12} />
                {editMode ? "Done Editing" : "Edit Points"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-border"
                onClick={onUndo}
                disabled={points.length === 0}
                style={{
                  background: "#3A424C",
                  color: "#E9EEF3",
                  border: "none",
                }}
                data-ocid="tools.secondary_button"
              >
                <Undo2 size={12} /> Undo
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={onClosePolygon}
                disabled={points.length < 3}
                style={{
                  background: "#3A424C",
                  color: "#E9EEF3",
                  border: "none",
                }}
                data-ocid="tools.primary_button"
              >
                <CheckCheck size={12} /> Close
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1 col-span-2"
                onClick={onClear}
                disabled={points.length === 0}
                style={{
                  background: "rgba(239,68,68,0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
                data-ocid="tools.delete_button"
              >
                <Trash2 size={12} /> Clear All
              </Button>
            </div>
          </section>

          <Separator className="opacity-30" />

          {/* Measurement Output */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Measurements
            </p>
            {points.length >= 3 ? (
              <div className="space-y-2">
                <div
                  className="rounded p-3 text-center"
                  style={{
                    background: "rgba(34,197,122,0.08)",
                    border: "1px solid rgba(34,197,122,0.3)",
                  }}
                >
                  <div
                    className="font-bold leading-none"
                    style={{ fontSize: 28, color: "#22C57A" }}
                  >
                    {acres.toFixed(3)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    acres
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div className="font-semibold text-foreground">
                      {hectares.toFixed(4)}
                    </div>
                    <div className="text-muted-foreground">ha</div>
                  </div>
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div className="font-semibold text-foreground">
                      {area.toFixed(1)}
                    </div>
                    <div className="text-muted-foreground">m\u00b2</div>
                  </div>
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div className="font-semibold text-foreground">
                      {sqFeet.toFixed(0)}
                    </div>
                    <div className="text-muted-foreground">ft\u00b2</div>
                  </div>
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div className="font-semibold text-foreground">
                      {perimeter.toFixed(1)}
                    </div>
                    <div className="text-muted-foreground">m perimeter</div>
                  </div>
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div className="font-semibold text-foreground">
                      {perimeterFeet.toFixed(1)}
                    </div>
                    <div className="text-muted-foreground">ft perimeter</div>
                  </div>
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#1F242A" }}
                  >
                    <div
                      className="font-semibold text-foreground"
                      style={{ fontSize: 11 }}
                    >
                      {perimeterWholeFt} ft {perimeterRemainIn} in
                    </div>
                    <div className="text-muted-foreground">perimeter</div>
                  </div>
                </div>

                <div
                  className="rounded p-2 text-xs flex justify-between"
                  style={{ background: "#1F242A" }}
                >
                  <span className="text-muted-foreground">Perimeter</span>
                  <span className="text-foreground font-medium">
                    {perimeterMiles.toFixed(3)} mi
                  </span>
                </div>

                {karamScale > 0 && (
                  <div
                    className="rounded p-2.5 space-y-1.5"
                    style={{
                      background: "rgba(34,197,122,0.06)",
                      border: "1px solid rgba(34,197,122,0.2)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "#22C57A" }}
                    >
                      Karam Scale ({karamScale} ft/karam)
                    </p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Area</span>
                      <span className="text-foreground font-medium">
                        {sqMetersToSqKaram(area, karamScale).toFixed(2)}{" "}
                        karam\u00b2
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Perimeter</span>
                      <span className="text-foreground font-medium">
                        {metersToKaram(perimeter, karamScale).toFixed(2)} karam
                      </span>
                    </div>
                  </div>
                )}

                {points.length >= 3 && (
                  <div
                    className="rounded p-2.5 space-y-1.5 mt-2"
                    style={{
                      background: "rgba(59,130,246,0.07)",
                      border: "1px solid rgba(59,130,246,0.25)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "#60a5fa" }}
                    >
                      Jammu &amp; Kashmir Government Revenue Scale
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div
                        className="rounded p-1.5 text-center"
                        style={{ background: "#1F242A" }}
                      >
                        <div className="font-semibold text-foreground">
                          {sqMetersToKanal(area).toFixed(3)}
                        </div>
                        <div className="text-muted-foreground">Kanal</div>
                      </div>
                      <div
                        className="rounded p-1.5 text-center"
                        style={{ background: "#1F242A" }}
                      >
                        <div className="font-semibold text-foreground">
                          {sqMetersToMarla(area).toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">Marla</div>
                      </div>
                      <div
                        className="rounded p-1.5 text-center col-span-2"
                        style={{ background: "#1F242A" }}
                      >
                        <div className="font-semibold text-foreground">
                          {sqMetersToSarsi(area).toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">Sarsi</div>
                      </div>
                    </div>
                    <div
                      className="text-xs text-muted-foreground mt-1"
                      style={{ fontSize: 9 }}
                    >
                      1 Kanal = 20 Marla \u00b7 1 Marla = 9 Sarsi \u00b7 1 Acre
                      = 8 Kanal
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded p-3 text-center text-xs text-muted-foreground"
                style={{ background: "#1F242A" }}
                data-ocid="measurements.empty_state"
              >
                Draw \u2265 3 points to see measurements
              </div>
            )}
          </section>

          <Separator className="opacity-30" />

          {/* Points List */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Points ({points.length})
            </p>
            {points.length === 0 ? (
              <div
                className="rounded p-3 text-center text-xs text-muted-foreground"
                style={{ background: "#1F242A" }}
                data-ocid="points.empty_state"
              >
                No points placed
              </div>
            ) : (
              <div className="space-y-1" data-ocid="points.list">
                {points.map(([lat, lng], idx) => (
                  <div
                    key={`pt-${idx}-${lat.toFixed(4)}-${lng.toFixed(4)}`}
                    className="flex items-center justify-between rounded px-2 py-1"
                    style={{
                      background: "#1F242A",
                      border: editMode
                        ? "1px solid rgba(245,158,11,0.25)"
                        : "1px solid transparent",
                    }}
                    data-ocid={`points.item.${idx + 1}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold w-4 text-center"
                        style={{ color: editMode ? "#f59e0b" : "#22C57A" }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "#AAB3BD", fontSize: 10 }}
                      >
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemovePoint(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-ocid={`points.delete_button.${idx + 1}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator className="opacity-30" />

          {/* Actions */}
          <section className="space-y-2">
            <Button
              type="button"
              className="w-full h-9 gap-2 text-sm font-semibold"
              onClick={onSave}
              disabled={points.length < 3 || isSaving}
              style={{
                background: "#3A424C",
                color: "#E9EEF3",
                border: "none",
              }}
              data-ocid="project.save_button"
            >
              <Save size={14} />
              {isSaving ? "Saving\u2026" : "Save Project"}
            </Button>

            <Button
              type="button"
              className="w-full h-10 gap-2 text-sm font-bold"
              onClick={handleExportDXF}
              disabled={points.length < 3}
              style={{
                background:
                  points.length >= 3 ? "#22C57A" : "rgba(34,197,122,0.3)",
                color: points.length >= 3 ? "#14181D" : "#AAB3BD",
                border: "none",
              }}
              data-ocid="export.primary_button"
            >
              <FileDown size={14} /> EXPORT TO AUTOCAD DXF
            </Button>

            <Button
              type="button"
              className="w-full h-8 gap-2 text-xs"
              onClick={handleExportCSV}
              disabled={points.length === 0}
              style={{
                background: "#3A424C",
                color: "#E9EEF3",
                border: "none",
              }}
              data-ocid="export.secondary_button"
            >
              <FileText size={12} /> Export CSV Coordinates
            </Button>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
