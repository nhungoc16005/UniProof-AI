import { 
  Evidence, 
  User, 
  Term, 
  Criterion, 
  Notification, 
  ReviewDecision, 
  Appeal,
  EvidenceStatus 
} from '../types';
import { 
  mockUsers, 
  mockTerms, 
  mockCriteria, 
  mockEvidences, 
  mockNotifications,
  mockActivities 
} from './mockData';

// Lưu trữ trạng thái trong LocalStorage để có thể thử nghiệm tương tác thật trên UI
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
    if (!localStorage.getItem(this.currentUserKey)) {
      localStorage.setItem(this.currentUserKey, JSON.stringify(mockUsers.student));
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

// API Client Wrapper tuân thủ contract EduPoint_API_BE.md
export const apiClient = {
  // Auth endpoints
  async getCurrentUser(): Promise<User> {
    return storage.getCurrentUser();
  },

  async switchUserRole(role: 'STUDENT' | 'STAFF' | 'ADMIN'): Promise<User> {
    let target = mockUsers.student;
    if (role === 'STAFF') target = mockUsers.officer;
    if (role === 'ADMIN') target = mockUsers.admin;
    storage.setCurrentUser(target);
    return target;
  },

  // Term endpoints
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

  // Criteria endpoints (CRI-01)
  async getCriteria(): Promise<Criterion[]> {
    return mockCriteria;
  },

  // Activities
  async getActivities() {
    return mockActivities;
  },

  // Evidences (EVD-05, EVD-06, EVD-01, EVD-09)
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
      status: 'PROCESSING', // Bắt đầu ở trạng thái chạy OCR/AI
      participationDate: data.participationDate || new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      files: data.files || [
        {
          id: `file-${Date.now()}`,
          evidenceId: `evd-${Date.now()}`,
          fileUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000',
          fileType: 'image/jpeg',
          uploadedAt: new Date().toISOString(),
        },
      ],
      ocrResults: [
        {
          id: `ocr-${Date.now()}`,
          evidenceFileId: `file-${Date.now()}`,
          evidenceId: `evd-${Date.now()}`,
          extractedText: `TRÍCH XUẤT MINH CHỨNG: ${data.declaredActivityName} - MSSV: ${currentUser.studentCode}`,
          studentNameExtracted: currentUser.fullName,
          studentCodeExtracted: currentUser.studentCode,
          activityNameExtracted: data.declaredActivityName,
          confidenceScore: 0.88,
          reviewedByHuman: false,
        },
      ],
      verificationResults: [
        {
          id: `vr-${Date.now()}`,
          evidenceId: `evd-${Date.now()}`,
          verificationLevel: 3,
          status: 'PLAUSIBLE',
          activityExistsVerified: true,
          studentParticipationVerified: true,
          sourceDescription: 'Đối chiếu ban đầu theo ảnh minh chứng tải lên',
        },
      ],
      aiSuggestions: [
        {
          id: `ai-${Date.now()}`,
          evidenceId: `evd-${Date.now()}`,
          criterionId: 'crit-3.2',
          suggestedScore: 3.0,
          reasoning: 'AI tự động trích xuất thông tin khớp tiêu chí hoạt động ngoại khóa.',
          confidenceScore: 0.85,
        },
      ],
    };

    list.unshift(newEvidence);
    storage.saveEvidences(list);

    // Giả lập sau 2 giây chuyển từ PROCESSING -> NEEDS_HUMAN_REVIEW / VERIFIED
    setTimeout(() => {
      const currentList = storage.getEvidences();
      const idx = currentList.findIndex((e) => e.id === newEvidence.id);
      if (idx !== -1) {
        currentList[idx].status = 'NEEDS_HUMAN_REVIEW';
        storage.saveEvidences(currentList);
      }
    }, 2500);

    return newEvidence;
  },

  async withdrawEvidence(id: string): Promise<boolean> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (item && item.status !== 'APPROVED') {
      item.status = 'WITHDRAWN';
      item.updatedAt = new Date().toISOString();
      storage.saveEvidences(list);
      return true;
    }
    return false;
  },

  // Officer Review Actions (REV-02)
  async reviewEvidence(
    id: string,
    payload: {
      decision: ReviewDecision;
      finalScore?: number;
      criterionId?: string;
      reason: string;
      rejectBasis?: string;
      supplementDeadline?: string;
      missingItem?: string;
    }
  ): Promise<Evidence> {
    const list = storage.getEvidences();
    const item = list.find((e) => e.id === id);
    if (!item) throw new Error('Hồ sơ không tồn tại');

    const currentUser = storage.getCurrentUser();
    let newStatus: EvidenceStatus = 'APPROVED';

    if (payload.decision === 'REJECTED') {
      newStatus = 'REJECTED';
    } else if (payload.decision === 'SUPPLEMENT_REQUESTED') {
      newStatus = 'NEEDS_SUPPLEMENT';
      item.supplementRequests = item.supplementRequests || [];
      item.supplementRequests.push({
        id: `sup-${Date.now()}`,
        evidenceId: item.id,
        reviewId: `rev-${Date.now()}`,
        missingItem: payload.missingItem || 'Cần bổ sung giấy tờ xác minh theo yêu cầu cán bộ',
        deadline: payload.supplementDeadline,
      });
    } else {
      newStatus = 'APPROVED';
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    item.version += 1;

    item.reviews = item.reviews || [];
    item.reviews.unshift({
      id: `rev-${Date.now()}`,
      evidenceId: item.id,
      reviewerId: currentUser.id,
      reviewer: currentUser,
      decision: payload.decision,
      criterionId: payload.criterionId,
      finalScore: payload.finalScore,
      rejectBasis: payload.rejectBasis,
      reason: payload.reason,
      createdAt: new Date().toISOString(),
    });

    storage.saveEvidences(list);
    return item;
  },

  // Notifications
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
    const notifs = storage.getNotifications().map((n) => ({ ...n, isRead: true }));
    storage.saveNotifications(notifs);
  },
};
