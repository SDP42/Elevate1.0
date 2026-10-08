import DocumentPage from "./DocumentPage";
import { Navigate, Route, Routes } from "react-router-dom";
import "./portal.css";
import Login from "./Login";
import TeamDashboard from "./TeamDashboard";
import AdminDashboard from "./AdminDashboard";
import CoreDashboard from "./CoreDashboard";
import MealDashboard from "./MealDashboard";
import RegiDeskDashboard from "./RegiDeskDashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";

export default function Portal() {
  return (
    <Routes>
      <Route path="document" element={<DocumentPage />} />
      <Route path="login" element={<Login />} />
      <Route path="team" element={<TeamDashboard />} />
      <Route path="admin" element={<AdminDashboard />} />
      <Route path="core" element={<CoreDashboard />} />
      <Route path="meal" element={<MealDashboard />} />
      <Route path="regidesk" element={<RegiDeskDashboard />} />
      <Route path="superadmin" element={<SuperAdminDashboard />} />
      <Route path="*" element={<Navigate to="/portal/login" replace />} />
    </Routes>
  );
}
