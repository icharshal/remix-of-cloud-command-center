import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Position,
  Handle,
  NodeProps,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { pluginRegistry, getCategoryColor } from '@/lib/plugins/registry';
import { Plugin } from '@/lib/plugins/types';

// ── Custom node: Category hub ─────────────────────────────────────────────────
function CategoryNode({ data }: NodeProps) {
  return (
    <div
      className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest border"
      style={{
        background: `${data.color}22`,
        borderColor: `${data.color}66`,
        color: data.color as string,
        minWidth: 110,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label as string}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

// ── Custom node: Plugin card ──────────────────────────────────────────────────
function PluginNode({ data }: NodeProps) {
  const plugin = data.plugin as Plugin;
  const color = getCategoryColor(plugin.category);
  return (
    <div
      className="rounded-lg border p-3 text-xs w-44 cursor-pointer transition-all hover:scale-105"
      style={{
        background: '#0f172a',
        borderColor: data.selected ? color : `${color}44`,
        boxShadow: data.selected ? `0 0 12px ${color}66` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="font-semibold text-white mb-0.5 truncate">{plugin.name}</div>
      <div className="text-slate-400 mb-2 leading-tight line-clamp-2">{plugin.description.slice(0, 60)}…</div>
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium border"
          style={{ background: `${color}22`, borderColor: `${color}55`, color }}
        >
          v{plugin.version}
        </span>
        {plugin.status === 'installed' && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            ✓ installed
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

// ── Custom node: Integration chip ────────────────────────────────────────────
function IntegrationNode({ data }: NodeProps) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-[11px] text-slate-300 font-medium">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {data.label as string}
    </div>
  );
}

const nodeTypes = {
  category: CategoryNode,
  plugin: PluginNode,
  integration: IntegrationNode,
};

// ── Layout helpers ────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<Plugin['category'], string> = {
  'code-analysis': 'Code Analysis',
  monitoring: 'Monitoring',
  security: 'Security',
  'ci-cd': 'CI / CD',
  automation: 'Automation',
  visualization: 'Visualization',
};

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function KnowledgeGraph() {
  // ── Derive categories present in registry ──
  const categories = useMemo(
    () => [...new Set(pluginRegistry.map((p) => p.category))] as Plugin['category'][],
    []
  );

  // ── Collect unique integrations ──
  const integrationSet = useMemo(() => {
    const s = new Set<string>();
    pluginRegistry.forEach((p) => p.integrations.forEach((i) => s.add(i)));
    return [...s];
  }, []);

  // ── Build nodes ──
  const initialNodes: Node[] = useMemo(() => {
    const cx = 600;
    const cy = 400;
    const nodes: Node[] = [];

    // Hub
    nodes.push({
      id: 'hub',
      type: 'input',
      position: { x: cx - 80, y: cy - 20 },
      data: { label: '🔌  Plugin Hub' },
      style: {
        background: '#1e293b',
        border: '2px solid #6366f1',
        borderRadius: 12,
        color: '#e2e8f0',
        fontWeight: 700,
        padding: '10px 20px',
      },
    });

    // Category nodes at r=200
    categories.forEach((cat, i) => {
      const angle = (360 / categories.length) * i;
      const pos = polarToXY(cx, cy, 200, angle);
      nodes.push({
        id: `cat-${cat}`,
        type: 'category',
        position: { x: pos.x - 55, y: pos.y - 16 },
        data: { label: CATEGORY_LABELS[cat], color: getCategoryColor(cat) },
      });
    });

    // Plugin nodes at r=400, clustered near their category
    const catPlugins: Record<string, Plugin[]> = {};
    pluginRegistry.forEach((p) => {
      if (!catPlugins[p.category]) catPlugins[p.category] = [];
      catPlugins[p.category].push(p);
    });

    categories.forEach((cat, ci) => {
      const baseAngle = (360 / categories.length) * ci;
      const plugins = catPlugins[cat] ?? [];
      plugins.forEach((plugin, pi) => {
        const spread = plugins.length > 1 ? 30 : 0;
        const angle = baseAngle + spread * (pi - (plugins.length - 1) / 2);
        const pos = polarToXY(cx, cy, 390, angle);
        nodes.push({
          id: `plugin-${plugin.id}`,
          type: 'plugin',
          position: { x: pos.x - 88, y: pos.y - 50 },
          data: { plugin, selected: plugin.status === 'installed' },
        });
      });
    });

    // Integration nodes at r=580
    const intCount = Math.min(integrationSet.length, 12);
    integrationSet.slice(0, intCount).forEach((integration, i) => {
      const angle = (360 / intCount) * i;
      const pos = polarToXY(cx, cy, 570, angle);
      nodes.push({
        id: `int-${integration}`,
        type: 'integration',
        position: { x: pos.x - 40, y: pos.y - 14 },
        data: { label: integration },
      });
    });

    return nodes;
  }, [categories, integrationSet]);

  // ── Build edges ──
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    // Hub → categories
    categories.forEach((cat) => {
      edges.push({
        id: `hub-${cat}`,
        source: 'hub',
        target: `cat-${cat}`,
        style: { stroke: `${getCategoryColor(cat)}55`, strokeWidth: 1.5 },
        animated: true,
      });
    });

    // Category → plugin
    pluginRegistry.forEach((plugin) => {
      edges.push({
        id: `cat-plugin-${plugin.id}`,
        source: `cat-${plugin.category}`,
        target: `plugin-${plugin.id}`,
        style: { stroke: `${getCategoryColor(plugin.category)}44`, strokeWidth: 1 },
      });
    });

    // Plugin → dependencies
    pluginRegistry.forEach((plugin) => {
      plugin.dependencies.forEach((dep) => {
        if (pluginRegistry.find((p) => p.id === dep.id)) {
          edges.push({
            id: `dep-${plugin.id}-${dep.id}`,
            source: `plugin-${plugin.id}`,
            target: `plugin-${dep.id}`,
            label: 'depends on',
            style: { stroke: '#f59e0b66', strokeWidth: 1, strokeDasharray: '5,3' },
            labelStyle: { fill: '#f59e0b', fontSize: 9 },
          });
        }
      });
    });

    // Plugin → integrations
    pluginRegistry.forEach((plugin) => {
      plugin.integrations.slice(0, 2).forEach((integration) => {
        edges.push({
          id: `int-${plugin.id}-${integration}`,
          source: `plugin-${plugin.id}`,
          target: `int-${integration}`,
          style: { stroke: '#334155', strokeWidth: 1 },
        });
      });
    });

    return edges;
  }, [categories]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
        <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-slate-300" />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor={(n) => {
            if (n.type === 'plugin') {
              const plugin = (n.data as { plugin: Plugin }).plugin;
              return getCategoryColor(plugin.category);
            }
            return '#334155';
          }}
        />
      </ReactFlow>
    </div>
  );
}
