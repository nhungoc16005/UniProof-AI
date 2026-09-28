import React, { useState, useEffect } from 'react';
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

  // Form states
  const [supplementFile, setSupplementFile] = useState<string | null>(null);
  const [supplementFileName, setSupplementFileName] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [studentExplanation, setStudentExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      apiClient.getEvidenceById(id).then((data) => {
        setEvidence(data);
        setIsLoading(false);
      });
    }
  }, [id]);

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
      // Simulate submission of supplement
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Đã gửi bổ sung minh chứng thành công! Hồ sơ đã được chuyển lại vào hàng đợi thẩm định.');
      navigate(`/student/evidence/${evidence.id}`);
    } catch (err) {
      alert('Có lỗi xảy ra khi nộp bổ sung!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      
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
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Hạn nộp: 25/10/2026 (Còn 3 ngày)</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 block font-semibold">Nội dung yêu cầu cụ thể:</span>
          <p className="font-medium text-amber-950 leading-relaxed">
            "{evidence.reviews?.[0]?.reason || 'Ảnh giấy chứng nhận hiện tại bị mờ con dấu đỏ giáp lai và thiếu mã xác nhận của BTC. Vui lòng bổ sung ảnh chụp rõ nét hơn hoặc chụp thẻ đeo đại biểu / email xác nhận tham gia chính thức từ ban tổ chức.'}"
          </p>
        </div>

        <p className="text-[11px] text-amber-800 italic">
          * Sau khi bạn gửi bổ sung, AI sẽ kích hoạt quét lại OCR và đưa hồ sơ trở lại hàng đợi ưu tiên của Cán bộ phụ trách.
        </p>
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
              Hỗ trợ JPG, PNG, PDF (tối đa 10MB)
            </p>
            <label className="cursor-pointer px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition">
              <span>Chọn file từ máy</span>
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
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
                  setSupplementFile(null);
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
              value={verificationUrl}
              onChange={(e) => setVerificationUrl(e.target.value)}
              placeholder="https://event.portal.edu.vn/verify?certId=VNISA-2026-098"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>
          <span className="text-[10px] text-slate-400 block">
            Cung cấp link tra cứu công khai giúp hồ sơ được nâng cấp xác thực L1/L2 và duyệt tự động.
          </span>
        </div>

        {/* Mục 3: Giải trình của sinh viên */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            3. Ý kiến giải trình bổ sung gửi Cán bộ xét duyệt
          </label>
          <textarea
            rows={3}
            value={studentExplanation}
            onChange={(e) => setStudentExplanation(e.target.value)}
            placeholder="Nêu rõ thông tin cần giải thích thêm (ví dụ: lý do sai lệch thời gian, xác nhận từ bí thư chi đoàn...)"
            className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
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
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang gửi bổ sung...' : 'Gửi bổ sung minh chứng'}</span>
          </button>
        </div>
      </form>

    </div>
  );
};
