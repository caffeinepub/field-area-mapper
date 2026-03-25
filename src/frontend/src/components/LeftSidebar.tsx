import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCheck,
  Circle,
  FileDown,
  FileText,
  Hexagon,
  Layers,
  Minus,
  Route,
  Ruler,
  Save,
  Search,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
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
  sqMetersToSqFeet,
  sqMetersToSqKaram,
} from "../utils/geomath";
import type { DrawTool, TileMode } from "./MapView";

interface LeftSidebarProps {
  points: [number, number][];
  drawMode: boolean;
  tileMode: TileMode;
  projectName: string;
  isSaving: boolean;
  karamScale: number;
  drawTool: DrawTool;
  onKaramScaleChange: (value: number) => void;
  onTileModeChange: (mode: TileMode) => void;
  onToggleDrawMode: () => void;
  onUndo: () => void;
  onClosePolygon: () => void;
  onClear: () => void;
  onSave: () => void;
  onRemovePoint: (idx: number) => void;
  onProjectNameChange: (name: string) => void;
  onSearchGPS: (query: string) => void;
  onDrawToolChange: (tool: DrawTool) => void;
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
];

export function LeftSidebar({
  points,
  drawMode,
  tileMode,
  projectName,
  isSaving,
  karamScale,
  drawTool,
  onKaramScaleChange,
  onTileModeChange,
  onToggleDrawMode,
  onUndo,
  onClosePolygon,
  onClear,
  onSave,
  onRemovePoint,
  onProjectNameChange,
  onSearchGPS,
  onDrawToolChange,
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
              {(["osm", "satellite", "hybrid"] as TileMode[]).map((m) => (
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
                    ? "OpenStreet"
                    : m === "satellite"
                      ? "Satellite"
                      : "Hybrid"}
                </button>
              ))}
            </div>
          </section>

          {/* Search */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Search size={12} /> Search Location
            </p>
            <div className="flex gap-1.5">
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

            {/* Tool selector palette */}
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

            {/* Active tool indicator */}
            <div
              className="text-xs rounded px-2 py-1 mb-2 flex items-center gap-1.5"
              style={{
                background: drawMode
                  ? "rgba(34,197,122,0.1)"
                  : "rgba(255,255,255,0.03)",
                border: drawMode
                  ? "1px solid rgba(34,197,122,0.4)"
                  : "1px solid #3A424C",
                color: drawMode ? "#22C57A" : "#7E8994",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {DRAW_TOOLS.find((t) => t.tool === drawTool)?.icon}
              </span>
              <span>{DRAW_TOOLS.find((t) => t.tool === drawTool)?.desc}</span>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1 col-span-2"
                onClick={onToggleDrawMode}
                style={{
                  background: drawMode ? "#22C57A" : "#3A424C",
                  color: drawMode ? "#14181D" : "#E9EEF3",
                  border: "none",
                }}
                data-ocid="tools.toggle"
              >
                {DRAW_TOOLS.find((t) => t.tool === drawTool)?.icon}
                {drawMode
                  ? "Drawing — click to stop"
                  : `Start Drawing (${DRAW_TOOLS.find((t) => t.tool === drawTool)?.label})`}
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

                {/* Karam measurements */}
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
                    style={{ background: "#1F242A" }}
                    data-ocid={`points.item.${idx + 1}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold w-4 text-center"
                        style={{ color: "#22C57A" }}
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
