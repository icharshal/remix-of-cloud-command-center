import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection, query, orderBy, where, getDocs } from "firebase/firestore";
import { db, normalizeDoc } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subHours, startOfDay, startOfHour, eachDayOfInterval, eachHourOfInterval } from "date-fns";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TriggeredAlert {
  id: string;
  rule_id: string | null;
  severity: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  message: string;
  metric_value: number;
  namespace: string | null;
  pod_name: string | null;
  node_name: string | null;
}

const SEVERITY_COLORS = {
  critical: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  info: "hsl(var(--primary))",
};

const STATUS_COLORS = {
  active: "hsl(var(--destructive))",
  acknowledged: "hsl(var(--warning))",
  resolved: "hsl(var(--muted-foreground))",
};

type TimeRange = "24h" | "7d" | "30d";

export default function AlertHistoryDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const getTimeRangeDate = (range: TimeRange) => {
    switch (range) {
      case "24h": return subHours(new Date(), 24);
      case "7d": return subDays(new Date(), 7);
      case "30d": return subDays(new Date(), 30);
    }
  };

  // Fetch all triggered alerts for the time range
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alert-history', timeRange],
    queryFn: async () => {
      const startDate = getTimeRangeDate(timeRange);
      const snap = await getDocs(
        query(
          collection(db, 'triggered_alerts'),
          where('triggered_at', '>=', startDate.toISOString()),
          orderBy('triggered_at', 'asc')
        )
      );
      return snap.docs.map(d => normalizeDoc<TriggeredAlert>(d));
    },
  });

  // Process data for charts
  const chartData = useMemo(() => {
    if (!alerts.length) return { timeline: [], severity: [], status: [], trend: null };

    const startDate = getTimeRangeDate(timeRange);
    const now = new Date();

    // Generate time intervals based on range
    const intervals = timeRange === "24h"
      ? eachHourOfInterval({ start: startDate, end: now })
      : eachDayOfInterval({ start: startDate, end: now });

    // Build timeline data
    const timeline = intervals.map(interval => {
      const intervalStart = timeRange === "24h" ? startOfHour(interval) : startOfDay(interval);
      const intervalEnd = timeRange === "24h" 
        ? new Date(intervalStart.getTime() + 60 * 60 * 1000)
        : new Date(intervalStart.getTime() + 24 * 60 * 60 * 1000);

      const intervalAlerts = alerts.filter(a => {
        const triggeredAt = new Date(a.triggered_at);
        return triggeredAt >= intervalStart && triggeredAt < intervalEnd;
      });

      return {
        time: format(interval, timeRange === "24h" ? "HH:mm" : "MMM d"),
        total: intervalAlerts.length,
        critical: intervalAlerts.filter(a => a.severity === "critical").length,
        warning: intervalAlerts.filter(a => a.severity === "warning").length,
        info: intervalAlerts.filter(a => a.severity === "info").length,
      };
    });

    // Severity distribution
    const severityCounts = {
      critical: alerts.filter(a => a.severity === "critical").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      info: alerts.filter(a => a.severity === "info").length,
    };

    const severity = Object.entries(severityCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS],
      }));

    // Status distribution
    const statusCounts = {
      active: alerts.filter(a => a.status === "active").length,
      acknowledged: alerts.filter(a => a.status === "acknowledged").length,
      resolved: alerts.filter(a => a.status === "resolved").length,
    };

    const status = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS],
      }));

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(alerts.length / 2);
    if (alerts.length >= 4) {
      const firstHalfCount = midpoint;
      const secondHalfCount = alerts.length - midpoint;
      const percentChange = firstHalfCount > 0 
        ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100 
        : 0;
      return { timeline, severity, status, trend: { percentChange, direction: percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable" } };
    }

    return { timeline, severity, status, trend: null };
  }, [alerts, timeRange]);

  // Calculate average resolution time
  const avgResolutionTime = useMemo(() => {
    const resolvedAlerts = alerts.filter(a => a.resolved_at);
    if (!resolvedAlerts.length) return null;

    const totalMs = resolvedAlerts.reduce((sum, a) => {
      const triggered = new Date(a.triggered_at).getTime();
      const resolved = new Date(a.resolved_at!).getTime();
      return sum + (resolved - triggered);
    }, 0);

    const avgMs = totalMs / resolvedAlerts.length;
    const hours = Math.floor(avgMs / (1000 * 60 * 60));
    const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, [alerts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Alert History & Trends</h3>
          <p className="text-sm text-muted-foreground">
            {alerts.length} alerts in selected period
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{alerts.length}</span>
              {chartData.trend && (
                <div className={`flex items-center text-sm ${
                  chartData.trend.direction === "up" ? "text-destructive" :
                  chartData.trend.direction === "down" ? "text-green-500" :
                  "text-muted-foreground"
                }`}>
                  {chartData.trend.direction === "up" && <TrendingUp className="h-4 w-4 mr-1" />}
                  {chartData.trend.direction === "down" && <TrendingDown className="h-4 w-4 mr-1" />}
                  {chartData.trend.direction === "stable" && <Minus className="h-4 w-4 mr-1" />}
                  {Math.abs(chartData.trend.percentChange).toFixed(0)}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alerts.filter(a => a.severity === "critical").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolution Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.length > 0 
                ? `${((alerts.filter(a => a.status === "resolved").length / alerts.length) * 100).toFixed(0)}%`
                : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResolutionTime || "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Frequency Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Alert Frequency Over Time</CardTitle>
            <CardDescription>Number of alerts triggered by severity</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="critical" 
                    stackId="1" 
                    stroke={SEVERITY_COLORS.critical} 
                    fill={SEVERITY_COLORS.critical} 
                    fillOpacity={0.6}
                    name="Critical"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="warning" 
                    stackId="1" 
                    stroke={SEVERITY_COLORS.warning} 
                    fill={SEVERITY_COLORS.warning} 
                    fillOpacity={0.6}
                    name="Warning"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="info" 
                    stackId="1" 
                    stroke={SEVERITY_COLORS.info} 
                    fill={SEVERITY_COLORS.info} 
                    fillOpacity={0.6}
                    name="Info"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No alert data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Breakdown of alerts by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.severity.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData.severity}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.severity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current status of all alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.status.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.status} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis 
                    type="number"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
