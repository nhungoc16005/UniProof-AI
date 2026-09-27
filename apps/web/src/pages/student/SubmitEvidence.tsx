import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { ActivityType } from '../../types';
import { 
  UploadCloud, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  HelpCircle, 
  Building2, 
  School, 
  FileCheck,
  FileImage,
  AlertCircle,
  Sparkles,
  Zap,
  Award,
  ScanLine,
  CheckCircle2
} from 'lucide-react';

export const SubmitEvidence: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activityOrigin, setActivityOrigin] = useState<'INTERNAL' | 'EXTERNAL' | 'UNKNOWN'>('INTERNAL');

  // Form State
  const [activityName, setActivityName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [role, setRole] = useState('PARTICIPANT');
  const [evidenceType, setEvidenceType] = useState('GIAY_CHUNG_NHAN');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [date, setDate] = useState('2026-10-12');
  const [fileUrl, setFileUrl] = useState('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000');
  const [fileName, setFileName] = useState('giay_chung_nhan_hoat_dong.jpg');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mẫu các hoạt động nội bộ có sẵn
  const internalActivities = [
    { name: 'Ngày hội Hiến máu Nhân đạo Giọt hồng Bách Khoa 2026', org: 'Đoàn Thanh niên Trường ĐH Bách Khoa', score: 5.0, criteria: 'Tiêu chí 3' },
    { name: 'Workshop Ứng dụng GenAI và LLM trong Doanh nghiệp', org: 'Khoa Công nghệ Thông tin', score: 3.0, criteria: 'Tiêu chí 1.2' },
    { name: 'Hội thao Sinh viên Bách Khoa DUT Games 2026', org: 'Hội Sinh viên Trường', score: 4.0, criteria: 'Tiêu chí 4' },
  ];

  const handleNext = () => {
    if (step === 1 && !activityName) {
      alert('Vui lòng chọn hoặc nhập tên hoạt động');
      return;
    }
    setStep((prev) => (prev + 1) as any);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileName(f.name);
      const url = URL.createObjectURL(f);
      setFileUrl(url);

      // Trigger simulated instant OCR scanning
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
      }, 1200);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const newEvd = await apiClient.createEvidence({
        declaredActivityName: activityName,
        declaredRole: role,
        evidenceType: evidenceType,
        participationDate: date,
        files: [
          {
            id: `f-${Date.now()}`,
            evidenceId: '',
            fileUrl: fileUrl,
            fileType: 'image/jpeg',
            uploadedAt: new Date().toISOString(),
          },
        ],
      });

      // Chuyển ngay đến màn hình Chi tiết minh chứng (S05) để xem tiến trình 7 bước
      navigate(`/student/evidence/${newEvd.id}`);
    } catch (err) {
      alert('Nộp hồ sơ thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nộp minh chứng thông minh · S03</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Khai báo & Quét OCR Minh chứng</h1>
          <p className="text-xs text-sky-100 mt-1">
            Kỳ đánh giá: <strong>{activeTerm.name}</strong> · AI sẽ tự động đọc con dấu và trích xuất điểm rèn luyện.
          </p>
        </div>

        {/* Gamified Reward Teaser */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-xl text-center shrink-0">
          <span className="text-[10px] text-sky-200 block uppercase font-bold">Điểm dự kiến</span>
          <span className="text-lg font-black text-amber-300 flex items-center justify-center gap-1">
            <Award className="w-4 h-4 text-amber-300" />
            <span>+3.0 ~ 5.0 đ</span>
          </span>
        </div>
      </div>

      {/* 2. Stepper Wizard Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Khai báo hoạt động' },
            { num: 2, label: 'Tải minh chứng' },
            { num: 3, label: 'Xem lại và gửi' },
          ].map((item, idx) => {
            const isCurrent = step === item.num;
            const isPassed = step > item.num;
            return (
              <React.Fragment key={item.num}>
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                      isPassed
                        ? 'bg-emerald-600 text-white shadow'
                        : isCurrent
                        ? 'bg-sky-600 text-white ring-4 ring-sky-100 shadow-md'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4" /> : item.num}
                  </div>
                  <span className={`text-xs font-bold ${isCurrent ? 'text-sky-700' : 'text-slate-600'}`}>
                    {item.label}
                  </span>
                </div>
                {idx < 2 && <div className="flex-1 h-0.5 bg-slate-200 mx-4" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: KHAI BÁO HOẠT ĐỘNG */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Bước 1: Thông tin hoạt động tham gia
            </h2>
            <span className="text-xs text-slate-400">Bước 1 trên 3</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Bạn tham gia hoạt động của đơn vị nào?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'INTERNAL' as const, label: 'Trường / Khoa / CLB', icon: School, desc: 'Tự động tra cứu điểm danh' },
                { type: 'EXTERNAL' as const, label: 'Đơn vị bên ngoài', icon: Building2, desc: 'Có thể kèm link đối chiếu' },
                { type: 'UNKNOWN' as const, label: 'Tôi không chắc chắn', icon: HelpCircle, desc: 'AI sẽ phân tích tự động' },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setActivityOrigin(opt.type);
                      if (opt.type === 'INTERNAL') {
                        setActivityName(internalActivities[0].name);
                        setOrganizer(internalActivities[0].org);
                      } else {
                        setActivityName('');
                        setOrganizer('');
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                      activityOrigin === opt.type
                        ? 'bg-sky-50 border-sky-600 text-sky-900 ring-2 ring-sky-200 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nếu chọn nội bộ: Chọn nhanh */}
          {activityOrigin === 'INTERNAL' && (
            <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-700">
                Chọn hoạt động nội bộ có sẵn trong kỳ (Fast-Track tự động):
              </label>
              <select
                value={activityName}
                onChange={(e) => {
                  setActivityName(e.target.value);
                  const found = internalActivities.find((a) => a.name === e.target.value);
                  if (found) setOrganizer(found.org);
                }}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
              >
                {internalActivities.map((act, i) => (
                  <option key={i} value={act.name}>
                    {act.name} — [{act.criteria}] (+{act.score}đ)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tên hoạt động & Đơn vị */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên hoạt động <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="VD: Hội thảo Công nghệ Sinh viên Danang 2026"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Đơn vị tổ chức
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="VD: Thành đoàn Đà Nẵng / Hội SV"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Vai trò & Loại minh chứng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò tham gia</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="PARTICIPANT">Thí sinh / Người tham gia</option>
                <option value="ORGANIZER">Ban tổ chức / Tình nguyện viên</option>
                <option value="CHEERLEADER">Cổ vũ / Khán giả</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loại minh chứng</label>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="GIAY_CHUNG_NHAN">Giấy chứng nhận / Bằng khen</option>
                <option value="GIAY_XAC_NHAN">Giấy xác nhận có đóng dấu</option>
                <option value="VE_CHECKIN">Vé điện tử / Check-in QR</option>
                <option value="DANH_SACH">Danh sách kết quả khen thưởng</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày diễn ra</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Đường dẫn xác minh bổ trợ nếu là hoạt động ngoài trường */}
          {activityOrigin === 'EXTERNAL' && (
            <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-sky-900">
                Đường dẫn tra cứu / Mã xác nhận (nếu có)
              </label>
              <input
                type="url"
                value={verificationUrl}
                onChange={(e) => setVerificationUrl(e.target.value)}
                placeholder="https://event.danang.gov.vn/verify?code=ABC123XYZ"
                className="w-full px-3 py-2 text-xs border border-sky-300 rounded-lg bg-white"
              />
              <span className="text-[10px] text-sky-700 block">
                * Cung cấp link hoặc QR giúp hồ sơ đạt cấp xác minh cao hơn (L1/L2), rút ngắn thời gian xét duyệt.
              </span>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <span>Tiếp tục: Tải minh chứng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TẢI MINH CHỨNG & AI OCR SCANNER */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Bước 2: Tải lên tài liệu minh chứng
            </h2>
            <span className="text-xs text-slate-400">Bước 2 trên 3</span>
          </div>

          {/* Interactive Modern Dropzone */}
          <div className="border-2 border-dashed border-sky-300 bg-sky-50/40 hover:bg-sky-50/70 rounded-2xl p-8 text-center flex flex-col items-center justify-center transition">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3 shadow-sm">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800 mb-1">
              Kéo thả file ảnh hoặc PDF minh chứng vào đây
            </p>
            <p className="text-xs text-slate-500 mb-4 max-w-sm">
              Hỗ trợ JPG, PNG, PDF (tối đa 10MB). Ảnh chụp rõ nét, thấy rõ họ tên, ngày tháng và con dấu đỏ sẽ được duyệt nhanh nhất.
            </p>

            <label className="cursor-pointer px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md transition">
              <span>Chọn file từ thiết bị</span>
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* File Preview with OCR Scan Simulation */}
          {fileUrl && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center relative">
                    <img src={fileUrl} alt="Minh chứng" className="w-full h-full object-cover" />
                    {isScanning && (
                      <div className="absolute inset-0 bg-sky-500/30 flex items-center justify-center">
                        <ScanLine className="w-6 h-6 text-white animate-bounce" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{fileName}</div>
                    <div className="text-[11px] text-slate-500">1.2 MB · Sẵn sàng đối chiếu</div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>OCR Đã sẵn sàng</span>
                </span>
              </div>

              {/* Instant OCR Pre-Check Checklist */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Kiểm tra sơ bộ tự động bởi AI:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>Họ tên trên ảnh: <strong>Khớp tài khoản ({user.fullName})</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>Con dấu tròn pháp lý: <strong>Phát hiện rõ nét (98%)</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>Thời gian diễn ra: <strong>Nằm trong học kỳ hiện tại</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sky-700">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Cấp độ dự kiến: <strong>L2 Fast-track (Duyệt nhanh)</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <span>Xem lại và xác nhận</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: XEM LẠI VÀ GỬI */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Bước 3: Xem lại thông tin hồ sơ
            </h2>
            <span className="text-xs text-slate-400">Bước 3 trên 3</span>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block font-medium">Tên hoạt động</span>
                <span className="text-slate-900 font-bold text-sm">{activityName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Đơn vị tổ chức</span>
                <span className="text-slate-900 font-semibold">{organizer || 'Không có'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Vai trò khai báo</span>
                <span className="text-slate-900 font-semibold">{role}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Loại minh chứng</span>
                <span className="text-slate-900 font-semibold">{evidenceType}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Ngày diễn ra</span>
                <span className="text-slate-900 font-semibold">{date}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Kỳ áp dụng</span>
                <span className="text-slate-900 font-semibold">{activeTerm.name}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-slate-400 block font-medium mb-1.5">Tệp đính kèm</span>
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 max-w-sm">
                <FileImage className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="text-slate-800 font-semibold truncate">{fileName}</span>
              </div>
            </div>
          </div>

          {/* Gamified Motivation Card */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950">Mục tiêu rèn luyện kỳ này</h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Sau khi hồ sơ này được duyệt, bạn sẽ được cộng thêm khoảng <strong>+5.0 điểm</strong>, tiến gần hơn đến danh hiệu Sinh viên Xuất sắc!
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              Tôi xin cam đoan minh chứng và thông tin khai báo trên là hoàn toàn chính xác. Mọi hành vi gian lận điểm rèn luyện sẽ bị xử lý kỷ luật theo quy định của nhà trường.
            </span>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang phân tích & Gửi...' : 'Xác nhận và Gửi minh chứng'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
