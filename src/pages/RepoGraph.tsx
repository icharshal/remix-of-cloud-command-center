import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RepoGraphLegend, RepoKnowledgeGraph } from "@/components/RepoKnowledgeGraph";
import { repoGraphEdges, repoGraphNodes } from "@/lib/repoKnowledgeGraph";

export default function RepoGraph() {
  const tableCount = repoGraphNodes.filter((node) => node.type === "table").length;
  const pageCount = repoGraphNodes.filter((node) => node.type === "page").length;
  const backendCount = repoGraphNodes.filter((node) => node.group === "backend").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Repo Knowledge Graph</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Live map of this app's routes, shared components, Supabase tables, Edge Functions, and external integrations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{repoGraphNodes.length} nodes</Badge>
          <Badge variant="outline">{repoGraphEdges.length} edges</Badge>
          <Badge variant="outline">{pageCount} pages</Badge>
          <Badge variant="outline">{tableCount} tables</Badge>
          <Badge variant="outline">{backendCount} backend artifacts</Badge>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <RepoGraphLegend />
        </div>
        <RepoKnowledgeGraph />
      </section>
    </div>
  );
}
