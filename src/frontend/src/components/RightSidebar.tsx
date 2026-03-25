import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, MapPin, Plus, Trash2 } from "lucide-react";
import type { ProjectWithId } from "../hooks/useQueries";
import { sqMetersToAcres } from "../utils/geomath";

interface RightSidebarProps {
  projects: ProjectWithId[];
  isLoading: boolean;
  activeProjectId: bigint | null;
  onLoadProject: (project: ProjectWithId) => void;
  onDeleteProject: (id: bigint) => void;
  onNewProject: () => void;
  isDeleting: boolean;
}

export function RightSidebar({
  projects,
  isLoading,
  activeProjectId,
  onLoadProject,
  onDeleteProject,
  onNewProject,
  isDeleting,
}: RightSidebarProps) {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 240,
        background: "#2B3138",
        borderLeft: "1px solid #3A424C",
        flexShrink: 0,
      }}
    >
      <div
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid #3A424C" }}
      >
        <div className="flex items-center gap-2">
          <FolderOpen size={14} style={{ color: "#22C57A" }} />
          <span className="text-sm font-semibold text-foreground">
            Projects
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: "#1F242A", color: "#22C57A" }}
          >
            {projects.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="rounded p-1 transition-colors hover:bg-secondary"
          title="New project"
          data-ocid="projects.button"
        >
          <Plus size={14} className="text-muted-foreground" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="space-y-2 p-1" data-ocid="projects.loading_state">
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className="h-16 w-full"
                  style={{ background: "#3A424C" }}
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="p-4 text-center" data-ocid="projects.empty_state">
              <FolderOpen
                size={28}
                className="mx-auto mb-2 text-muted-foreground opacity-40"
              />
              <p className="text-xs text-muted-foreground">
                No saved projects.
              </p>
              <p className="text-xs text-muted-foreground opacity-60">
                Draw a field and save it.
              </p>
            </div>
          ) : (
            <>
              {projects.map((project, idx) => {
                const isActive = activeProjectId === project.id;
                const acres = sqMetersToAcres(project.area);
                return (
                  <button
                    type="button"
                    key={project.id.toString()}
                    className="w-full text-left rounded p-2.5 transition-all group"
                    style={{
                      background: isActive
                        ? "rgba(34,197,122,0.12)"
                        : "#1F242A",
                      border: isActive
                        ? "1px solid rgba(34,197,122,0.4)"
                        : "1px solid transparent",
                    }}
                    onClick={() => onLoadProject(project)}
                    data-ocid={`projects.item.${idx + 1}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin
                            size={10}
                            style={{
                              color: isActive ? "#22C57A" : "#7E8994",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            className="text-xs font-semibold truncate"
                            style={{
                              color: isActive ? "#22C57A" : "#E9EEF3",
                            }}
                          >
                            {project.name || "Unnamed Field"}
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: "#7E8994" }}>
                          {project.coordinates.length} pts \u00b7{" "}
                          {acres > 0 ? `${acres.toFixed(2)} ac` : "\u2014"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(project.id);
                        }}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20"
                        data-ocid={`projects.delete_button.${idx + 1}`}
                      >
                        <Trash2 size={11} className="text-destructive" />
                      </button>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
