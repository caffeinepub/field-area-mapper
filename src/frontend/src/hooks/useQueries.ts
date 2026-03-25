import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId } from "../backend.d";
import { useActor } from "./useActor";

export interface ProjectWithId extends Project {
  id: ProjectId;
}

export function useProjects() {
  const { actor, isFetching } = useActor();
  return useQuery<ProjectWithId[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!actor) return [];
      const ids = await actor.getProjectIdsByCreationTime();
      const projects = await Promise.all(
        ids.map((id) => actor.getProject(id).then((p) => ({ ...p, id }))),
      );
      return projects;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: Project) => {
      if (!actor) throw new Error("Not connected");
      return actor.saveProject(project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRemoveProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: ProjectId) => {
      if (!actor) throw new Error("Not connected");
      return actor.removeProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
