import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TerraformGenerator from "./pages/TerraformGenerator";
import GKEDashboard from "./pages/GKEDashboard";
import CICDBuilder from "./pages/CICDBuilder";
import CostDashboard from "./pages/CostDashboard";
import SecurityAnalyzer from "./pages/SecurityAnalyzer";
import MonitoringAgent from "./pages/MonitoringAgent";
import Alerts from "./pages/Alerts";
import LogViewerPage from "./pages/LogViewer";
import JiraAutomation from "./pages/JiraAutomation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/terraform" element={<TerraformGenerator />} />
            <Route path="/gke" element={<GKEDashboard />} />
            <Route path="/cicd" element={<CICDBuilder />} />
            <Route path="/costs" element={<CostDashboard />} />
            <Route path="/security" element={<SecurityAnalyzer />} />
            <Route path="/monitoring-agent" element={<MonitoringAgent />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/logs" element={<LogViewerPage />} />
            <Route path="/jira-automation" element={<JiraAutomation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
