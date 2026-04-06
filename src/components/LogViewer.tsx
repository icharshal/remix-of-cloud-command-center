import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Loader2, 
  FileText, 
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Terminal,
  X,
  Play,
  Pause,
  ArrowDown,
  Radio,
  Download,
  FileJson,
  FileSpreadsheet
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface CollectedLog {
  id: string;
  agent_id: string;
  pod_name: string | null;
  container_name: string | null;
  namespace: string | null;
  log_level: string | null;
  message: string;
  timestamp: string;
  source: string | null;
}

const LOG_LEVELS = ["all", "ERROR", "WARN", "INFO", "DEBUG"] as const;

const getLogLevelConfig = (level: string | null) => {
  switch (level?.toUpperCase()) {
    case "ERROR":
      return {
        icon: AlertCircle,
        className: "bg-destructive/10 text-destructive border-destructive/30",
        textClass: "text-destructive",
      };
    case "WARN":
    case "WARNING":
      return {
        icon: AlertTriangle,
        className: "bg-warning/10 text-warning border-warning/30",
        textClass: "text-warning",
      };
    case "INFO":
      return {
        icon: Info,
        className: "bg-primary/10 text-primary border-primary/30",
        textClass: "text-primary",
      };
    case "DEBUG":
      return {
        icon: Bug,
        className: "bg-muted text-muted-foreground border-muted-foreground/30",
        textClass: "text-muted-foreground",
      };
    default:
      return {
        icon: Terminal,
        className: "bg-secondary text-secondary-foreground border-border",
        textClass: "text-foreground",
      };
  }
};

// Simple syntax highlighting for common log patterns
const highlightLogMessage = (message: string) => {
  // Split into parts and highlight different patterns
  const parts: { text: string; type: string }[] = [];
  const remaining = message;

  // Patterns to highlight
  const patterns = [
    { regex: /"[^"]*"/g, type: "string" },
    { regex: /'[^']*'/g, type: "string" },
    { regex: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, type: "date" },
    { regex: /\b\d+\.\d+\.\d+\.\d+(?::\d+)?\b/g, type: "ip" },
    { regex: /\b(?:https?|ftp):\/\/[^\s]+/g, type: "url" },
    { regex: /\b[A-Z_]{2,}(?:_[A-Z]+)*\b/g, type: "constant" },
    { regex: /\b(?:true|false|null|undefined|nil)\b/gi, type: "boolean" },
    { regex: /\b\d+(?:\.\d+)?(?:ms|s|m|h|KB|MB|GB|%|Mi|Gi)?\b/g, type: "number" },
    { regex: /\[[^\]]+\]/g, type: "bracket" },
    { regex: /\{[^}]+\}/g, type: "brace" },
    { regex: /error|failed|failure|exception|critical/gi, type: "error" },
    { regex: /success|completed|succeeded|ok/gi, type: "success" },
    { regex: /warning|warn|deprecated/gi, type: "warning" },
  ];

  // Simple approach: return JSX elements for highlighted text
  return message;
};

const LogMessageHighlighter = ({ message }: { message: string }) => {
  const highlightedParts = useMemo(() => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyIndex = 0;

    // Create a combined regex for all patterns
    const combinedPatterns = [
      { regex: /"[^"]*"/g, className: "text-accent" },
      { regex: /'[^']*'/g, className: "text-accent" },
      { regex: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, className: "text-primary" },
      { regex: /\b\d+\.\d+\.\d+\.\d+(?::\d+)?\b/g, className: "text-primary/80" },
      { regex: /\b(?:https?|ftp):\/\/[^\s]+/g, className: "text-primary underline" },
      { regex: /error|failed|failure|exception|critical/gi, className: "text-destructive font-medium" },
      { regex: /success|completed|succeeded|ok/gi, className: "text-success font-medium" },
      { regex: /warning|warn|deprecated/gi, className: "text-warning font-medium" },
      { regex: /\b\d+(?:\.\d+)?(?:ms|s|m|h|KB|MB|GB|%|Mi|Gi)?\b/g, className: "text-chart-4" },
    ];

    // Find all matches with their positions
    interface Match {
      start: number;
      end: number;
      text: string;
      className: string;
    }

    const allMatches: Match[] = [];

    combinedPatterns.forEach(({ regex, className }) => {
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(message)) !== null) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          className,
        });
      }
    });

    // Sort by start position
    allMatches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep the first one)
    const filteredMatches: Match[] = [];
    allMatches.forEach((match) => {
      const lastMatch = filteredMatches[filteredMatches.length - 1];
      if (!lastMatch || match.start >= lastMatch.end) {
        filteredMatches.push(match);
      }
    });

    // Build result
    filteredMatches.forEach((match) => {
      if (match.start > lastIndex) {
        result.push(
          <span key={keyIndex++}>{message.slice(lastIndex, match.start)}</span>
        );
      }
      result.push(
        <span key={keyIndex++} className={match.className}>
          {match.text}
        </span>
      );
      lastIndex = match.end;
    });

    if (lastIndex < message.length) {
      result.push(<span key={keyIndex++}>{message.slice(lastIndex)}</span>);
    }

    return result.length > 0 ? result : message;
  }, [message]);

  return <>{highlightedParts}</>;
};

