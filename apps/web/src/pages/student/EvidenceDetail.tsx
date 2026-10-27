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
  ExternalLink,
  UploadCloud,
  Paperclip
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

  // Supplement Modal states
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [supplementFileName, setSupplementFileName] = useState('');
  const [supplementFileUrl, setSupplementFileUrl] = useState('');
  const [supplementNote, setSupplementNote] = useState('');
  const [isSubmittingSupplement, setIsSubmittingSupplement] = useState(false);

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
  const aiJob = evidence.aiProcessingJobs?.[0];
  const aiStatus = aiJob?.status === 'QUEUED' || aiJob?.status === 'PROCESSING'
    ? 'Đang xử lý'
    : aiJob?.status === 'COMPLETED' && ai
      ? 'Đã có phân tích tham khảo'
      : aiJob?.status === 'UNAVAILABLE' || aiJob?.status === 'FAILED' || aiJob?.status === 'CANCELLED'
        ? 'AI không khả dụng · hồ sơ chờ cán bộ xử lý'
        : 'Chưa chạy phân tích AI';
  const review = evidence.reviews?.[0];

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) return;
    try {
      await apiClient.createAppeal({
        evidenceId: evidence.id,
        reason: appealReason.trim(),
        desiredScore: evidence.aiSuggestions?.[0]?.suggestedScore,
      });
      setAppealSuccess(true);
      setTimeout(() => {
        setShowAppealModal(false);
        setAppealSuccess(false);
      }, 1500);
      const updated = await apiClient.getEvidenceById(evidence.id);
      if (updated) setEvidence(updated);
    } catch (err: any) {
      alert('Không thể gửi khiếu nại: ' + (err.response?.data?.message || err.message || 'Lỗi hệ thống'));
    }
  };

  const handleSupplementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence) return;
    if (!supplementFileUrl) {
      alert('Vui lòng chọn tệp tài liệu bổ sung từ thiết bị');
      return;
    }
    setIsSubmittingSupplement(true);
    try {
      const updated = await apiClient.supplementEvidence(evidence.id, [
        { fileUrl: supplementFileUrl, fileType: 'image/jpeg' },
      ]);
      setEvidence(updated);
      setShowSupplementModal(false);
      setSupplementFileName('');
      setSupplementFileUrl('');
      setSupplementNote('');
      alert('Đã gửi bổ sung minh chứng thành công! Hồ sơ đã được cập nhật.');
    } catch (err: any) {
      alert('Có lỗi xảy ra khi nộp bổ sung: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingSupplement(false);
    }
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
          {evidence.status === 'NEEDS_SUPPLEMENT' && (
            <button
              onClick={() => setShowSupplementModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Bổ sung minh chứng</span>
            </button>
          )}

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

      {/* Banner cảnh báo nếu cần bổ sung hồ sơ */}
      {evidence.status === 'NEEDS_SUPPLEMENT' && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-sm">Hồ sơ cần bổ sung minh chứng theo yêu cầu của Cán bộ:</strong>
              <p className="mt-0.5 text-amber-800">
                {review?.reason || 'Vui lòng bổ sung bản chụp/scan rõ nét có dấu mộc đỏ hoặc giấy xác nhận hợp lệ.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSupplementModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm text-xs shrink-0 transition"
          >
            Bổ sung ngay
          </button>
        </div>
      )}

      {/* 2. Real-time Stepper (7 bước) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          Tiến trình xử lý minh chứng theo thời gian thực
        </div>
        <Stepper currentStatus={evidence.status} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
        <strong>Phân tích AI:</strong> {aiStatus}. Kết quả AI chỉ tham khảo; cán bộ xác minh và quyết định điểm chính thức.
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
              <span className="text-[11px] text-slate-500 font-medium">{evidence.files.length} tệp</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5 aspect-[4/3] flex items-center justify-center relative group">
              {evidence.files[0]?.fileUrl ? (
                <>
                  <img
                    src={evidence.files[0].fileUrl}
                    alt="Minh chứng"
                    className="w-full h-full object-contain"
                  />
                  <a
                    href={evidence.files[0].fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-3 right-3 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow backdrop-blur transition flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem ảnh kích thước thật</span>
                  </a>
                </>
              ) : (
                <div className="text-center p-6 text-slate-400 text-xs">
                  Không tìm thấy tệp minh chứng hoặc hồ sơ chưa đính kèm ảnh
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Định dạng:</span>
              <span className="font-semibold text-slate-800">{evidence.files[0]?.fileType || 'Chưa có tệp'}{evidence.files[0]?.fileSize ? ` · ${(evidence.files[0].fileSize / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mã kiểm tra toàn vẹn:</span>
              <span className="font-mono text-[11px] text-slate-500">Chưa có mã băm tệp trong hệ thống</span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Extraction & Verification Results (55%) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Block Điểm số (Nguyên tắc 2: Tách biệt điểm đề xuất vs chính thức) */}
          <ScoreDisplay
            score={review?.finalScore}
            maxScore={evidence.criterion?.maxScore || evidence.criterionAssessment?.criterion?.maxScore || 0}
            isOfficial={evidence.status === 'APPROVED' && review?.finalScore != null}
            proposedScore={ai?.suggestedScore}
            approvedBy={review?.reviewer?.fullName}
            approvedDate={review ? new Date(review.createdAt).toLocaleDateString('vi-VN') : undefined}
            onExplainClick={() => setShowExplainModal(true)}
          />

          {/* Block Xác minh 2 câu hỏi độc lập (Nguyên tắc 3) */}
          <TwoQuestionsVerification
            activityExists={verif ? verif.activityExistsVerified : null}
            studentParticipation={verif ? verif.studentParticipationVerified : null}
            sourceDesc={verif?.sourceDescription}
          />

          {/* Evidence Gap (Còn thiếu gì?) */}
          {verif?.evidenceGap && (
            <EvidenceGapBox
              gap={verif.evidenceGap}
              onSupplementClick={() => navigate(`/student/evidence/${evidence.id}/supplement`)}
            />
          )}

          {/* Thông tin OCR đọc được từ tài liệu */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Dữ liệu trích xuất tự động (OCR)
                </span>
                {ocr ? <ConfidenceBar score={ocr.confidenceScore ?? 0} isOfficer={false} /> : <span className="text-[11px] text-slate-500">Chưa có kết quả OCR</span>}
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
                <span className="text-slate-900 font-bold">{ocr?.studentNameExtracted || 'Chưa có dữ liệu trích xuất'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
                <span className="text-slate-900 font-semibold">{ocr?.studentCodeExtracted || 'Chưa có dữ liệu trích xuất'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Hoạt động trích xuất</span>
                <span className="text-slate-900 font-semibold">{ocr?.activityNameExtracted || evidence.declaredActivityName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Đơn vị tổ chức</span>
                <span className="text-slate-900 font-semibold">{ocr?.organizerExtracted || 'Chưa có dữ liệu trích xuất'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Ngày ghi trên chứng nhận</span>
                <span className="text-slate-900 font-semibold">{ocr?.dateExtracted || 'Chưa có dữ liệu trích xuất'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mức xác minh đạt được</span>
                {verif ? <VerificationBadge level={verif.verificationLevel} isOfficer={false} /> : <span className="text-slate-500">Chưa có kết quả xác minh</span>}
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
                <strong>Lý do AI đề xuất:</strong> {ai?.reasoning || 'Chưa có phân tích AI cho hồ sơ này.'}
              </p>
              <p className="text-slate-500">Điểm AI (nếu có) chỉ để tham khảo. Cán bộ xác minh hồ sơ và chốt điểm tại tiêu chí trong phiếu đánh giá.</p>
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

      {/* Modal Bổ sung minh chứng trực tiếp */}
      {showSupplementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Bổ sung hồ sơ minh chứng</h3>
                  <p className="text-[11px] text-slate-500">Tải tài liệu theo yêu cầu thẩm định của Cán bộ</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSupplementModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSupplementSubmit} className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:bg-slate-50 transition cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSupplementFileName(f.name);
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        if (evt.target?.result) setSupplementFileUrl(evt.target.result as string);
                      };
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-amber-500 mx-auto mb-1.5" />
                <span className="font-semibold text-slate-800 block">
                  {supplementFileName || 'Kéo thả hoặc nhấp để chọn tệp tài liệu bổ sung'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Hỗ trợ PNG, JPG, PDF (Dung lượng tối đa 15MB)
                </span>
              </div>

              {/* Note / Explanation */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nội dung giải trình / Ghi chú cho Cán bộ (Tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={supplementNote}
                  onChange={(e) => setSupplementNote(e.target.value)}
                  placeholder="VD: Em đã xin lại giấy xác nhận có dấu mộc đỏ của Đoàn trường..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplementModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl text-xs transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplement}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition"
                >
                  {isSubmittingSupplement ? 'Đang gửi bổ sung...' : 'Nộp bổ sung ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
