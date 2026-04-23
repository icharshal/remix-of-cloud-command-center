import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import GKEDashboard from "./pages/GKEDashboard";
import MonitoringAgent from "./pages/MonitoringAgent";
import Alerts from "./pages/Alerts";
import LogViewerPage from "./pages/LogViewer";
import JiraAutomation from "./pages/JiraAutomation";
import Settings from "./pages/Settings";
import ResourceGovernance from "./pages/ResourceGovernance";
import PluginMarketplace from "./pages/PluginMarketplace";
import RepoGraph from "./pages/RepoGraph";
import ProjectConnector from "./pages/ProjectConnector";
import ResourceDiscovery from "./pages/ResourceDiscovery";
import NotFound from "./pages/NotFound";
// Labs — hidden from nav, still accessible via direct URL
import TerraformGenerator from "./pages/TerraformGenerator";
import CICDBuilder from "./pages/CICDBuilder";
import CostDashboard from "./pages/CostDashboard";
import SecurityAnalyzer from "./pages/SecurityAnalyzer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/connect-project" element={<ProjectConnector />} />
            <Route path="/resource-discovery" element={<ResourceDiscovery />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/gke" element={<GKEDashboard />} />
            <Route path="/monitoring-agent" element={<MonitoringAgent />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/logs" element={<LogViewerPage />} />
            <Route path="/jira-automation" element={<JiraAutomation />} />
            <Route path="/resources" element={<ResourceGovernance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/plugins" element={<PluginMarketplace />} />
            <Route path="/knowledge-graph" element={<RepoGraph />} />
            {/* Labs — hidden from nav */}
            <Route path="/terraform" element={<TerraformGenerator />} />
            <Route path="/cicd" element={<CICDBuilder />} />
            <Route path="/costs" element={<CostDashboard />} />
            <Route path="/security" element={<SecurityAnalyzer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
