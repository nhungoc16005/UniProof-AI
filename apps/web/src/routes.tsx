import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Common pages
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Account } from './pages/Account';
import { NotFound } from './pages/NotFound';
import { RegulationRAG } from './pages/common/RegulationRAG';
import { NotificationsCenter } from './pages/common/NotificationsCenter';
import { OrganizerConfirm } from './pages/common/OrganizerConfirm';

// Student pages (S01 - S09)
import { StudentDashboard } from './pages/student/Dashboard';
import { SubmitEvidence } from './pages/student/SubmitEvidence';
import { EvidenceList } from './pages/student/EvidenceList';
import { EvidenceDetail } from './pages/student/EvidenceDetail';
import { SupplementEvidence } from './pages/student/SupplementEvidence';
import { CriteriaView } from './pages/student/CriteriaView';
import { Appeals } from './pages/student/Appeals';
import { ScoreReport } from './pages/student/ScoreReport';

// Officer pages (O01 - O10)
import { OfficerDashboard } from './pages/officer/Dashboard';
import { ReviewQueue } from './pages/officer/ReviewQueue';
import { ReviewDetail } from './pages/officer/ReviewDetail';
import { InternalActivities } from './pages/officer/InternalActivities';
import { ExternalActivities } from './pages/officer/ExternalActivities';
import { AppealsResolution } from './pages/officer/AppealsResolution';
import { StudentLookup } from './pages/officer/StudentLookup';
import { OfficerReports } from './pages/officer/Reports';
import { CriteriaRulesView } from './pages/officer/CriteriaRulesView';

// Admin pages (A01 - A11)
import { AdminDashboard } from './pages/admin/Dashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { TermsMasterData } from './pages/admin/TermsMasterData';
import { CriteriaManager } from './pages/admin/CriteriaManager';
import { RuleEngineEditor } from './pages/admin/RuleEngineEditor';
import { KnowledgeBase } from './pages/admin/KnowledgeBase';
import { AiCenter } from './pages/admin/AiCenter';
import { AiConfig } from './pages/admin/AiConfig';
import { GroundTruth } from './pages/admin/GroundTruth';
import { AiEvaluation } from './pages/admin/AiEvaluation';
import { Monitoring } from './pages/admin/Monitoring';
import { AuditLogs } from './pages/admin/AuditLogs';
import { SystemHealth } from './pages/admin/SystemHealth';

// Redirect root theo vai trò hiện tại
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user || !user.role) return <Navigate to="/login" replace />;
  if (user.role === 'STAFF') return <Navigate to="/officer" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/student" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Các trang xác thực công khai */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/organizer-confirm/:token" element={<OrganizerConfirm />} />

      {/* 2. Hệ thống chính (Cần đăng nhập qua ProtectedRoute) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RootRedirect />} />
        <Route path="account" element={<Account />} />
        <Route path="regulations/ask" element={<RegulationRAG />} />
        <Route path="notifications" element={<NotificationsCenter />} />

        {/* Phân hệ Sinh viên (Student) */}
        <Route
          path="student"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="evidence" element={<EvidenceList />} />
          <Route path="evidence/new" element={<SubmitEvidence />} />
          <Route path="evidence/:id" element={<EvidenceDetail />} />
          <Route path="evidence/:id/supplement" element={<SupplementEvidence />} />
          <Route path="criteria" element={<CriteriaView />} />
          <Route path="appeals" element={<Appeals />} />
          <Route path="what-can-i-claim" element={<Navigate to="/student/criteria" replace />} />
          <Route path="scores" element={<ScoreReport />} />
        </Route>

        {/* Phân hệ Cán bộ (Officer) */}
        <Route
          path="officer"
          element={
            <ProtectedRoute allowedRoles={['STAFF', 'ADMIN']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<OfficerDashboard />} />
          <Route path="queue" element={<ReviewQueue />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="activities" element={<InternalActivities />} />
          <Route path="external-activities" element={<Navigate to="/officer/activities" replace />} />
          <Route path="appeals" element={<AppealsResolution />} />
          <Route path="criteria" element={<CriteriaRulesView />} />
          <Route path="students" element={<StudentLookup />} />
          <Route path="reports" element={<Navigate to="/officer/students" replace />} />
        </Route>

        {/* Phân hệ Quản trị viên (Admin) */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="terms" element={<TermsMasterData />} />
          <Route path="criteria" element={<CriteriaManager />} />
          <Route path="rules" element={<Navigate to="/admin/criteria" replace />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="ai-center" element={<AiCenter />} />
          <Route path="ai-config" element={<Navigate to="/admin/ai-center" replace />} />
          <Route path="ground-truth" element={<Navigate to="/admin/ai-center" replace />} />
          <Route path="ai-evaluation" element={<Navigate to="/admin/ai-center" replace />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="audit-logs" element={<Navigate to="/admin/monitoring" replace />} />
          <Route path="health" element={<Navigate to="/admin/monitoring" replace />} />
        </Route>

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};
