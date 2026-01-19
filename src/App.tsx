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
import DeploymentManager from "./pages/DeploymentManager";
import CostDashboard from "./pages/CostDashboard";
import SecurityAnalyzer from "./pages/SecurityAnalyzer";
import BackupAutomation from "./pages/BackupAutomation";
import ChatOps from "./pages/ChatOps";
import MonitoringAgent from "./pages/MonitoringAgent";
import Alerts from "./pages/Alerts";
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
            <Route path="/deployment" element={<DeploymentManager />} />
            <Route path="/costs" element={<CostDashboard />} />
            <Route path="/security" element={<SecurityAnalyzer />} />
            <Route path="/backup" element={<BackupAutomation />} />
            <Route path="/chatops" element={<ChatOps />} />
            <Route path="/monitoring-agent" element={<MonitoringAgent />} />
            <Route path="/alerts" element={<Alerts />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
