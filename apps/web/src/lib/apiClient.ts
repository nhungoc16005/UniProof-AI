import axios from 'axios';
import { 
  Evidence, 
  User, 
  Term, 
  Criterion, 
  Notification, 
  ReviewDecision, 
  Appeal,
  Activity,
  Faculty,
  Class,
  RubricPayload,
  CriterionAssessment,
  EvidenceFile,
  RubricDefinition,
  RubricTemplate,
  RubricTemplateVersionSummary,
} from '../types';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor đính kèm Token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('edupoint_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor xử lý lỗi 401
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Backend wraps errors in { error: { message } }; page handlers read message.
    const payload = error.response?.data;
    if (payload?.error?.message && !payload.message) {
      payload.message = payload.error.message;
    }
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('edupoint_auth_token');
      localStorage.removeItem('edupoint_auth_token');
      localStorage.removeItem('edupoint_current_user');
      if (hadToken && !window.location.pathname.includes('/login')) {
        console.warn('Phiên đăng nhập đã hết hạn. Chuyển hướng tới trang đăng nhập.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper trích xuất mảng an toàn từ response API
function extractArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  throw new Error('API response không có danh sách dữ liệu hợp lệ.');
}

// API Client Wrapper - 100% Backend API Calls
export const apiClient = {
  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
  async getReviewQueuePage(params: any): Promise<{ items: Evidence[]; total: number }> {
    const response = await http.get('/reviews/queue', { params });
    const items = extractArray<Evidence>(response.data.data);
    return {
      items,
      total: Number(response.data.meta?.total ?? items.length),
    };
  },
  async getEvaluationWorkflow(termId: string, params?: { classId?: string; facultyId?: string }) {
    return (await http.get('/evaluation-workflow/' + termId, { params })).data.data;
  },
  async sendFacultyResults(termId: string, studentIds: string[]) {
    return (await http.post('/evaluation-workflow/' + termId + '/send', { studentIds })).data.data;
  },
  async returnFacultyResult(termId: string, studentId: string, reason: string) {
    return (await http.post('/evaluation-workflow/' + termId + '/students/' + studentId + '/return', { reason })).data.data;
  },
  async recordNonSubmission(termId: string, studentId: string, reason: string) {
    return (await http.post('/evaluation-workflow/' + termId + '/students/' + studentId + '/not-submitted', { reason })).data.data;
  },
  async publishResults(termId: string) {
    return (await http.post('/evaluation-workflow/' + termId + '/publish')).data.data;
  },
  async getAssessmentHistory(termId: string, studentId: string) {
    return (await http.get('/evaluation-workflow/' + termId + '/students/' + studentId + '/history')).data.data;
  },
  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const response = await http.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    localStorage.setItem('edupoint_auth_token', accessToken);
    localStorage.setItem('edupoint_current_user', JSON.stringify(user));
    return { accessToken, user };
  },

  async getCurrentUser(): Promise<User> {
    const response = await http.get('/auth/me');
    const user = response.data.data;
    localStorage.setItem('edupoint_current_user', JSON.stringify(user));
    return user;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await http.post('/auth/change-password', { currentPassword, newPassword });
    return response.data.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await http.post('/auth/forgot-password', { email });
    return response.data.data;
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await http.post('/auth/reset-password', { token, newPassword });
    return response.data.data;
  },

  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout');
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      localStorage.removeItem('edupoint_auth_token');
      localStorage.removeItem('edupoint_current_user');
    }
  },

  // ==========================================
  // TERM ENDPOINTS
  // ==========================================
  async getTerms(): Promise<Term[]> {
    const res = await http.get('/terms');
    return extractArray<Term>(res.data.data);
  },

  async getActiveTerm(): Promise<Term> {
    const res = await http.get('/terms/active');
    return res.data.data;
  },

  async setActiveTerm(term: Term): Promise<Term> {
    localStorage.setItem('edupoint_active_term', JSON.stringify(term));
    return term;
  },

  async createTerm(data: any): Promise<Term> {
    const res = await http.post('/terms', data);
    return res.data.data;
  },

  async getRubricTemplates(): Promise<RubricTemplate[]> {
    const res = await http.get('/rubric-templates');
    return extractArray<RubricTemplate>(res.data.data);
  },

  async getRubricTemplateVersion(versionId: string): Promise<any> {
    const res = await http.get(`/rubric-templates/${versionId}`);
    return res.data.data;
  },

  async createRubricTemplateDraft(): Promise<RubricTemplateVersionSummary> {
    const res = await http.post('/rubric-templates/draft');
    return res.data.data;
  },

  async saveRubricTemplateDraft(versionId: string, definition: RubricDefinition, changeNote: string): Promise<RubricTemplateVersionSummary> {
    const res = await http.put(`/rubric-templates/${versionId}`, { definition, changeNote });
    return res.data.data;
  },

  async publishRubricTemplateDraft(versionId: string): Promise<RubricTemplateVersionSummary> {
    const res = await http.post(`/rubric-templates/${versionId}/publish`);
    return res.data.data;
  },

  async getTermRubric(termId: string): Promise<{ term: Term; rubricVersion: any; definition: RubricDefinition | null }> {
    const res = await http.get(`/terms/${termId}/rubric`);
    return res.data.data;
  },

  async saveTermRubricDraft(termId: string, definition: RubricDefinition, changeNote?: string): Promise<any> {
    const res = await http.put(`/terms/${termId}/rubric`, { definition, changeNote });
    return res.data.data;
  },

  async createTermRubricDraft(termId: string, data: { type: 'DEFAULT' | 'TERM'; sourceTermId?: string }): Promise<any> {
    const res = await http.post(`/terms/${termId}/rubric/draft`, data);
    return res.data.data;
  },

  async publishTermRubric(termId: string): Promise<any> {
    const res = await http.post(`/terms/${termId}/rubric/publish`);
    return res.data.data;
  },

  async updateTerm(id: string, data: any): Promise<Term> {
    const res = await http.patch(`/terms/${id}`, data);
    return res.data.data;
  },

  async closeTerm(id: string): Promise<Term> {
    const res = await http.post(`/terms/${id}/close`);
    return res.data.data;
  },

  async activateTerm(id: string): Promise<Term> {
    const res = await http.post(`/terms/${id}/activate`);
    return res.data.data;
  },

  async reopenTerm(id: string, reason?: string): Promise<Term> {
    const res = await http.post(`/terms/${id}/reopen`, { reason: reason || 'Mở lại theo quyết định hội đồng' });
    return res.data.data;
  },

  // ==========================================
  // CRITERIA ENDPOINTS (CRI-01)
  // ==========================================
  async getCriteria(termId?: string): Promise<Criterion[]> {
    const res = await http.get('/criteria', { params: { termId } });
    if (termId) return Array.isArray(res.data.data?.criteria) ? res.data.data.criteria : [];
    return extractArray<Criterion>(res.data.data);
  },

  async getRubric(termId: string): Promise<RubricPayload> {
    const res = await http.get('/criteria', { params: { termId } });
    return res.data.data;
  },

  async getMyAssessments(termId: string): Promise<RubricPayload> {
    const res = await http.get('/assessments/me', { params: { termId } });
    return res.data.data;
  },

  async saveSelfAssessment(termId: string, criterionId: string, data: { score?: number | null; note?: string }): Promise<CriterionAssessment> {
    const res = await http.put(`/assessments/me/${criterionId}`, data, { params: { termId } });
    return res.data.data;
  },

  async saveSelfAssessments(termId: string, scores: Array<{ criterionId: string; score: number | null }>): Promise<RubricPayload> {
    const res = await http.post('/assessments/me/save', { scores }, { params: { termId } });
    return res.data.data;
  },

  async submitSelfAssessment(termId: string): Promise<{ submission: NonNullable<RubricPayload['submission']>; submittedEvidenceCount: number }> {
    const res = await http.post('/assessments/me/submit', {}, { params: { termId } });
    return res.data.data;
  },

  async returnSelfAssessment(studentId: string, termId: string, reason: string): Promise<NonNullable<RubricPayload['submission']>> {
    const res = await http.put(`/assessments/students/${studentId}/${termId}/return`, { reason });
    return res.data.data;
  },

  async getStudentAssessments(studentId: string, termId: string): Promise<RubricPayload> {
    const res = await http.get(`/assessments/students/${studentId}`, { params: { termId } });
    return res.data.data;
  },

  async recordClassAssessment(studentId: string, termId: string, criterionId: string, data: { score: number; note: string }): Promise<CriterionAssessment> {
    const res = await http.put(`/assessments/students/${studentId}/${termId}/${criterionId}/class`, data);
    return res.data.data;
  },

  async verifyCriterion(studentId: string, termId: string, criterionId: string, data: { data: Record<string, unknown>; note: string }): Promise<CriterionAssessment> {
    const res = await http.put(`/assessments/students/${studentId}/${termId}/${criterionId}/verification`, data);
    return res.data.data;
  },

  async finalizeCriterion(studentId: string, termId: string, criterionId: string, data: { score?: number; reason?: string }): Promise<CriterionAssessment> {
    const res = await http.put(`/assessments/students/${studentId}/${termId}/${criterionId}/final`, data);
    return res.data.data;
  },

  async createCriterion(data: any): Promise<Criterion> {
    const res = await http.post('/criteria', data);
    return res.data.data;
  },

  async updateCriterion(id: string, data: any): Promise<Criterion> {
    const res = await http.patch(`/criteria/${id}`, data);
    return res.data.data;
  },

  async deleteCriterion(id: string): Promise<any> {
    const res = await http.delete(`/criteria/${id}`);
    return res.data.data;
  },

  // ==========================================
  // ACTIVITIES & ATTENDANCE
  // ==========================================
  async getActivities(params?: { type?: string; search?: string; termId?: string }): Promise<Activity[]> {
    const res = await http.get('/activities', { params });
    return extractArray<Activity>(res.data.data);
  },

  async getActivityById(id: string): Promise<Activity> {
    const res = await http.get(`/activities/${id}`);
    return res.data.data;
  },

  async createActivity(data: any): Promise<Activity> {
    const res = await http.post('/activities', data);
    return res.data.data;
  },

  async addActivityAttendance(activityId: string, data: { studentCode: string; role?: string }): Promise<any> {
    const res = await http.post(`/activities/${activityId}/attendance`, {
      studentCode: data.studentCode,
      formRole: data.role,
    });
    return res.data.data;
  },

  async batchAddActivityParticipants(activityId: string, data: { studentCodes: string[]; formRole?: string }): Promise<any> {
    const res = await http.post(`/activities/${activityId}/attendance/batch`, data);
    return res.data.data;
  },

  async deleteActivityParticipant(activityId: string, participantId: string): Promise<any> {
    const res = await http.delete(`/activities/${activityId}/attendance/${participantId}`);
    return res.data.data;
  },

  async getActivityParticipants(activityId: string): Promise<any[]> {
    const res = await http.get(`/activities/${activityId}/attendance`);
    return extractArray<any>(res.data.data);
  },

  async updateActivity(id: string, data: any): Promise<Activity> {
    const res = await http.patch(`/activities/${id}`, data);
    return res.data.data;
  },

  async deleteActivity(id: string): Promise<any> {
    const res = await http.delete(`/activities/${id}`);
    return res.data.data;
  },

  // ==========================================
  // EVIDENCES (EVD-05, EVD-06, EVD-01, EVD-09)
  // ==========================================
  async getEvidences(params?: {
    studentId?: string;
    status?: string;
    termId?: string;
    classId?: string;
    search?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<Evidence[]> {
    const res = await http.get('/evidence', { params });
    return extractArray<Evidence>(res.data.data);
  },

  async getEvidenceById(id: string): Promise<Evidence | null> {
    const res = await http.get(`/evidence/${id}`);
    return res.data.data;
  },

  async createEvidence(data: any): Promise<Evidence> {
    const res = await http.post('/evidence', data);
    return res.data.data;
  },

  async uploadEvidenceDraftFile(evidenceId: string, fileData: string, fileName: string, fileType: string): Promise<EvidenceFile> {
    const res = await http.post(`/evidence/${evidenceId}/files/upload`, { fileData, fileName, fileType });
    return res.data.data;
  },

  async deleteEvidenceDraftFile(evidenceId: string, fileId: string): Promise<void> {
    await http.delete(`/evidence/${evidenceId}/files/${fileId}`);
  },

  async submitEvidence(id: string): Promise<Evidence> {
    const res = await http.post(`/evidence/${id}/submit`);
    return res.data.data;
  },

  async withdrawEvidence(id: string): Promise<Evidence> {
    const res = await http.post(`/evidence/${id}/withdraw`);
    return res.data.data;
  },

  async supplementEvidence(id: string, files: any[]): Promise<Evidence> {
    for (const f of files) {
      await http.post(`/evidence/${id}/files`, {
        fileUrl: f.fileUrl || f.url,
        fileType: f.fileType || f.type || 'image/png',
      });
    }
    return (await http.get(`/evidence/${id}`)).data.data;
  },

  async deleteEvidenceDraft(id: string): Promise<void> {
    await http.delete(`/evidence/${id}`);
  },

  async updateEvidence(id: string, data: any): Promise<Evidence> {
    const res = await http.patch(`/evidence/${id}`, data);
    return res.data.data;
  },

  async deleteEvidence(id: string): Promise<any> {
    const res = await http.delete(`/evidence/${id}`);
    return res.data.data;
  },

  // ==========================================
  // REVIEW & QUEUE (REV-01, REV-03, REV-04)
  // ==========================================
  async getReviewQueue(params?: {
    status?: string;
    termId?: string;
    classId?: string;
    search?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<Evidence[]> {
    const res = await http.get('/reviews/queue', { params });
    return extractArray<Evidence>(res.data.data);
  },

  async claimEvidence(id: string): Promise<Evidence> {
    const res = await http.post(`/evidence/${id}/claim`);
    return res.data.data;
  },

  async releaseEvidence(id: string): Promise<Evidence> {
    const res = await http.post(`/evidence/${id}/release`);
    return res.data.data;
  },

  async reviewEvidence(evidenceId: string, payload: any): Promise<Evidence> {
    return this.submitReviewDecision(
      evidenceId,
      payload.decision || payload.action,
      payload.reason || payload.comment,
      payload.finalScore ?? payload.approvedPoints,
      payload.criterionId
    );
  },

  async submitReviewDecision(
    evidenceId: string, 
    decision: ReviewDecision, 
    reason: string, 
    finalScore?: number,
    criterionId?: string
  ): Promise<Evidence> {
    const res = await http.post(`/evidence/${evidenceId}/review`, {
      action: decision,
      comment: reason,
      approvedPoints: finalScore,
      criterionId,
    });
    return res.data.data;
  },

  // ==========================================
  // APPEALS (APL-01, APL-04)
  // ==========================================
  async getAppeals(params?: { termId?: string; status?: string; page?: number; pageSize?: number }): Promise<Appeal[]> {
    const res = await http.get('/appeals', { params });
    return extractArray<Appeal>(res.data.data);
  },

  async getAppealsPage(params?: { termId?: string; status?: string; page?: number; pageSize?: number }): Promise<{ items: Appeal[]; total: number }> {
    const res = await http.get('/appeals', { params });
    const items = extractArray<Appeal>(res.data.data);
    return {
      items,
      total: Number(res.data.meta?.total ?? items.length),
    };
  },

  async createAppeal(data: any): Promise<Appeal> {
    const res = await http.post('/appeals', data);
    return res.data.data;
  },

  async resolveAppeal(id: string, data: any): Promise<Appeal> {
    const res = await http.post(`/appeals/${id}/resolve`, data);
    return res.data.data;
  },

  // ==========================================
  // NOTIFICATIONS (NOTI-01, NOTI-02)
  // ==========================================
  async getNotifications(): Promise<Notification[]> {
    const res = await http.get('/notifications');
    return extractArray<Notification>(res.data.data);
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await http.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsAsRead(): Promise<void> {
    await http.patch('/notifications/read-all');
  },

  // ==========================================
  // USER MANAGEMENT (A02)
  // ==========================================
  async getUsers(params?: { role?: string; facultyId?: string; classId?: string; search?: string; page?: number; pageSize?: number }): Promise<User[]> {
    const res = await http.get('/users', { params });
    return extractArray<User>(res.data.data);
  },

  async getUserById(id: string): Promise<User> {
    const res = await http.get(`/users/${id}`);
    return res.data.data;
  },

  async createUser(data: any): Promise<User> {
    const res = await http.post('/users', data);
    return res.data.data;
  },

  async updateUser(id: string, data: any): Promise<User> {
    const res = await http.patch(`/users/${id}`, data);
    return res.data.data;
  },

  async bulkImportUsers(users: any[]): Promise<{ total: number; importedCount: number; updatedCount: number; errorCount: number; errors: string[] }> {
    const res = await http.post('/users/import', { users });
    return res.data.data;
  },

  async deleteUser(id: string): Promise<any> {
    const res = await http.delete(`/users/${id}`);
    return res.data.data;
  },

  // ==========================================
  // FACULTIES & CLASSES MASTER DATA
  // ==========================================
  async getFaculties(): Promise<Faculty[]> {
    const res = await http.get('/faculties');
    return extractArray<Faculty>(res.data.data);
  },

  async createFaculty(data: { code: string; name: string }): Promise<Faculty> {
    const res = await http.post('/faculties', data);
    return res.data.data;
  },

  async updateFaculty(id: string, data: { code?: string; name?: string }): Promise<Faculty> {
    const res = await http.patch(`/faculties/${id}`, data);
    return res.data.data;
  },

  async deleteFaculty(id: string): Promise<any> {
    const res = await http.delete(`/faculties/${id}`);
    return res.data.data;
  },

  async getClasses(facultyId?: string): Promise<Class[]> {
    const res = await http.get('/classes', { params: { facultyId } });
    return extractArray<Class>(res.data.data);
  },

  async createClass(data: { code: string; name?: string; cohort: string; facultyId: string }): Promise<Class> {
    const res = await http.post('/classes', data);
    return res.data.data;
  },

  async updateClass(id: string, data: { code?: string; name?: string; cohort?: string; facultyId?: string }): Promise<Class> {
    const res = await http.patch(`/classes/${id}`, data);
    return res.data.data;
  },

  async deleteClass(id: string): Promise<any> {
    const res = await http.delete(`/classes/${id}`);
    return res.data.data;
  },

  // ==========================================
  // CONDUCT SCORES & DASHBOARD
  // ==========================================
  async getConductDashboard(termId?: string): Promise<any> {
    const res = await http.get('/scores/dashboard', { params: { termId } });
    return res.data.data;
  },

  async getStudentScore(studentId: string, termId?: string): Promise<any> {
    const res = await http.get(`/scores/${studentId}`, { params: { termId } });
    return res.data.data;
  },

  async traceEvidenceScore(evidenceId: string): Promise<any> {
    const res = await http.get(`/scores/trace/${evidenceId}`);
    return res.data.data;
  },

  async getClassScores(classId: string, termId?: string): Promise<any> {
    const res = await http.get(`/scores/class/${classId}`, { params: { termId } });
    return res.data.data;
  },

  // ==========================================
  // REPORTS & ADMIN ANALYTICS
  // ==========================================
  async getKpiSummary(termId?: string): Promise<any> {
    const res = await http.get('/reports/summary', { params: { termId } });
    return res.data.data;
  },

  async getFacultyReports(termId?: string): Promise<any[]> {
    const res = await http.get('/reports/faculties', { params: { termId } });
    return extractArray<any>(res.data.data);
  },

  // ==========================================
  // KNOWLEDGE BASE (REGULATION DOCUMENTS)
  // ==========================================
  async getRegulations(): Promise<any[]> {
    const res = await http.get('/regulations');
    return extractArray<any>(res.data.data);
  },

  async createRegulation(data: { title: string; version: string; fileUrl?: string; effectiveDate?: string }): Promise<any> {
    const res = await http.post('/regulations', data);
    return res.data.data;
  },

  async deleteRegulation(id: string): Promise<any> {
    const res = await http.delete(`/regulations/${id}`);
    return res.data.data;
  },

  // ==========================================
  // AUDIT LOGS & HEALTH CHECK
  // ==========================================
  async getAuditLogs(params?: { userId?: string; action?: string; entityType?: string; page?: number; pageSize?: number }): Promise<{ items: any[]; total: number }> {
    const res = await http.get('/audit-logs', { params });
    const data = res.data.data;
    if (!data || !Array.isArray(data.items) || typeof data.total !== 'number') {
      throw new Error('API nhật ký trả về dữ liệu không đúng định dạng.');
    }
    return data;
  },

  async getSystemHealth(): Promise<any> {
    const res = await http.get('/health');
    return res.data.data;
  },
};
