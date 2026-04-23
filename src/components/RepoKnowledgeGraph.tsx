import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { groupColors, RepoGraphNode, repoGraphEdges, repoGraphNodes } from "@/lib/repoKnowledgeGraph";

const GROUP_LABELS: Record<RepoGraphNode["group"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  external: "External",
  extension: "Extension",
};

const GROUP_COLUMNS: Record<RepoGraphNode["group"], number> = {
  frontend: 0,
  extension: 1,
  backend: 2,
  database: 3,
  external: 4,
};

function RepoNode({ data }: NodeProps) {
  const repoNode = data.node as RepoGraphNode;
  const color = groupColors[repoNode.group];

  return (
    <div
      className="w-48 rounded-lg border bg-slate-950 px-3 py-2 text-xs shadow-lg transition-transform hover:scale-[1.02]"
      style={{ borderColor: `${color}66`, boxShadow: `0 0 18px ${color}18` }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{repoNode.label}</div>
          <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
            {repoNode.path ?? repoNode.type.replace("_", " ")}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  repoNode: RepoNode,
};

export function RepoKnowledgeGraph() {
  const initialNodes: Node[] = useMemo(() => {
    const seenByGroup = new Map<RepoGraphNode["group"], number>();

    return repoGraphNodes.map((node) => {
      const row = seenByGroup.get(node.group) ?? 0;
      seenByGroup.set(node.group, row + 1);

      return {
        id: node.id,
        type: "repoNode",
        position: {
          x: 40 + GROUP_COLUMNS[node.group] * 280,
          y: 60 + row * 86,
        },
        data: { node },
      };
    });
  }, []);

  const initialEdges: Edge[] = useMemo(
    () =>
      repoGraphEdges.map((edge, index) => {
        const sourceNode = repoGraphNodes.find((node) => node.id === edge.source);
        const color = sourceNode ? groupColors[sourceNode.group] : "#64748b";

        return {
          id: `${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          animated: edge.source === "monitoring_ingest" || edge.source === "check_alerts",
          style: { stroke: `${color}88`, strokeWidth: 1.4 },
          labelStyle: { fill: "#cbd5e1", fontSize: 10 },
          labelBgStyle: { fill: "#020617", fillOpacity: 0.8 },
        };
      }),
    []
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  return (
    <div className="h-[680px] w-full overflow-hidden rounded-lg border border-border bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        minZoom={0.25}
        maxZoom={1.7}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
        <Controls className="[&>button]:border-slate-700 [&>button]:bg-slate-800 [&>button]:text-slate-300" />
        <MiniMap
          className="!border-slate-700 !bg-slate-900"
          nodeColor={(node) => {
            const graphNode = (node.data as { node?: RepoGraphNode }).node;
            return graphNode ? groupColors[graphNode.group] : "#334155";
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function RepoGraphLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {(Object.entries(GROUP_LABELS) as [RepoGraphNode["group"], string][]).map(([group, label]) => (
        <span key={group} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: groupColors[group] }} />
          {label}
        </span>
      ))}
      <span className="text-slate-500">Drag nodes, zoom, or use the minimap to move around.</span>
    </div>
  );
}
