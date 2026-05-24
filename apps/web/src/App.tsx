import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ApronCvPage } from "./pages/ApronCvPage";
import { AuditPage } from "./pages/AuditPage";
import { ForecastPage } from "./pages/ForecastPage";
import { GateApprovalPage } from "./pages/GateApprovalPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SensorsPage } from "./pages/SensorsPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/forecast" replace />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/gate-approval" element={<GateApprovalPage />} />
        <Route path="/apron-cv" element={<ApronCvPage />} />
        <Route path="/sensors" element={<SensorsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/forecast" replace />} />
      </Route>
    </Routes>
  );
}
