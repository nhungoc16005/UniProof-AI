import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Evidence } from '../../types';
import {
  ArrowLeft,
  UploadCloud,
  Paperclip,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Send,
  HelpCircle,
  FileCheck
} from 'lucide-react';

export const SupplementEvidence: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeIdRef = useRef(id);

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [supplementFile, setSupplementFile] = useState<string | null>(null);
  const [supplementFileName, setSupplementFileName] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [studentExplanation, setStudentExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    activeIdRef.current = id;
    setIsLoading(true);
    setError('');
    setSelectedFile(null);
    setSupplementFile(null);
    setSupplementFileName('');
    setVerificationUrl('');
    setStudentExplanation('');
    setEvidence(null);

    if (id) {
      apiClient.getEvidenceById(id).then((data) => {
        if (activeIdRef.current === id) {
          setEvidence(data);
          setIsLoading(false);
        }
      }).catch((err: any) => {
        if (activeIdRef.current === id) {
          setError(err.response?.data?.message || err.response?.data?.error?.message || 'Không tải được yêu cầu bổ sung từ máy chủ.');
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const activeRequest = useMemo(() => {
    if (!evidence?.supplementRequests?.length) return null;
    return evidence.supplementRequests.find((r) => !r.resolvedAt) || evidence.supplementRequests[0];
  }, [evidence]);

  const { hasOpenRequest, isExpired, deadlineText, deadlineWarning } = useMemo(() => {
    if (!evidence || evidence.status !== 'NEEDS_SUPPLEMENT' || !activeRequest || activeRequest.resolvedAt) {
      return { hasOpenRequest: false, isExpired: false, deadlineText: '', deadlineWarning: '' };
    }
    const deadline = activeRequest.deadline ? new Date(activeRequest.deadline) : (evidence.term?.reviewDeadline ? new Date(evidence.term.reviewDeadline) : null);
    if (!deadline) {
      return { hasOpenRequest: true, isExpired: false, deadlineText: 'Không đặt hạn riêng (áp dụng hạn rà soát của kỳ)', deadlineWarning: '' };
    }
    const now = new Date();
    const isPast = now > deadline;
    const dateFormatted = deadline.toLocaleDateString('vi-VN');
    const timeFormatted = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const fullText = `${timeFormatted} ngày ${dateFormatted}`;
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const warning = isPast ? 'Đã quá hạn nộp bổ sung' : (diffDays <= 3 ? `(Còn ${diffDays} ngày)` : '');
    return {
      hasOpenRequest: true,
      isExpired: isPast,
      deadlineText: activeRequest.deadline ? fullText : `Không đặt hạn riêng (áp dụng hạn rà soát của kỳ: ${fullText})`,
      deadlineWarning: warning,
    };
  }, [evidence, activeRequest]);

  const missingItemContent = useMemo(() => {
    return activeRequest?.missingItem?.trim() || activeRequest?.review?.reason?.trim() || evidence?.reviews?.[0]?.reason?.trim() || 'Cán bộ chưa ghi rõ nội dung cần bổ sung. Vui lòng kiểm tra lại minh chứng đã nộp.';
  }, [activeRequest, evidence]);

  if (isLoading) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Đang tải thông tin yêu cầu bổ sung...</span>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="p-8 text-center space-y-3 bg-white border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-700">Hồ sơ không tồn tại.</p>
        <Link to="/student/evidence" className="text-xs text-sky-600 hover:underline">
          Quay lại danh sách minh chứng
        </Link>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setSupplementFileName(f.name);
      const url = URL.createObjectURL(f);
      setSupplementFile(url);
    }
  };

  const handleSubmitSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplementFile && !verificationUrl.trim() && !studentExplanation.trim()) {
      alert('Vui lòng tải tệp bổ sung, nhập đường dẫn xác minh hoặc điền nội dung giải trình!');
      return;
    }

    setIsSubmitting(true);
    try {
      const fileData = selectedFile ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không đọc được tệp')); reader.readAsDataURL(selectedFile); }) : undefined;
      await apiClient.supplementEvidence(evidence.id, { explanation: studentExplanation || undefined, verificationUrl: verificationUrl || undefined, ...(fileData && selectedFile ? { fileData, fileName: selectedFile.name, fileType: selectedFile.type } : {}) });
      alert('Đã gửi bổ sung minh chứng thành công! Hồ sơ đã được chuyển lại vào hàng đợi thẩm định.');
      navigate(`/student/evidence/${evidence.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không gửi được bổ sung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {/* 1. Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
        <Link
          to={`/student/evidence/${evidence.id}`}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Quay lại chi tiết hồ sơ"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
              BỔ SUNG HỒ SƠ · S06
            </span>
            <h1 className="text-lg font-bold text-slate-900">{evidence.declaredActivityName}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mã hồ sơ: <span className="font-mono text-slate-700">{evidence.id}</span> · Nộp lúc: {new Date(evidence.submittedAt).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>

      {/* 2. Official Officer Request Banner */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Yêu cầu bổ sung từ Cán bộ xét duyệt</span>
          </div>
          {hasOpenRequest && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isExpired ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-200 text-amber-900'
              }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>Hạn nộp: {deadlineText} {deadlineWarning && <span className="font-extrabold">{deadlineWarning}</span>}</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 block font-semibold">Nội dung yêu cầu cụ thể:</span>
          <p className="font-medium text-amber-950 leading-relaxed whitespace-pre-line">
            "{missingItemContent}"
          </p>
        </div>

        {!hasOpenRequest ? (
          <p className="text-xs text-amber-900 font-semibold bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
            Hồ sơ hiện không có yêu cầu bổ sung nào đang mở hoặc đã được giải quyết.
          </p>
        ) : isExpired ? (
          <p className="text-xs text-rose-800 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            Thời hạn nộp bổ sung hồ sơ đã kết thúc. Vui lòng liên hệ cán bộ phụ trách nếu cần hỗ trợ.
          </p>
        ) : (
          <p className="text-[11px] text-amber-800 italic">
            * Sau khi gửi bổ sung, hồ sơ sẽ được chuyển lại vào hàng đợi thẩm định của Cán bộ phụ trách.
          </p>
        )}
      </div>

      {/* 3. Supplement Submission Form */}
      <form onSubmit={handleSubmitSupplement} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-sky-600" />
          <span>Tài liệu & Chứng cứ bổ sung</span>
        </h2>

        {/* Mục 1: Tải tệp bổ sung */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">
            1. Tải lên tệp ảnh hoặc PDF bổ sung (Thẻ đeo / Email / Ảnh dấu mộc rõ hơn)
          </label>

          <div className="border-2 border-dashed border-sky-300 bg-sky-50/40 hover:bg-sky-50/70 rounded-2xl p-6 text-center flex flex-col items-center justify-center transition">
            <UploadCloud className="w-8 h-8 text-sky-600 mb-2" />
            <p className="text-xs font-bold text-slate-800 mb-1">
              Kéo thả file hoặc bấm để chọn tệp bổ sung
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              Hỗ trợ JPG, PNG, WebP, PDF (tối đa 8 MB)
            </p>
            <label className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition ${!hasOpenRequest || isExpired ? 'bg-slate-400 cursor-not-allowed' : 'cursor-pointer bg-sky-600 hover:bg-sky-700'
              }`}>
              <span>Chọn file từ máy</span>
              <input
                type="file"
                disabled={!hasOpenRequest || isExpired}
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {supplementFile && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-900">{supplementFileName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSupplementFile(null); setSelectedFile(null);
                  setSupplementFileName('');
                }}
                className="text-xs text-rose-600 hover:underline"
              >
                Xóa file
              </button>
            </div>
          )}
        </div>

        {/* Mục 2: Đường dẫn xác thực bổ sung */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            2. Đường dẫn tra cứu trực tuyến / Mã số chứng nhận điện tử (nếu có)
          </label>
          <div className="relative">
            <input
              type="url"
              disabled={!hasOpenRequest || isExpired}
              value={verificationUrl}
              onChange={(e) => setVerificationUrl(e.target.value)}
              placeholder="https://event.portal.edu.vn/verify?certId=VNISA-2026-098"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
          <span className="text-[10px] text-slate-400 block">
            Cung cấp link tra cứu công khai từ ban tổ chức để hỗ trợ đối chiếu thông tin.
          </span>
        </div>

        {/* Mục 3: Giải trình của sinh viên */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            3. Ý kiến giải trình bổ sung gửi Cán bộ xét duyệt
          </label>
          <textarea
            rows={3}
            disabled={!hasOpenRequest || isExpired}
            value={studentExplanation}
            onChange={(e) => setStudentExplanation(e.target.value)}
            placeholder="Nêu rõ thông tin cần giải thích thêm (ví dụ: lý do sai lệch thời gian, xác nhận từ bí thư chi đoàn...)"
            className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Link
            to={`/student/evidence/${evidence.id}`}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
          >
            Hủy và quay lại
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !hasOpenRequest || isExpired}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang gửi bổ sung...' : 'Gửi bổ sung minh chứng'}</span>
          </button>
        </div>
      </form>

    </div>
  );
};
