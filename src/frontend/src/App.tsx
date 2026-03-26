import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, LogIn, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LeftSidebar } from "./components/LeftSidebar";
import { MapView } from "./components/MapView";
import type { DrawTool, TileMode } from "./components/MapView";
import { RightSidebar } from "./components/RightSidebar";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import {
  useProjects,
  useRemoveProject,
  useSaveProject,
} from "./hooks/useQueries";
import type { ProjectWithId } from "./hooks/useQueries";
import { calculateArea, calculatePerimeter } from "./utils/geomath";

export interface OverlayItem {
  id: string;
  type: "image" | "pdf";
  dataUrl: string;
  label: string;
  bounds: [[number, number], [number, number]];
  opacity: number;
  rotation: number;
  blendMode: string;
  scale: number;
  anchorPoint?: { relLat: number; relLng: number } | null;
}

export default function App() {
  const { identity, login, clear, isInitializing, isLoggingIn } =
    useInternetIdentity();

  const isAuthenticated =
    identity !== undefined && !identity.getPrincipal().isAnonymous();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const saveProject = useSaveProject();
  const removeProject = useRemoveProject();

  const [points, setPoints] = useState<[number, number][]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>("osm");
  const [projectName, setProjectName] = useState("Unnamed Field");
  const [activeProjectId, setActiveProjectId] = useState<bigint | null>(null);
  const [fitBoundsKey, setFitBoundsKey] = useState(0);
  const [karamScale, setKaramScale] = useState(5.5);
  const [drawTool, setDrawTool] = useState<DrawTool>("polygon");
  const [searchTarget, setSearchTarget] = useState<{
    lat: number;
    lng: number;
    key: number;
  } | null>(null);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [mapBounds, setMapBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [anchorPickModeId, setAnchorPickModeId] = useState<string | null>(null);

  const area = calculateArea(points);
  const perimeter = calculatePerimeter(points);

  const handleAddPoint = useCallback(
    (lat: number, lng: number) => {
      setPoints((prev) => {
        const next = [...prev, [lat, lng] as [number, number]];
        if (drawTool === "line" && next.length >= 2) {
          setDrawMode(false);
        }
        if (drawTool === "angle" && next.length >= 3) {
          setDrawMode(false);
        }
        return next;
      });
    },
    [drawTool],
  );

  const handleSetPoints = useCallback((pts: [number, number][]) => {
    setPoints(pts);
    setDrawMode(false);
  }, []);

  function handleToggleEditMode() {
    setEditMode((prev) => {
      const next = !prev;
      if (next) setDrawMode(false);
      return next;
    });
  }

  function handleUndo() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function handleClosePolygon() {
    setDrawMode(false);
    toast.success("Shape closed");
  }

  function handleClear() {
    setPoints([]);
    setActiveProjectId(null);
    setEditMode(false);
    toast.info("Drawing cleared");
  }

  function handleNewProject() {
    setPoints([]);
    setActiveProjectId(null);
    setProjectName("Unnamed Field");
    setEditMode(false);
  }

  function handleRemovePoint(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (points.length < 3) {
      toast.error("Need at least 3 points to save");
      return;
    }
    try {
      await saveProject.mutateAsync({
        name: projectName || "Unnamed Field",
        coordinates: points,
        area,
        perimeter,
      });
      toast.success("Project saved!");
    } catch {
      toast.error("Failed to save project");
    }
  }

  function handleLoadProject(project: ProjectWithId) {
    setPoints(project.coordinates as [number, number][]);
    setProjectName(project.name);
    setActiveProjectId(project.id);
    setFitBoundsKey((k) => k + 1);
    setDrawMode(false);
    setEditMode(false);
  }

  async function handleDeleteProject(id: bigint) {
    try {
      await removeProject.mutateAsync(id);
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setPoints([]);
        setProjectName("Unnamed Field");
        setEditMode(false);
      }
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  function handleSearchGPS(query: string) {
    if (!query.trim()) return;
    const match = query.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
    if (match) {
      const lat = Number.parseFloat(match[1]);
      const lng = Number.parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setSearchTarget({ lat, lng, key: Date.now() });
        toast.success(`Navigating to ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
    }
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          const lat = Number.parseFloat(data[0].lat);
          const lng = Number.parseFloat(data[0].lon);
          setSearchTarget({ lat, lng, key: Date.now() });
          toast.success(
            `Navigating to: ${String(data[0].display_name).slice(0, 40)}\u2026`,
          );
        } else {
          toast.error("Location not found");
        }
      })
      .catch(() => toast.error("Search failed"));
  }

  function handleLatLngJump(lat: number, lng: number) {
    setSearchTarget({ lat, lng, key: Date.now() });
    toast.success(`Navigating to ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }

  function handleAddOverlay(item: OverlayItem) {
    setOverlays((prev) => [...prev, item]);
  }

  function handleUpdateOverlay(
    id: string,
    updates: Partial<
      Pick<
        OverlayItem,
        | "bounds"
        | "opacity"
        | "rotation"
        | "blendMode"
        | "scale"
        | "anchorPoint"
      >
    >,
  ) {
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        let merged = { ...o, ...updates };
        if (updates.scale !== undefined && updates.bounds === undefined) {
          const [[s, w], [n, e]] = o.bounds;
          const centerLat = (n + s) / 2;
          const centerLng = (e + w) / 2;
          const ratio = updates.scale / (o.scale || 100);
          const halfH = ((n - s) / 2) * ratio;
          const halfW = ((e - w) / 2) * ratio;
          merged.bounds = [
            [centerLat - halfH, centerLng - halfW],
            [centerLat + halfH, centerLng + halfW],
          ];
        }
        return merged;
      }),
    );
  }

  function handleRemoveOverlay(id: string) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }

  function handleSetAnchorPickMode(id: string | null) {
    setAnchorPickModeId(id);
  }

  function handleSetOverlayAnchor(
    id: string,
    anchor: { relLat: number; relLng: number },
  ) {
    handleUpdateOverlay(id, { anchorPoint: anchor });
  }

  // Get current map center for overlay initial bounds
  function getInitialBoundsForOverlay(): [[number, number], [number, number]] {
    const center: [number, number] =
      points.length > 0 ? [points[0][0], points[0][1]] : [34.0, 74.8]; // Default to J&K region
    const half = 0.003;
    return [
      [center[0] - half, center[1] - half],
      [center[0] + half, center[1] + half],
    ];
  }

  if (isInitializing) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "#1F242A" }}
      >
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin mx-auto mb-3"
            style={{ color: "#22C57A" }}
          />
          <p className="text-sm text-muted-foreground">Initializing\u2026</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "#1F242A" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center px-8 py-10 rounded-xl"
          style={{
            background: "#2B3138",
            border: "1px solid #3A424C",
            maxWidth: 380,
            width: "100%",
          }}
          data-ocid="login.panel"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#22C57A" }}
            >
              <MapPin size={18} style={{ color: "#14181D" }} />
            </div>
            <span className="text-xl font-bold" style={{ color: "#E9EEF3" }}>
              TerraMeasure
            </span>
          </div>
          <h1
            className="text-lg font-semibold mb-2"
            style={{ color: "#E9EEF3" }}
          >
            Field Area Measurement
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Measure field areas using GPS data &amp; satellite imagery. Export
            to AutoCAD DXF.
          </p>
          <Button
            type="button"
            className="w-full h-11 gap-2 font-semibold text-sm"
            onClick={login}
            disabled={isLoggingIn}
            style={{ background: "#22C57A", color: "#14181D", border: "none" }}
            data-ocid="login.primary_button"
          >
            {isLoggingIn ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            {isLoggingIn ? "Signing in\u2026" : "Sign In"}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#1F242A" }}
    >
      <Toaster position="top-right" />

      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 56,
          background: "#2B3138",
          borderBottom: "1px solid #3A424C",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "#22C57A" }}
          >
            <MapPin size={13} style={{ color: "#14181D" }} />
          </div>
          <span className="font-bold text-sm" style={{ color: "#E9EEF3" }}>
            TerraMeasure
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1" data-ocid="nav.link">
          {["Map", "Tools", "Projects", "Account", "Help"].map((item) => (
            <button
              type="button"
              key={item}
              className="px-3 py-1 text-sm transition-colors relative"
              style={{ color: item === "Map" ? "#22C57A" : "#AAB3BD" }}
            >
              {item}
              {item === "Map" && (
                <div
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: "#22C57A" }}
                />
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold px-4 py-1.5 rounded-full transition-all"
          style={{
            border: "1px solid #3A424C",
            color: "#AAB3BD",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "#22C57A";
            (e.currentTarget as HTMLButtonElement).style.color = "#22C57A";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "#3A424C";
            (e.currentTarget as HTMLButtonElement).style.color = "#AAB3BD";
          }}
          data-ocid="nav.button"
        >
          Sign Out
        </button>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <LeftSidebar
          points={points}
          drawMode={drawMode}
          editMode={editMode}
          tileMode={tileMode}
          projectName={projectName}
          isSaving={saveProject.isPending}
          karamScale={karamScale}
          drawTool={drawTool}
          overlays={overlays}
          anchorPickModeId={anchorPickModeId}
          onKaramScaleChange={setKaramScale}
          onTileModeChange={setTileMode}
          onToggleDrawMode={() => setDrawMode((d) => !d)}
          onToggleEditMode={handleToggleEditMode}
          onUndo={handleUndo}
          onClosePolygon={handleClosePolygon}
          onClear={handleClear}
          onSave={handleSave}
          onRemovePoint={handleRemovePoint}
          onProjectNameChange={setProjectName}
          onSearchGPS={handleSearchGPS}
          onDrawToolChange={setDrawTool}
          onLatLngJump={handleLatLngJump}
          onAddOverlay={(item) => {
            const withBounds: OverlayItem = {
              ...item,
              bounds: getInitialBoundsForOverlay(),
              blendMode: item.blendMode || "normal",
              scale: item.scale || 100,
            };
            handleAddOverlay(withBounds);
          }}
          mapBounds={mapBounds}
          onUpdateOverlay={handleUpdateOverlay}
          onRemoveOverlay={handleRemoveOverlay}
          onAnchorPickMode={handleSetAnchorPickMode}
        />

        <div className="flex-1 relative overflow-hidden">
          <MapView
            points={points}
            drawMode={drawMode}
            editMode={editMode}
            tileMode={tileMode}
            fitBoundsKey={fitBoundsKey}
            area={area}
            karamScale={karamScale}
            drawTool={drawTool}
            searchTarget={searchTarget}
            overlays={overlays}
            anchorPickModeId={anchorPickModeId}
            onAddPoint={handleAddPoint}
            onSetPoints={handleSetPoints}
            onOverlayUpdate={(id, bounds, rotation, opacity) =>
              handleUpdateOverlay(id, { bounds, rotation, opacity })
            }
            onBoundsChange={setMapBounds}
            onSetAnchorPickMode={handleSetAnchorPickMode}
            onSetOverlayAnchor={handleSetOverlayAnchor}
          />

          {editMode && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none"
              style={{
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.5)",
                color: "#f59e0b",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
              }}
            >
              Edit Mode — drag points to reposition
            </div>
          )}

          {drawMode && !editMode && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none"
              style={{
                background: "rgba(34,197,122,0.15)",
                border: "1px solid rgba(34,197,122,0.5)",
                color: "#22C57A",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
              }}
            >
              {drawTool === "line"
                ? "Click 2 points to draw a line"
                : drawTool === "rectangle"
                  ? "Click 2 corners to draw a rectangle"
                  : drawTool === "circle"
                    ? "Click center then edge to draw a circle"
                    : `Click on the map to place ${drawTool} vertices`}
            </div>
          )}

          {anchorPickModeId && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none"
              style={{
                background: "rgba(6,182,212,0.15)",
                border: "1px solid rgba(6,182,212,0.5)",
                color: "#06b6d4",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
              }}
            >
              Click on the overlay to set drag anchor point
            </div>
          )}
        </div>

        <RightSidebar
          projects={projects}
          isLoading={projectsLoading}
          activeProjectId={activeProjectId}
          onLoadProject={handleLoadProject}
          onDeleteProject={handleDeleteProject}
          onNewProject={handleNewProject}
          isDeleting={removeProject.isPending}
        />
      </main>

      <footer
        className="text-center text-xs py-1.5"
        style={{
          color: "#7E8994",
          background: "#2B3138",
          borderTop: "1px solid #3A424C",
          flexShrink: 0,
        }}
      >
        \u00a9 {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#22C57A" }}
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
