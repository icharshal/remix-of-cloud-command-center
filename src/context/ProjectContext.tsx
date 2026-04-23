import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ConnectedProject {
  id: string;
  projectId: string;
  displayName: string;
  connectedAt: string;
  status: "connected" | "error";
  resourceCount: number;
}

interface ProjectContextValue {
  projects: ConnectedProject[];
  addProject: (p: ConnectedProject) => void;
  removeProject: (id: string) => void;
  updateResourceCount: (id: string, count: number) => void;
}

const STORAGE_KEY = "gcp_connected_projects";

function load(): ConnectedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(projects: ConnectedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ConnectedProject[]>(load);

  useEffect(() => {
    save(projects);
  }, [projects]);

  const addProject = (p: ConnectedProject) =>
    setProjects((prev) => {
      // prevent duplicate project IDs
      const filtered = prev.filter((x) => x.projectId !== p.projectId);
      return [...filtered, p];
    });

  const removeProject = (id: string) =>
    setProjects((prev) => prev.filter((p) => p.id !== id));

  const updateResourceCount = (id: string, count: number) =>
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, resourceCount: count } : p))
    );

  return (
    <ProjectContext.Provider value={{ projects, addProject, removeProject, updateResourceCount }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used inside ProjectProvider");
  return ctx;
}
