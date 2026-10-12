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
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor đính kèm Token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('edupoint_auth_token');
  if (token && !token.startsWith('mock_')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor xử lý lỗi 401
http.interceptors.response.use(
  (response) => response,
  (error) => {
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
  return [];
}

// API Client Wrapper - 100% Backend API Calls
export const apiClient = {
  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
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
    try {
      const res = await http.get('/terms');
      return extractArray<Term>(res.data.data);
    } catch {
      return [];
    }
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

  async updateTerm(id: string, data: any): Promise<Term> {
    const res = await http.patch(`/terms/${id}`, data);
    return res.data.data;
  },

  async closeTerm(id: string): Promise<Term> {
    const res = await http.post(`/terms/${id}/close`);
    return res.data.data;
  },

  // ==========================================
  // CRITERIA ENDPOINTS (CRI-01)
  // ==========================================
  async getCriteria(): Promise<Criterion[]> {
    try {
      const res = await http.get('/criteria');
      return extractArray<Criterion>(res.data.data);
    } catch {
      return [];
    }
  },

  // ==========================================
  // ACTIVITIES & ATTENDANCE
  // ==========================================
  async getActivities(params?: { type?: string; search?: string }): Promise<Activity[]> {
    try {
      const res = await http.get('/activities', { params });
      return extractArray<Activity>(res.data.data);
    } catch {
      return [];
    }
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
    const res = await http.post(`/activities/${activityId}/attendance`, data);
    return res.data.data;
  },

  async getActivityParticipants(activityId: string): Promise<any[]> {
    try {
      const res = await http.get(`/activities/${activityId}/attendance`);
      return extractArray<any>(res.data.data);
    } catch {
      return [];
    }
  },

  // ==========================================
  // EVIDENCES (EVD-05, EVD-06, EVD-01, EVD-09)
  // ==========================================
  async getEvidences(params?: { studentId?: string; status?: string; termId?: string; page?: number; pageSize?: number }): Promise<Evidence[]> {
    try {
      const res = await http.get('/evidence', { params });
      return extractArray<Evidence>(res.data.data);
    } catch {
      return [];
    }
  },

  async getEvidenceById(id: string): Promise<Evidence | null> {
    const res = await http.get(`/evidence/${id}`);
    return res.data.data;
  },

  async createEvidence(data: any): Promise<Evidence> {
    const res = await http.post('/evidence', data);
    return res.data.data;
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
        fileUrl: f.fileUrl || f.url || 'https://placehold.co/600x400.png',
        fileType: f.fileType || f.type || 'image/png',
      });
    }
    return (await http.get(`/evidence/${id}`)).data.data;
  },

  async deleteEvidenceDraft(id: string): Promise<void> {
    await http.delete(`/evidence/${id}`);
  },

  // ==========================================
  // REVIEW & QUEUE (REV-01, REV-03, REV-04)
  // ==========================================
  async getReviewQueue(params?: { status?: string; termId?: string; search?: string; page?: number; pageSize?: number }): Promise<Evidence[]> {
    try {
      const res = await http.get('/reviews/queue', { params });
      return extractArray<Evidence>(res.data.data);
    } catch {
      return [];
    }
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
  async getAppeals(params?: { status?: string; page?: number; pageSize?: number }): Promise<Appeal[]> {
    try {
      const res = await http.get('/appeals', { params });
      return extractArray<Appeal>(res.data.data);
    } catch {
      return [];
    }
  },

  async createAppeal(data: Partial<Appeal>): Promise<Appeal> {
    const res = await http.post('/appeals', data);
    return res.data.data;
  },

  async resolveAppeal(id: string, data: { action: 'ACCEPTED' | 'REJECTED'; resolutionNote: string; reopenReview?: boolean }): Promise<Appeal> {
    const res = await http.post(`/appeals/${id}/resolve`, data);
    return res.data.data;
  },

  // ==========================================
  // NOTIFICATIONS (NOTI-01, NOTI-02)
  // ==========================================
  async getNotifications(): Promise<Notification[]> {
    try {
      const res = await http.get('/notifications');
      return extractArray<Notification>(res.data.data);
    } catch {
      return [];
    }
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
    try {
      const res = await http.get('/users', { params });
      return extractArray<User>(res.data.data);
    } catch {
      return [];
    }
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

  // ==========================================
  // FACULTIES & CLASSES MASTER DATA
  // ==========================================
  async getFaculties(): Promise<Faculty[]> {
    try {
      const res = await http.get('/faculties');
      return extractArray<Faculty>(res.data.data);
    } catch {
      return [];
    }
  },

  async getClasses(facultyId?: string): Promise<Class[]> {
    try {
      const res = await http.get('/classes', { params: { facultyId } });
      return extractArray<Class>(res.data.data);
    } catch {
      return [];
    }
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
};
