import axios from 'axios';
import { 
  Evidence, 
  User, 
  Term, 
  Criterion, 
  Notification, 
  ReviewDecision, 
  Appeal,
} from '../types';
import { 
  mockUsers, 
  mockTerms, 
  mockCriteria, 
  mockEvidences, 
  mockNotifications,
  mockActivities 
} from './mockData';

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
      console.warn('Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
      localStorage.removeItem('edupoint_auth_token');
      localStorage.removeItem('edupoint_current_user');
      // Nếu đang ở trang không phải login thì redirect
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Fallback Local Storage cho các module chưa có API ở Sprint 1
class EduPointStorage {
  private evidencesKey = 'edupoint_evidences';
  private currentTermKey = 'edupoint_active_term';
  private currentUserKey = 'edupoint_current_user';
  private notificationsKey = 'edupoint_notifications';

  constructor() {
    if (!localStorage.getItem(this.evidencesKey)) {
      localStorage.setItem(this.evidencesKey, JSON.stringify(mockEvidences));
    }
    if (!localStorage.getItem(this.currentTermKey)) {
      localStorage.setItem(this.currentTermKey, JSON.stringify(mockTerms[0]));
    }
    if (!localStorage.getItem(this.notificationsKey)) {
      localStorage.setItem(this.notificationsKey, JSON.stringify(mockNotifications));
    }
  }

  getEvidences(): Evidence[] {
    const data = localStorage.getItem(this.evidencesKey);
    return data ? JSON.parse(data) : mockEvidences;
  }

  saveEvidences(evidences: Evidence[]) {
    localStorage.setItem(this.evidencesKey, JSON.stringify(evidences));
  }

  getCurrentUser(): User {
    const data = localStorage.getItem(this.currentUserKey);
    return data ? JSON.parse(data) : mockUsers.student;
  }

  setCurrentUser(user: User) {
    localStorage.setItem(this.currentUserKey, JSON.stringify(user));
  }

  getCurrentTerm(): Term {
    const data = localStorage.getItem(this.currentTermKey);
    return data ? JSON.parse(data) : mockTerms[0];
  }

  setCurrentTerm(term: Term) {
    localStorage.setItem(this.currentTermKey, JSON.stringify(term));
  }

  getNotifications(): Notification[] {
    const data = localStorage.getItem(this.notificationsKey);
    return data ? JSON.parse(data) : mockNotifications;
  }

  saveNotifications(notifs: Notification[]) {
    localStorage.setItem(this.notificationsKey, JSON.stringify(notifs));
  }
}

const storage = new EduPointStorage();

// API Client Wrapper tuân thủ contract
export const apiClient = {
  // ==========================================
  // AUTH ENDPOINTS (GỌI BACKEND THẬT NESTJS)
  // ==========================================
  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const response = await http.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    localStorage.setItem('edupoint_auth_token', accessToken);
    localStorage.setItem('edupoint_current_user', JSON.stringify(user));
    return { accessToken, user };
  },

  async getCurrentUser(): Promise<User> {
    const token = localStorage.getItem('edupoint_auth_token');
    if (!token || token.startsWith('mock_')) {
      return storage.getCurrentUser();
    }
    try {
      const response = await http.get('/auth/me');
      const user = response.data.data;
      storage.setCurrentUser(user);
      return user;
    } catch {
      return storage.getCurrentUser();
    }
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
      // bỏ qua lỗi nếu mạng rớt
    } finally {
      localStorage.removeItem('edupoint_auth_token');
      localStorage.removeItem('edupoint_current_user');
    }
  },

  // ==========================================
  // TERM ENDPOINTS
  // ==========================================
  async getTerms(): Promise<Term[]> {
    return mockTerms;
  },

  async getActiveTerm(): Promise<Term> {
    return storage.getCurrentTerm();
  },

  async setActiveTerm(term: Term): Promise<Term> {
    storage.setCurrentTerm(term);
    return term;
  },

  // ==========================================
  // CRITERIA ENDPOINTS (CRI-01)
  // ==========================================
  async getCriteria(): Promise<Criterion[]> {
    return mockCriteria;
  },

  // ==========================================
  // ACTIVITIES
  // ==========================================
  async getActivities() {
    return mockActivities;
  },

  // ==========================================
  // EVIDENCES (EVD-05, EVD-06, EVD-01, EVD-09)
  // ==========================================
  async getEvidences(params?: { studentId?: string; status?: string; termId?: string }): Promise<Evidence[]> {
    let list = storage.getEvidences();
    if (params?.studentId) {
      list = list.filter((e) => e.studentId === params.studentId);
    }
    if (params?.status && params.status !== 'ALL') {
      list = list.filter((e) => e.status === params.status);
    }
    if (params?.termId) {
      list = list.filter((e) => e.termId === params.termId);
    }
    return list;
  },

  async getEvidenceById(id: string): Promise<Evidence | null> {
    const list = storage.getEvidences();
    return list.find((e) => e.id === id) || null;
  },

  async createEvidence(data: Partial<Evidence>): Promise<Evidence> {
    const list = storage.getEvidences();
    const currentUser = storage.getCurrentUser();
    const currentTerm = storage.getCurrentTerm();

    const newEvidence: Evidence = {
      id: `evd-${Date.now()}`,
      studentId: currentUser.id,
      student: currentUser,
      termId: currentTerm.id,
      term: currentTerm,
      declaredActivityName: data.declaredActivityName || 'Hoạt động mới nộp',
      declaredRole: data.declaredRole || 'PARTICIPANT',
      evidenceType: data.evidenceType || 'GIAY_CHUNG_NHAN',
      status: 'PROCESSING',
      participationDate: data.participationDate || new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      files: data.files || [
        {
          id: `f-${Date.now()}`,
          evidenceId: `evd-${Date.now()}`,
          fileUrl: 'https://placehold.co/600x400/png?text=Minh+Chung+Mau',
          fileType: 'image/png',
          uploadedAt: new Date().toISOString(),
        },
      ],
      ocrResults: [],
      verificationResults: [],
      anomalyFlags: [],
      aiSuggestions: [],
    };

    list.unshift(newEvidence);
    storage.saveEvidences(list);
    return newEvidence;
  },

  async withdrawEvidence(id: string): Promise<Evidence> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (!item) throw new Error('Không tìm thấy minh chứng');
    item.status = 'WITHDRAWN';
    item.updatedAt = new Date().toISOString();
    storage.saveEvidences(list);
    return item;
  },

  async supplementEvidence(id: string, files: any[]): Promise<Evidence> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (!item) throw new Error('Không tìm thấy minh chứng');
    item.status = 'PROCESSING';
    item.files = [...(item.files || []), ...files];
    item.updatedAt = new Date().toISOString();
    storage.saveEvidences(list);
    return item;
  },

  // ==========================================
  // REVIEW & QUEUE (REV-01, REV-03, REV-04)
  // ==========================================
  async getReviewQueue(): Promise<Evidence[]> {
    const list = storage.getEvidences();
    return list.filter((e) => 
      e.status === 'PROCESSING' || 
      e.status === 'NEEDS_HUMAN_REVIEW' || 
      e.status === 'PLAUSIBLE' || 
      e.status === 'VERIFIED'
    );
  },

  async claimEvidence(id: string, officerId: string): Promise<Evidence> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (!item) throw new Error('Không tìm thấy minh chứng');
    item.lockedById = officerId;
    item.lockedAt = new Date().toISOString();
    storage.saveEvidences(list);
    return item;
  },

  async releaseEvidence(id: string): Promise<Evidence> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (!item) throw new Error('Không tìm thấy minh chứng');
    item.lockedById = undefined;
    item.lockedAt = undefined;
    storage.saveEvidences(list);
    return item;
  },

  async reviewEvidence(evidenceId: string, payload: any): Promise<Evidence> {
    return this.submitReviewDecision(
      evidenceId,
      payload.decision,
      payload.reason,
      payload.finalScore,
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
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === evidenceId);
    if (!item) throw new Error('Không tìm thấy minh chứng');

    if (decision === 'APPROVED') {
      item.status = 'APPROVED';
    } else if (decision === 'REJECTED') {
      item.status = 'REJECTED';
    } else if (decision === 'SCORE_ADJUSTED') {
      item.status = 'APPROVED';
    } else if (decision === 'SUPPLEMENT_REQUESTED') {
      item.status = 'NEEDS_SUPPLEMENT';
    }

    item.lockedById = undefined;
    item.lockedAt = undefined;
    item.updatedAt = new Date().toISOString();
    storage.saveEvidences(list);
    return item;
  },

  // ==========================================
  // APPEALS (APL-01, APL-04)
  // ==========================================
  async getAppeals(): Promise<Appeal[]> {
    return [];
  },

  async createAppeal(data: Partial<Appeal>): Promise<Appeal> {
    const newAppeal: Appeal = {
      id: `apl-${Date.now()}`,
      evidenceId: data.evidenceId || '',
      studentId: data.studentId || '',
      content: data.content || '',
      requestedScore: data.requestedScore,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    return newAppeal;
  },

  // ==========================================
  // NOTIFICATIONS (NOTI-01, NOTI-02)
  // ==========================================
  async getNotifications(): Promise<Notification[]> {
    return storage.getNotifications();
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const notifs = storage.getNotifications();
    const target = notifs.find((n) => n.id === id);
    if (target) {
      target.isRead = true;
      storage.saveNotifications(notifs);
    }
  },

  async markAllNotificationsAsRead(): Promise<void> {
    const notifs = storage.getNotifications();
    notifs.forEach((n) => (n.isRead = true));
    storage.saveNotifications(notifs);
  },
};
