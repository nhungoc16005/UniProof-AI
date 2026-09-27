import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Stepper } from '../../components/ui/Stepper';
import { ScoreDisplay } from '../../components/ui/ScoreDisplay';
import { TwoQuestionsVerification, EvidenceGapBox, VerificationBadge } from '../../components/ui/VerificationBadge';
import { ConfidenceBar } from '../../components/ui/ConfidenceBar';
import { 
  ArrowLeft, 
  Eye, 
  Edit3, 
  HelpCircle, 
  Scale, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const EvidenceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOcrEditModal, setShowOcrEditModal] = useState(false);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSuccess, setAppealSuccess] = useState(false);

  useEffect(() => {
    if (id) {
      apiClient.getEvidenceById(id).then((data) => {
        setEvidence(data);
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-500">Đang tải chi tiết hồ sơ...</div>;
  }

  if (!evidence) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-xs font-semibold text-slate-700">Không tìm thấy hồ sơ minh chứng</p>
        <Link to="/student/evidence" className="text-xs text-sky-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const ocr = evidence.ocrResults?.[0];
  const verif = evidence.verificationResults?.[0];
  const ai = evidence.aiSuggestions?.[0];
  const review = evidence.reviews?.[0];

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppealSuccess(true);
    setTimeout(() => {
      setShowAppealModal(false);
      setAppealSuccess(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/student/evidence"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{evidence.declaredActivityName}</h1>
              <StatusBadge status={evidence.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Mã hồ sơ: <span className="font-mono text-slate-700">{evidence.id}</span> · Nộp lúc: {new Date(evidence.submittedAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {evidence.status === 'APPROVED' && (
            <button
              onClick={() => setShowAppealModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Khiếu nại điểm</span>
            </button>
          )}

          <Link
            to="/regulations/ask"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-lg transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hỏi quy chế về hồ sơ này</span>
          </Link>
        </div>
      </div>

      {/* 2. Real-time Stepper (7 bước) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          Tiến trình xử lý minh chứng theo thời gian thực
        </div>
        <Stepper currentStatus={evidence.status} />
      </div>

      {/* 3. Main Split View: Left = File Document, Right = Verification & Extraction */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Image / Document Viewer (45%) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Minh chứng gốc tải lên
              </span>
              <span className="text-[11px] text-slate-500 font-medium">1 tệp ảnh</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5 aspect-[4/3] flex items-center justify-center relative group">
              <img
                src={evidence.files[0]?.fileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000'}
                alt="Minh chứng"
                className="w-full h-full object-contain"
              />
              <a
                href={evidence.files[0]?.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 right-3 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow backdrop-blur transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Xem ảnh kích thước thật</span>
              </a>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Định dạng:</span>
              <span className="font-semibold text-slate-800">JPEG (2.4 MB)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mã kiểm tra toàn vẹn:</span>
              <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                sha256:8f2a...c01e
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Extraction & Verification Results (55%) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Block Điểm số (Nguyên tắc 2: Tách biệt điểm đề xuất vs chính thức) */}
          <ScoreDisplay
            score={review?.finalScore}
            maxScore={10}
            isOfficial={evidence.status === 'APPROVED'}
            proposedScore={ai?.suggestedScore}
            approvedBy={review?.reviewer?.fullName || 'ThS. Trần Thị Mai (Cán bộ Khoa)'}
            approvedDate={review ? new Date(review.createdAt).toLocaleDateString('vi-VN') : undefined}
            onExplainClick={() => setShowExplainModal(true)}
          />

          {/* Block Xác minh 2 câu hỏi độc lập (Nguyên tắc 3) */}
          <TwoQuestionsVerification
            activityExists={verif?.activityExistsVerified || false}
            studentParticipation={verif?.studentParticipationVerified || false}
            sourceDesc={verif?.sourceDescription}
          />

          {/* Evidence Gap (Còn thiếu gì?) */}
          {verif?.evidenceGap && (
            <EvidenceGapBox
              gap={verif.evidenceGap}
              onSupplementClick={() => alert('Vui lòng tải thêm file bổ sung ở mục Bổ sung minh chứng.')}
            />
          )}

          {/* Thông tin OCR đọc được từ tài liệu */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Dữ liệu trích xuất tự động (OCR)
                </span>
                <ConfidenceBar score={ocr?.confidenceScore || 0.9} isOfficer={false} />
              </div>
              <button
                onClick={() => setShowOcrEditModal(true)}
                className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Báo sai / Sửa</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Họ tên sinh viên</span>
                <span className="text-slate-900 font-bold">{ocr?.studentNameExtracted || 'Nguyễn Văn An'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
                <span className="text-slate-900 font-semibold">{ocr?.studentCodeExtracted || '102210001'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Hoạt động trích xuất</span>
                <span className="text-slate-900 font-semibold">{ocr?.activityNameExtracted || evidence.declaredActivityName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Đơn vị tổ chức</span>
                <span className="text-slate-900 font-semibold">{ocr?.organizerExtracted || 'Thành đoàn Đà Nẵng'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Ngày ghi trên chứng nhận</span>
                <span className="text-slate-900 font-semibold">{ocr?.dateExtracted || '12/09/2026'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mức xác minh đạt được</span>
                <VerificationBadge level={verif?.verificationLevel || 2} isOfficer={false} />
              </div>
            </div>
          </div>

          {/* Lịch sử xử lý từ Cán bộ */}
          {review && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Nhận xét và quyết định của Cán bộ duyệt</span>
                <span className="text-slate-500 font-normal">
                  {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                "{review.reason}"
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Modal Giải thích AI đề xuất (Nguyên tắc 4: Mọi thứ đều giải thích được) */}
      {showExplainModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2 font-bold text-sky-800">
                <Sparkles className="w-5 h-5 text-sky-600" />
                <span>Giải thích căn cứ đề xuất điểm (AI & Rule Engine)</span>
              </div>
              <button onClick={() => setShowExplainModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
              <p>
                <strong>Lý do AI đề xuất:</strong> {ai?.reasoning || 'Hồ sơ có giấy chứng nhận hợp lệ.'}
              </p>
              <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                <strong className="text-sky-900 block mb-1">Căn cứ Quy chế ĐRL (v2025.1):</strong>
                <span>Điều 5 · Khoản 2 · Trang 4: "Sinh viên đạt giải thưởng các cuộc thi học thuật, sáng tạo khởi nghiệp cấp Thành phố trở lên được cộng từ 3 đến 5 điểm vào Tiêu chí 1.2."</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowExplainModal(false)}
                className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Khiếu nại điểm */}
      {showAppealModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Gửi đơn khiếu nại điểm</h3>
              <button onClick={() => setShowAppealModal(false)}>✕</button>
            </div>

            {appealSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold text-center">
                Đã gửi khiếu nại thành công đến Cán bộ phụ trách!
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lý do khiếu nại / Giải trình</label>
                  <textarea
                    rows={4}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="Giải thích vì sao bạn cho rằng mức điểm hiện tại chưa chính xác..."
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAppealModal(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded"
                  >
                    Gửi khiếu nại
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
