import React from 'react';
import { Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Common pages
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Account } from './pages/Account';
import { NotFound } from './pages/NotFound';
import { RegulationRAG } from './pages/common/RegulationRAG';
import { NotificationsCenter } from './pages/common/NotificationsCenter';

// Student pages (S01 - S09)
import { StudentDashboard } from './pages/student/Dashboard';
import { SubmitEvidence } from './pages/student/SubmitEvidence';
import { EvidenceList } from './pages/student/EvidenceList';
import { EvidenceDetail } from './pages/student/EvidenceDetail';
import { SupplementEvidence } from './pages/student/SupplementEvidence';
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
import { StudentAssessment } from './pages/officer/StudentAssessment';
import { CriteriaRulesView } from './pages/officer/CriteriaRulesView';
import { EvaluationsByClass } from './pages/officer/EvaluationsByClass';
import { StudentsDirectory } from './pages/officer/StudentsDirectory';

// Admin pages (A01 - A11)
import { AdminDashboard } from './pages/admin/Dashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { TermsMasterData } from './pages/admin/TermsMasterData';
import { CriteriaManager } from './pages/admin/CriteriaManager';
import { KnowledgeBase } from './pages/admin/KnowledgeBase';
import { EvidenceInspection } from './components/EvidenceInspection';
import { ResultsReception } from './pages/admin/ResultsReception';
import { ResultReports } from './components/ResultReports';
import { Monitoring } from './pages/admin/Monitoring';
import { ProfileDataIssues } from './pages/admin/ProfileDataIssues';

// Redirect root theo vai trò hiện tại
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user || !user.role) return <Navigate to="/login" replace />;
  if (user.role === 'STAFF') return <Navigate to="/officer" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/student" replace />;
};

const OfficerReportsRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const search = params.toString();
  return <Navigate to={`/officer${search ? `?${search}` : ''}#ket-qua`} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Các trang xác thực công khai */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/organizer-confirm/:token" element={<Navigate to="/login" replace />} />

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
        <Route path="regulations" element={<RegulationRAG />} />
        <Route path="regulations/ask" element={<Navigate to="/regulations" replace />} />
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
          <Route path="evidence/new" element={<Navigate to="/student/scores" replace />} />
          <Route path="evidence/:id" element={<EvidenceDetail />} />
          <Route path="evidence/:id/supplement" element={<SupplementEvidence />} />
          <Route path="criteria" element={<Navigate to="/student/scores" replace />} />
          <Route path="appeals" element={<Appeals />} />
          <Route path="what-can-i-claim" element={<Navigate to="/student/scores" replace />} />
          <Route path="scores" element={<ScoreReport />} />
        </Route>

        {/* Phân hệ Cán bộ (Officer) */}
        <Route
          path="officer"
          element={
            <ProtectedRoute allowedRoles={['STAFF']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<OfficerDashboard />} />
          <Route path="evaluations" element={<EvaluationsByClass />} />
          <Route path="queue" element={<ReviewQueue />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="activities" element={<InternalActivities />} />
          <Route path="external-activities" element={<Navigate to="/officer/activities" replace />} />
          <Route path="appeals" element={<AppealsResolution />} />
          <Route path="criteria" element={<CriteriaRulesView />} />
          <Route path="students" element={<StudentLookup />} />
          <Route path="students-directory" element={<StudentsDirectory />} />
          <Route path="students/:studentId/assessment" element={<StudentAssessment />} />
          <Route path="reports" element={<OfficerReportsRedirect />} />
          <Route path="students/legacy" element={<OfficerReportsRedirect />} />
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
          <Route path="users/issues" element={<ProfileDataIssues />} />
          <Route path="results" element={<ResultsReception />} />
          <Route path="evidence/:id" element={<EvidenceInspection />} />
          <Route path="reports" element={<ResultReports admin />} />
          <Route path="historical-results" element={<ResultReports admin />} />
          <Route path="results/:studentId" element={<StudentAssessment />} />
          <Route path="terms" element={<TermsMasterData />} />
          <Route path="criteria" element={<CriteriaManager />} />
          <Route path="rules" element={<Navigate to="/admin/criteria" replace />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="ai-center" element={<Navigate to="/admin" replace />} />
          <Route path="ai-config" element={<Navigate to="/admin" replace />} />
          <Route path="ground-truth" element={<Navigate to="/admin" replace />} />
          <Route path="ai-evaluation" element={<Navigate to="/admin" replace />} />
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
