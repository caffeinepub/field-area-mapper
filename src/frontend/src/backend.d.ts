import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type ProjectId = bigint;
export type Meters = number;
export interface Project {
    area: Meters;
    name: string;
    perimeter: Meters;
    coordinates: Array<[number, number]>;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    /**
     * / Get a specific project by ID
     */
    getProject(projectId: ProjectId): Promise<Project>;
    /**
     * / Get all project IDs for the caller
     */
    getProjectIds(): Promise<Array<ProjectId>>;
    /**
     * / Get all project IDs for the caller, sorted by creation time (most recent first)
     */
    getProjectIdsByCreationTime(): Promise<Array<ProjectId>>;
    /**
     * / Get all projects for the caller
     */
    getProjects(): Promise<Array<Project>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    /**
     * / Remove a project for the caller
     */
    removeProject(projectId: ProjectId): Promise<ProjectId>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    /**
     * / Add or update a project for the caller
     */
    saveProject(project: Project): Promise<ProjectId>;
    /**
     * / Get projects for the caller, filtered by a search term in the name (case-insensitive).
     */
    searchProjects(term: string): Promise<Array<Project>>;
}