export default function LogViewer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");
  const [podFilter, setPodFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [newLogsCount, setNewLogsCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const { data: logs = [], refetch, isLoading } = useQuery({
    queryKey: ['log-viewer-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collected_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as CollectedLog[];
    },
  });

  // Scroll to top (newest logs)
  const scrollToTop = useCallback(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0;
    }
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    if (!isStreaming) {
      setRealtimeConnected(false);
      return;
    }

    const channel = supabase
      .channel('log-viewer-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'collected_logs' },
        () => {
          refetch();
          if (autoScroll) {
            // Small delay to allow the new data to render
            setTimeout(scrollToTop, 100);
          } else {
            setNewLogsCount((prev) => prev + 1);
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStreaming, autoScroll, refetch, scrollToTop]);

  // Handle scroll events to detect if user scrolled away
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtTop = target.scrollTop < 50;
    if (isAtTop && newLogsCount > 0) {
      setNewLogsCount(0);
    }
    // If user scrolls away from top, disable auto-scroll
    if (!isAtTop && autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll, newLogsCount]);

  const handleScrollToNew = () => {
    scrollToTop();
    setNewLogsCount(0);
    setAutoScroll(true);
  };

  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setAutoScroll(true);
      setNewLogsCount(0);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    if (autoScroll) {
      scrollToTop();
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSeverityFilter("all");
    setNamespaceFilter("all");
    setPodFilter("all");
  };

  // Get unique values for filters
  const uniqueNamespaces = useMemo(() => 
    [...new Set(logs.filter(l => l.namespace).map(l => l.namespace!))].sort(),
    [logs]
  );

  const uniquePods = useMemo(() => 
    [...new Set(logs.filter(l => l.pod_name).map(l => l.pod_name!))].sort(),
    [logs]
  );

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = searchQuery === "" || 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.pod_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.container_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.namespace?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSeverity = severityFilter === "all" || 
        log.log_level?.toUpperCase() === severityFilter;
      
      const matchesNamespace = namespaceFilter === "all" || 
        log.namespace === namespaceFilter;
      
      const matchesPod = podFilter === "all" || 
        log.pod_name === podFilter;

      return matchesSearch && matchesSeverity && matchesNamespace && matchesPod;
    });
  }, [logs, searchQuery, severityFilter, namespaceFilter, podFilter]);

  // Export to JSON
  const exportToJSON = useCallback(() => {
    const exportData = filteredLogs.map(log => ({
      timestamp: log.timestamp,
      level: log.log_level,
      namespace: log.namespace,
      pod: log.pod_name,
      container: log.container_name,
      message: log.message,
      source: log.source,
      agent_id: log.agent_id,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Timestamp', 'Level', 'Namespace', 'Pod', 'Container', 'Message', 'Source', 'Agent ID'];
    
    const escapeCSV = (value: string | null | undefined) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredLogs.map(log => [
      escapeCSV(log.timestamp),
      escapeCSV(log.log_level),
      escapeCSV(log.namespace),
      escapeCSV(log.pod_name),
      escapeCSV(log.container_name),
      escapeCSV(log.message),
      escapeCSV(log.source),
      escapeCSV(log.agent_id),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // Stats
  const stats = useMemo(() => {
    const errorCount = filteredLogs.filter(l => l.log_level?.toUpperCase() === "ERROR").length;
    const warnCount = filteredLogs.filter(l => ["WARN", "WARNING"].includes(l.log_level?.toUpperCase() || "")).length;
    const infoCount = filteredLogs.filter(l => l.log_level?.toUpperCase() === "INFO").length;
    const debugCount = filteredLogs.filter(l => l.log_level?.toUpperCase() === "DEBUG").length;
    return { errorCount, warnCount, infoCount, debugCount };
  }, [filteredLogs]);

  const hasActiveFilters = searchQuery || severityFilter !== "all" || namespaceFilter !== "all" || podFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Log Viewer</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">
              Search and analyze logs from your Kubernetes clusters
            </p>
            <Badge 
              variant={realtimeConnected && isStreaming ? "default" : "secondary"} 
              className="gap-1"
            >
              <span className={`h-2 w-2 rounded-full ${
                realtimeConnected && isStreaming 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-muted-foreground'
              }`} />
              {isStreaming ? (realtimeConnected ? 'Live' : 'Connecting...') : 'Paused'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isStreaming ? "default" : "outline"} 
            className="gap-2" 
            onClick={toggleStreaming}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={filteredLogs.length === 0}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToJSON} className="gap-2 cursor-pointer">
                <FileJson className="h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.errorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.warnCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Info</CardTitle>
            <Info className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.infoCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Debug</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.debugCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter logs by search term, severity, namespace, or pod
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Severity Filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="WARN">Warning</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="DEBUG">Debug</SelectItem>
              </SelectContent>
            </Select>

            {/* Namespace Filter */}
            <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Namespace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Namespaces</SelectItem>
                {uniqueNamespaces.map((ns) => (
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pod Filter */}
            <Select value={podFilter} onValueChange={setPodFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Pod" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pods</SelectItem>
                {uniquePods.map((pod) => (
                  <SelectItem key={pod} value={pod}>
                    {pod.length > 30 ? pod.substring(0, 30) + '...' : pod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs
                <Badge variant="secondary" className="ml-2">
                  {filteredLogs.length} of {logs.length}
                </Badge>
                {isStreaming && realtimeConnected && (
                  <Badge variant="outline" className="ml-2 gap-1 text-accent border-accent/30">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Streaming
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Click on a log entry to expand details
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={autoScroll ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setAutoScroll(!autoScroll);
                  if (!autoScroll) {
                    scrollToTop();
                    setNewLogsCount(0);
                  }
                }}
              >
                <ArrowDown className={`h-4 w-4 ${autoScroll ? '' : 'opacity-50'}`} />
                Auto-scroll {autoScroll ? 'On' : 'Off'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {/* New logs indicator */}
          {newLogsCount > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
              <Button
                onClick={handleScrollToNew}
                className="gap-2 shadow-lg animate-bounce"
                size="sm"
              >
                <ArrowDown className="h-4 w-4 rotate-180" />
                {newLogsCount} new log{newLogsCount > 1 ? 's' : ''}
              </Button>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Terminal className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No logs found</p>
              <p className="text-sm">
                {hasActiveFilters 
                  ? "Try adjusting your filters" 
                  : "Deploy a monitoring agent to start collecting logs"}
              </p>
            </div>
          ) : (
            <div 
              ref={logsContainerRef}
              className="h-[600px] rounded-md border bg-card overflow-auto"
              onScroll={handleScroll}
            >
              <div className="font-mono text-sm">
                {filteredLogs.map((log) => {
                  const levelConfig = getLogLevelConfig(log.log_level);
                  const LevelIcon = levelConfig.icon;
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <div
                      key={log.id}
                      className={`border-b border-border/50 last:border-0 cursor-pointer transition-colors hover:bg-muted/50 ${
                        isExpanded ? 'bg-muted/30' : ''
                      }`}
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      {/* Main log line */}
                      <div className="flex items-start gap-3 p-3">
                        <span className="text-muted-foreground text-xs whitespace-nowrap pt-0.5">
                          {format(new Date(log.timestamp), 'MMM dd HH:mm:ss.SSS')}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs gap-1 shrink-0 ${levelConfig.className}`}
                        >
                          <LevelIcon className="h-3 w-3" />
                          {log.log_level?.toUpperCase() || 'LOG'}
                        </Badge>
                        {log.namespace && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {log.namespace}
                          </Badge>
                        )}
                        {log.pod_name && (
                          <span className="text-xs text-primary/80 shrink-0 max-w-[200px] truncate">
                            {log.pod_name}
                          </span>
                        )}
                        <span className={`flex-1 break-all ${levelConfig.textClass}`}>
                          <LogMessageHighlighter message={log.message} />
                        </span>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0">
                          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                              <div>
                                <span className="text-muted-foreground">Timestamp</span>
                                <p className="font-medium">{format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Agent ID</span>
                                <p className="font-medium truncate">{log.agent_id}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Namespace</span>
                                <p className="font-medium">{log.namespace || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Source</span>
                                <p className="font-medium">{log.source || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-muted-foreground">Pod</span>
                                <p className="font-medium break-all">{log.pod_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Container</span>
                                <p className="font-medium">{log.container_name || 'N/A'}</p>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Full Message</span>
                              <pre className="mt-1 whitespace-pre-wrap break-all bg-background p-2 rounded border text-foreground">
                                {log.message}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
