export type PluginCategory =
  | 'code-analysis'
  | 'monitoring'
  | 'security'
  | 'ci-cd'
  | 'automation'
  | 'visualization';

export type PluginStatus = 'installed' | 'available' | 'beta' | 'deprecated';

export interface PluginAuthor {
  name: string;
  github: string;
}

export interface PluginDependency {
  id: string;
  version: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  status: PluginStatus;
  author: PluginAuthor;
  tags: string[];
  dependencies: PluginDependency[];
  integrations: string[];
  installCommand: string;
  stars: number;
  downloads: number;
  graphNodes?: KnowledgeNode[];
  graphEdges?: KnowledgeEdge[];
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'entity' | 'concept' | 'tool' | 'process';
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  label: string;
}
