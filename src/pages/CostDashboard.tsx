import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { useState } from "react";

const serviceCosts = [
  { service: "Compute Engine", cost: 847, percentage: 29.7, trend: "+12%" },
  { service: "Cloud Storage", cost: 423, percentage: 14.9, trend: "-5%" },
  { service: "Cloud SQL", cost: 612, percentage: 21.5, trend: "+8%" },
  { service: "GKE", cost: 534, percentage: 18.8, trend: "+15%" },
  { service: "Cloud Functions", cost: 156, percentage: 5.5, trend: "-2%" },
  { service: "Networking", cost: 275, percentage: 9.6, trend: "+3%" },
];

const monthlyTrend = [
  { month: "Jan", cost: 2456 },
  { month: "Feb", cost: 2678 },
  { month: "Mar", cost: 2534 },
  { month: "Apr", cost: 2789 },
  { month: "May", cost: 2847 },
];

const pieData = serviceCosts.map((item, index) => ({
  name: item.service,
  value: item.cost,
  color: `hsl(var(--chart-${(index % 5) + 1}))`,
}));

const projectCosts = [
  { project: "production", cost: 1534, percentage: 54 },
  { project: "staging", cost: 678, percentage: 24 },
  { project: "development", cost: 423, percentage: 15 },
  { project: "testing", cost: 212, percentage: 7 },
];

export default function CostDashboard() {
  const [timeRange, setTimeRange] = useState("30d");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cost Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Monitor and analyze your GCP spending
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">$2,847</div>
            <div className="flex items-center text-xs text-success">
              <TrendingDown className="mr-1 h-3 w-3" />
              8% lower than last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projected (EOМ)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">$3,124</div>
            <div className="flex items-center text-xs text-warning">
              <TrendingUp className="mr-1 h-3 w-3" />
              Based on current usage
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget Status</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">73%</div>
            <p className="text-xs text-muted-foreground">$2,847 of $3,900 budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Average</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">$95</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Service</CardTitle>
            <CardDescription>Monthly spending breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Last 5 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Cost"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Cost Details</CardTitle>
              <CardDescription>Detailed breakdown by GCP service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceCosts.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{service.service}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{service.percentage}%</Badge>
                        <span
                          className={`text-sm ${
                            service.trend.startsWith("+") ? "text-warning" : "text-success"
                          }`}
                        >
                          {service.trend}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">${service.cost}</p>
                      <p className="text-xs text-muted-foreground">this month</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Project</CardTitle>
              <CardDescription>Spending across different projects</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectCosts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="project" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Legend />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" name="Cost" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 space-y-4">
                {projectCosts.map((project, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-foreground capitalize">{project.project}</p>
                      <Badge variant="secondary">{project.percentage}% of total</Badge>
                    </div>
                    <p className="text-xl font-bold text-foreground">${project.cost}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
