import { useState, useMemo } from 'react';
import { Search, Star, Download, Package, CheckCircle2, Zap, Copy, Check, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import { pluginRegistry, getCategoryColor, getStatusBadge } from '@/lib/plugins/registry';
import { Plugin } from '@/lib/plugins/types';

const CATEGORY_LABELS: Record<Plugin['category'], string> = {
  'code-analysis': 'Code Analysis',
  monitoring: 'Monitoring',
  security: 'Security',
  'ci-cd': 'CI / CD',
  automation: 'Automation',
  visualization: 'Visualization',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded p-1 text-slate-400 hover:text-white transition-colors"
      title="Copy command"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const color = getCategoryColor(plugin.category);
  const badge = getStatusBadge(plugin.status);

  return (
    <div
      className="rounded-xl border bg-card p-5 flex flex-col gap-3 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      style={{ borderColor: plugin.status === 'installed' ? `${color}44` : undefined }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="rounded-lg p-2"
            style={{ background: `${color}22` }}
          >
            <Package className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">{plugin.name}</div>
            <div className="text-xs text-muted-foreground">by {plugin.author.name}</div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{plugin.description}</p>

      {/* Category & tags */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0"
          style={{ borderColor: `${color}55`, color }}
        >
          {CATEGORY_LABELS[plugin.category]}
        </Badge>
        {plugin.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Integrations */}
      {plugin.integrations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plugin.integrations.map((int) => (
            <span key={int} className="text-[10px] text-slate-400 bg-slate-800 rounded px-1.5 py-0.5">
              {int}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2 mt-auto">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-400" />
          {plugin.stars.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3 text-blue-400" />
          {plugin.downloads.toLocaleString()}
        </span>
        <span className="ml-auto text-[11px] text-slate-500">v{plugin.version}</span>
      </div>

      {/* Install command */}
      <div className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 flex items-center justify-between">
        <code className="text-[10px] text-slate-300 font-mono truncate flex-1">{plugin.installCommand}</code>
        <CopyButton text={plugin.installCommand} />
      </div>

      {/* Deps */}
      {plugin.dependencies.length > 0 && (
        <div className="text-[10px] text-yellow-500/70">
          Requires: {plugin.dependencies.map((d) => d.id).join(', ')}
        </div>
      )}
    </div>
  );
}

export default function PluginMarketplace() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Plugin['category'] | 'all'>('all');

  const installed = useMemo(
    () => pluginRegistry.filter((p) => p.status === 'installed'),
    []
  );

  const filtered = useMemo(() => {
    return pluginRegistry.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.includes(search.toLowerCase()));
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [search, categoryFilter]);

  const categories = useMemo(
    () => [...new Set(pluginRegistry.map((p) => p.category))] as Plugin['category'][],
    []
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Plugin Marketplace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Extend DevOps Hub with community plugins. Browse, install, and manage Claude-powered extensions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          {installed.length} installed
          <span className="text-slate-600 mx-1">·</span>
          {pluginRegistry.length} total
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="installed">
            Installed
            <span className="ml-1.5 rounded-full bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 font-medium">
              {installed.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="graph">Knowledge Graph</TabsTrigger>
        </TabsList>

        {/* ── Browse tab ── */}
        <TabsContent value="browse" className="space-y-5 mt-5">
          {/* Search + filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('all')}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  style={
                    categoryFilter === cat
                      ? { background: getCategoryColor(cat), border: 'none' }
                      : { borderColor: `${getCategoryColor(cat)}44`, color: getCategoryColor(cat) }
                  }
                >
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No plugins match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <PluginCard key={p.id} plugin={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Installed tab ── */}
        <TabsContent value="installed" className="mt-5">
          {installed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No plugins installed yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {installed.map((p) => (
                <PluginCard key={p.id} plugin={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Knowledge graph tab ── */}
        <TabsContent value="graph" className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">Plugin Knowledge Graph</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Interactive graph of plugin dependencies, categories, and integrations. Drag to explore — installed plugins are highlighted.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mb-4 text-[11px]">
              {(Object.entries(CATEGORY_LABELS) as [Plugin['category'], string][]).map(([cat, label]) => (
                <span key={cat} className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCategoryColor(cat) }} />
                  {label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded border border-yellow-500/60" style={{ borderStyle: 'dashed' }} />
                Dependency edge
              </span>
            </div>
            <KnowledgeGraph />
          </div>

          {/* Registry JSON */}
          <details className="rounded-xl border border-border bg-card">
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground">
              Raw registry — <code className="text-[11px]">code-review-graph</code> entry
            </summary>
            <pre className="px-4 pb-4 text-[11px] text-slate-300 overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(pluginRegistry.find((p) => p.id === 'code-review-graph'), null, 2)}
            </pre>
          </details>
        </TabsContent>
      </Tabs>

      {/* Quick-start box */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <div className="flex items-start gap-3">
          <ExternalLink className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-indigo-300 mb-1">Installing a plugin</div>
            <p className="text-xs text-slate-400 mb-2">
              Run the install command in any terminal where Claude Code is available. The
              <code className="mx-1 text-indigo-300">@source</code> suffix pins the plugin to its upstream registry entry.
            </p>
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2 flex items-center justify-between w-fit">
              <code className="text-[11px] text-slate-200 font-mono">
                claude plugin install code-review-graph@code-review-graph
              </code>
              <CopyButton text="claude plugin install code-review-graph@code-review-graph" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
