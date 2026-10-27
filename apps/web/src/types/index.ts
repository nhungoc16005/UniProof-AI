// =========================================================================
// EDUPOINT — DATA TYPES (TypeScript)
// Ánh xạ 1-1 với schema.prisma và EduPoint_API_BE.md
// =========================================================================

export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';

export type TermStatus = 'UPCOMING' | 'ACTIVE' | 'REVIEWING' | 'CLOSED';

export type ActivityType = 'INTERNAL' | 'EXTERNAL';

export type EvidenceStatus =
  | 'DRAFT'              // Bản nháp sinh viên chưa bấm nộp
  | 'PROCESSING'         // Đang chạy OCR/AI
  | 'VERIFIED'           // Đã xác minh có căn cứ độc lập
  | 'PLAUSIBLE'          // Khả tín nhưng chưa đủ đối chứng
  | 'NEEDS_SUPPLEMENT'   // Cần bổ sung giấy tờ
  | 'NEEDS_HUMAN_REVIEW' // Chuyển cán bộ xem xét (Certificate-only)
  | 'INVALID'            // Phát hiện mâu thuẫn rõ ràng
  | 'APPROVED'           // Đã được duyệt chính thức
  | 'REJECTED'           // Bị từ chối
  | 'APPEALING'          // Đang trong tiến trình khiếu nại
  | 'WITHDRAWN';         // Sinh viên đã rút hồ sơ

export type VerificationStatus =
  | 'VERIFIED'
  | 'PLAUSIBLE'
  | 'SUSPICIOUS'
  | 'INVALID'
  | 'NEEDS_HUMAN_REVIEW';

export type AnomalyFlagType =
  | 'DUPLICATE'
  | 'INCONSISTENT_INFO'
  | 'IMAGE_WEB_MATCH'
  | 'MISSING_INFO'
  | 'OTHER';

export type ReviewDecision =
  | 'APPROVED'
  | 'REJECTED'
  | 'SCORE_ADJUSTED'
  | 'SUPPLEMENT_REQUESTED';

export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type DocumentStatus = 'ACTIVE' | 'EXPIRED';


// =========================================================================
// INTERFACES CHÍNH
// =========================================================================

export interface Faculty {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
}

