import React, { useEffect } from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import Layout from "./components/Layout";
import { Empty } from "./components/UI";
import Dashboard from "./pages/Dashboard";
import NewPrint from "./pages/NewPrint";
import Jobs, { JobDetail } from "./pages/Jobs";
import AdminRoute from "./components/AdminRoute";
import AdminLogin from "./pages/AdminLogin";
import {
  Printers,
  Analytics,
  Insights,
  Pricing,
  Settings,
  UsersPage,
} from "./pages/Management";
import Home from "./pages/Home";
import { api } from "./services/api";
function AgentTools() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const life = new AbortController();
    const options = { signal: life.signal };
    try {
      Promise.resolve(
        document.modelContext.registerTool(
          {
            name: "list_print_jobs",
            description: "Read print jobs in the current AutoPrint workspace.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input) => {
              if (!input || Object.keys(input).length)
                throw new Error("No arguments expected");
              return (await api("/jobs")).map((j) => ({
                id: j.id,
                document: j.document_name,
                status: j.status,
                sample: j.seed,
              }));
            },
          },
          options,
        ),
      ).catch(() => {});
      Promise.resolve(
        document.modelContext.registerTool(
          {
            name: "start_new_print",
            description:
              "Open the upload workflow. This does not upload a file, charge money, or create a print job.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input) => {
              if (!input || Object.keys(input).length)
                throw new Error("No arguments expected");
              navigate("/new");
              await new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r)),
              );
              return { page: "/new", stage: "upload" };
            },
          },
          options,
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [navigate]);
  return null;
}
export default function App() {
  return (
    <WorkspaceProvider>
      <AgentTools />
     <Routes>
  <Route path="/home" element={<Home />} />
  <Route path="/admin/login" element={<AdminLogin />} />

  <Route element={<Layout />}>
   <Route index element={<Navigate to="/new" replace />} />
    <Route path="/new" element={<NewPrint />} />
    <Route path="/jobs" element={<Jobs />} />
    <Route path="/jobs/:id" element={<JobDetail />} />
    <Route path="/queue" element={<Jobs queue />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/usage" element={<Analytics />} />
    <Route path="/settings" element={<Settings />} />

    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<Dashboard admin />} />
      <Route path="/admin/orders" element={<Jobs admin />} />
      <Route path="/admin/queue" element={<Jobs admin queue />} />
      <Route path="/admin/printers" element={<Printers />} />
      <Route path="/admin/users" element={<UsersPage />} />
      <Route path="/admin/pricing" element={<Pricing />} />
      <Route path="/admin/analytics" element={<Analytics />} />
      <Route path="/admin/insights" element={<Insights />} />
      <Route path="/admin/settings" element={<Settings admin />} />
    </Route>

    <Route
      path="*"
      element={
        <Empty
          title="Page not found"
          text="Return to your workspace."
          action={
            <Link to="/" className="button primary">
              Back to dashboard
            </Link>
          }
        />
      }
    />
  </Route>
</Routes>
    </WorkspaceProvider>
  );
}
