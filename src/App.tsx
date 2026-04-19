import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GKEDashboard from "./pages/GKEDashboard";
import MonitoringAgent from "./pages/MonitoringAgent";
import Alerts from "./pages/Alerts";
import LogViewerPage from "./pages/LogViewer";
import JiraAutomation from "./pages/JiraAutomation";
import NotFound from "./pages/NotFound";

// Labs (hidden from nav, still accessible via direct URL)
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
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — viewer+ (all authenticated users) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gke"
              element={
                <ProtectedRoute>
                  <Layout><GKEDashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring-agent"
              element={
                <ProtectedRoute>
                  <Layout><MonitoringAgent /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Layout><Alerts /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <Layout><LogViewerPage /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/jira-automation"
              element={
                <ProtectedRoute minimumRole="operator">
                  <Layout><JiraAutomation /></Layout>
                </ProtectedRoute>
              }
            />

            {/* Labs — operator+ only, hidden from nav */}
            <Route
              path="/terraform"
              element={
                <ProtectedRoute minimumRole="operator">
                  <Layout><TerraformGenerator /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cicd"
              element={
                <ProtectedRoute minimumRole="operator">
                  <Layout><CICDBuilder /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/costs"
              element={
                <ProtectedRoute minimumRole="operator">
                  <Layout><CostDashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/security"
              element={
                <ProtectedRoute minimumRole="operator">
                  <Layout><SecurityAnalyzer /></Layout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