export interface Class {
  id: string;
  code: string;
  name: string;
  cohort: string;
  facultyId: string;
  faculty?: Faculty;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  studentCode?: string;
  classId?: string;
  class?: Class;
  facultyId?: string;
  faculty?: Faculty;
  isFirstLogin: boolean;
  isActive: boolean;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Term {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  reviewDeadline: string;
  appealDeadline: string;
  status: TermStatus;
  workflowEnabled?: boolean;
  createdAt?: string;
}

export interface Activity {
  termId?: string;
  facultyId?: string;
  criterionId?: string;
  id: string;
  name: string;
  type: ActivityType;
  organizer: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  createdAt?: string;
  _count?: {
    participants?: number;
    evidences?: number;
  };
}

export interface ActivityParticipant {
  id: string;
  activityId: string;
  activity?: Activity;
  studentId: string;
  student?: User;
  formRole?: string; // BAN_TO_CHUC, THAM_GIA_CHINH, CO_VU
  source?: string;
}

export interface Criterion {
  id: string;
  code: string; // "1", "2", ... "16"
  name: string;
  description: string;
  minScore: number;
  maxScore: number;
  category?: string; // "KHUNG_I", "KHUNG_II", "KHUNG_III", "KHUNG_IV", "KHUNG_V"
  subRules?: string[]; // Các dòng quy định chi tiết/trừ điểm/cộng điểm
  selfScore?: number; // Điểm sinh viên tự đánh giá
  classScore?: number; // Điểm tập thể lớp đánh giá
  notes?: string;
  rolesScore?: Record<string, number>;
  regulationDocumentId?: string;
  createdAt?: string;
  rubricVersionId?: string | null;
  categoryId?: string | null;
  scoringConfig?: Record<string, any> | null;
  assessment?: CriterionAssessment | null;
}

export interface CriterionAssessment {
  id: string;
  studentId: string;
  termId: string;
  criterionId: string;
  selfScore?: number | null;
  selfNote?: string | null;
  classScore?: number | null;
  classNote?: string | null;
  verificationNote?: string | null;
  verifiedData?: Record<string, any> | null;
  suggestedScore?: number | null;
  suggestionReason?: string | null;
  officialScore?: number | null;
  officialReason?: string | null;
  status: 'NEEDS_VERIFICATION' | 'READY_FOR_REVIEW' | 'FINALIZED';
  finalizedAt?: string | null;
  updatedAt?: string;
  evidences?: Array<{
    id: string;
    declaredActivityName?: string | null;
    status: EvidenceStatus;
    aiSuggestions?: AiSuggestion[];
    reviews?: Array<{ finalScore?: number | null; reason?: string }>;
  }>;
}

export interface RubricCategory {
  id?: string;
  key: string;
  name: string;
  maxScore: number;
  position?: number;
  criteria: Criterion[];
}

export interface RubricPayload {
  rubricVersion: { id: string; version: number; status: string; source?: string; publishedAt?: string | null } | null;
  term?: Pick<Term, 'id' | 'name' | 'status' | 'workflowEnabled' | 'appealDeadline'>;
  handoff?: { status: string; returnReason?: string | null; revision: number } | null;
  publication?: { revision: number; publishedAt: string } | null;
  permissions?: { canReview: boolean; canAppeal: boolean };
  submission?: { id: string; status: 'DRAFT' | 'SUBMITTED' | 'RETURNED'; submittedAt?: string | null; returnedAt?: string | null; returnReason?: string | null } | null;
  termId: string;
  categories: RubricCategory[];
  criteria: Criterion[];
}

export interface RubricDefinition {
  categories: Array<{
    code: string;
    name: string;
    maxScore: number;
    position: number;
    criteria: Array<{ code: string; name: string; description: string; maxScore: number; scoringConfig: Record<string, any> }>;
  }>;
}

export interface RubricTemplateVersionSummary {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
  sourceDescription?: string | null;
  changeNote?: string | null;
  createdAt?: string;
}

export interface RubricTemplate {
  id: string;
  code: string;
  name: string;
  versions: RubricTemplateVersionSummary[];
}

export interface EvidenceFile {
  id: string;
  evidenceId: string;
  fileUrl: string;
  fileType: string;
  fileName?: string | null;
  fileSize?: number | null;
  uploadedAt: string;
}

export interface OcrResult {
  id: string;
  evidenceFileId: string;
  evidenceId: string;
  extractedText: string;
  studentNameExtracted?: string;
  studentCodeExtracted?: string;
  activityNameExtracted?: string;
  organizerExtracted?: string;
  dateExtracted?: string;
  locationExtracted?: string;
  certificateCode?: string;
  extractedFieldsJson?: Record<string, any>;
  confidenceScore?: number;
  reviewedByHuman: boolean;
  createdAt?: string;
}

export interface EvidenceGap {
  missingItems: string[];
  suggestions: string[];
}

export interface VerificationResult {
  id: string;
  evidenceId: string;
  verificationLevel: number; // 1 to 5 (L1 - L5)
  status: VerificationStatus;
  activityExistsVerified: boolean; // Câu hỏi 1: Hoạt động có tồn tại?
  studentParticipationVerified: boolean; // Câu hỏi 2: Sinh viên có tham gia?
  sourceDescription: string;
  evidenceGap?: EvidenceGap;
  createdAt?: string;
}

export interface AnomalyFlag {
  id: string;
  evidenceId: string;
  flagType: AnomalyFlagType;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  resolvedByHuman: boolean;
  createdAt?: string;
}

export interface AiSuggestion {
  id: string;
  evidenceId: string;
  criterionId?: string;
  criterion?: Criterion;
  suggestedScore?: number;
  suggestedRole?: string;
  reasoning: string;
  confidenceScore?: number;
  createdAt?: string;
}

export interface Review {
  id: string;
  evidenceId: string;
  reviewerId: string;
  reviewer?: User;
  decision: ReviewDecision;
  criterionId?: string;
  criterion?: Criterion;
  finalScore?: number;
  rejectBasis?: string;
  reason: string;
  createdAt: string;
}

export interface SupplementRequest {
  id: string;
  evidenceId: string;
  reviewId: string;
  review?: Review;
  missingItem: string;
  deadline?: string;
  resolvedAt?: string;
  createdAt?: string;
}

export interface Appeal {
  id: string;
  evidenceId: string;
  studentId: string;
  student?: User;
  content: string;
  requestedScore?: number;
  status: AppealStatus;
  resolverId?: string;
  resolver?: User;
  resolutionNote?: string;
  adjustedScore?: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'EVIDENCE_REVIEWED' | 'SUPPLEMENT_REQUIRED' | 'APPEAL_RESOLVED' | 'SYSTEM' | string;
  isRead: boolean;
  relatedEvidenceId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface RegulationDocument {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  fileUrl: string;
  status: DocumentStatus;
  uploadedById: string;
  createdAt?: string;
}

// Full Evidence object used across FE
export interface Evidence {
  id: string;
  studentId: string;
  student?: User;
  termId: string;
  term?: Term;
  activityId?: string;
  activity?: Activity;
  declaredActivityName?: string;
  description?: string | null;
  declaredRole?: string; // PARTICIPANT, ORGANIZER, CHEERLEADER
  evidenceType: string; // GIAY_KHEN, GIAY_XAC_NHAN, VE_CHECKIN
  status: EvidenceStatus;
  participationDate?: string;
  submittedAt: string;
  updatedAt: string;

  lockedById?: string;
  lockedBy?: User;
  lockedAt?: string;
  version: number;

  criterionId?: string;
  criterion?: Criterion;
  criterionAssessment?: { criterion?: Pick<Criterion, 'id' | 'code' | 'name' | 'maxScore' | 'rubricVersionId'> | null } | null;

  files: EvidenceFile[];
  aiProcessingJobs?: Array<{
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | 'CANCELLED';
    error?: string | null;
    pipelineRuns?: Array<{ id: string; status: string; modelName?: string | null; modelVersion?: string | null; startedAt: string; completedAt?: string | null; steps?: Array<{ id: string; stepKey: string; status: string }> }>;
  }>;
  ocrResults?: OcrResult[];
  verificationResults?: VerificationResult[];
  anomalyFlags?: AnomalyFlag[];
  aiSuggestions?: AiSuggestion[];
  reviews?: Review[];
  supplementRequests?: SupplementRequest[];
  appeals?: Appeal[];
}
