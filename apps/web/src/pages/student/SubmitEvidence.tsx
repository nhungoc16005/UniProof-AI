import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';

export const SubmitEvidence: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activityOrigin, setActivityOrigin] = useState<'INTERNAL' | 'EXTERNAL' | 'UNKNOWN'>('INTERNAL');

  // Criteria list
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');

  useEffect(() => {
    const queryParamId = new URLSearchParams(window.location.search).get('criterionId');
    apiClient.getCriteria().then((list) => {
      setCriteria(list);
      if (queryParamId && list.some((c) => c.id === queryParamId)) {
        setSelectedCriterionId(queryParamId);
      } else if (list.length > 0) {
        setSelectedCriterionId(list[0].id);
      }
    });
  }, []);

  // Form State
  const [activityName, setActivityName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [role, setRole] = useState('PARTICIPANT');
  const [evidenceType, setEvidenceType] = useState('GIAY_CHUNG_NHAN');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [date, setDate] = useState('2026-10-12');
  const [fileUrl, setFileUrl] = useState('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000');
  const [fileName, setFileName] = useState('giay_chung_nhan_hoat_dong.jpg');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDraft, setIsDraft] = useState(false);


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
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setFileUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(f);
    }
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    setIsSubmitting(true);
    try {
      const newEvd = await apiClient.createEvidence({
        declaredActivityName: activityName,
        declaredRole: role,
        evidenceType: evidenceType,
        participationDate: date,
        criterionId: selectedCriterionId || undefined,
        status: asDraft ? 'DRAFT' : 'SUBMITTED',
        fileUrls: [fileUrl],
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

      alert(asDraft ? 'Đã lưu bản nháp thành công!' : 'Đã nộp hồ sơ minh chứng thành công!');
      navigate(`/student/evidence/${newEvd.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Nộp hồ sơ thất bại, vui lòng thử lại';
      alert(`Lỗi: ${Array.isArray(msg) ? msg.join('\n') : msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      
      {/* 1. Clean Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
            Khai báo minh chứng
          </div>
          <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Nộp hồ sơ minh chứng hoạt động</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Áp dụng cho học kỳ: <strong className="text-slate-800">{activeTerm.name}</strong> · Hệ thống tự động trích xuất OCR và đối chiếu
          </p>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[11px] text-slate-400 block font-medium">Dự kiến tích lũy</span>
          <span className="text-sm font-bold text-slate-900">+3.0 ~ 5.0 điểm</span>
        </div>
      </div>

      {/* 2. Stepper Wizard Indicator (Clean Numbers) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Thông tin hoạt động' },
            { num: 2, label: 'Tệp minh chứng' },
            { num: 3, label: 'Xác nhận & gửi' },
          ].map((item, idx) => {
            const isCurrent = step === item.num;
            const isPassed = step > item.num;
            return (
              <React.Fragment key={item.num}>
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {item.num}
                  </div>
                  <span className={`text-xs font-semibold ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>
                    {item.label}
                  </span>
                </div>
                {idx < 2 && <div className="flex-1 h-px bg-slate-200 mx-4" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: KHAI BÁO HOẠT ĐỘNG */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bước 1: Thông tin hoạt động tham gia
            </h2>
            <span className="text-xs text-slate-400">1 / 3</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Hoạt động thuộc đơn vị nào tổ chức?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'INTERNAL' as const, label: 'Trường / Khoa / CLB', desc: 'Có sẵn danh sách điểm danh' },
                { type: 'EXTERNAL' as const, label: 'Đơn vị bên ngoài', desc: 'Kèm link hoặc chứng nhận' },
                { type: 'UNKNOWN' as const, label: 'Chưa chắc chắn', desc: 'Hệ thống tự động phân loại' },
              ].map((opt) => {
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
                    className={`p-3.5 rounded-xl border text-left transition ${
                      activityOrigin === opt.type
                        ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 text-blue-950 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chọn hoạt động nội bộ nếu có */}
          {activityOrigin === 'INTERNAL' && (
            <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-700">
                Chọn hoạt động trong kỳ (Tự động đối chiếu điểm danh):
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
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900"
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
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Chọn Tiêu chí đánh giá trong 16 tiêu chí ĐHBK */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mục tiêu chí xin cộng điểm (trong 16 mục ĐHBK) <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCriterionId}
              onChange={(e) => setSelectedCriterionId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            >
              <option value="">-- Chọn mục tiêu chí để cộng điểm --</option>
              {criteria.map((c) => (
                <option key={c.id} value={c.id}>
                  Mục {c.code}: {c.name} — [Trần tối đa: {c.maxScore}đ]
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Minh chứng được duyệt sẽ cộng điểm trực tiếp vào mục tiêu chí này (không vượt quá trần quy định).
            </span>
          </div>

          {/* Vai trò & Loại minh chứng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò tham gia</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
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
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
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
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Đường dẫn xác minh nếu là ngoài trường */}
          {activityOrigin === 'EXTERNAL' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Đường dẫn tra cứu / Mã xác nhận điện tử (nếu có)
              </label>
              <input
                type="url"
                value={verificationUrl}
                onChange={(e) => setVerificationUrl(e.target.value)}
                placeholder="https://event.danang.gov.vn/verify?code=ABC123XYZ"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <span className="text-[10px] text-slate-500 block">
                Cung cấp liên kết tra cứu giúp tăng mức xác minh và rút ngắn thời gian xét duyệt.
              </span>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
            >
              Tiếp tục: Tải minh chứng
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TẢI MINH CHỨNG */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bước 2: Tải lên tài liệu minh chứng
            </h2>
            <span className="text-xs text-slate-400">2 / 3</span>
          </div>

          {/* Professional Clean Dropzone */}
          <div className="border border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-8 text-center flex flex-col items-center justify-center transition">
            <p className="text-sm font-bold text-slate-900 mb-1">
              Kéo thả file ảnh hoặc PDF minh chứng vào đây
            </p>
            <p className="text-xs text-slate-500 mb-4 max-w-sm">
              Định dạng hỗ trợ: JPG, PNG, PDF (tối đa 10MB). Hãy chụp đủ 4 góc, rõ chữ và thấy con dấu đỏ.
            </p>

            <label className="cursor-pointer px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/20 transition">
              <span>Chọn file từ thiết bị</span>
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* File Preview */}
          {fileUrl && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{fileName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tệp đã sẵn sàng phân tích AI OCR</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                  ✓ Đã tải lên
                </span>
              </div>

              {/* Real Thumbnail Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-56 flex items-center justify-center p-2 shadow-2xs">
                {fileUrl.startsWith('data:image') || fileUrl.includes('unsplash') || fileUrl.endsWith('.jpg') || fileUrl.endsWith('.png') ? (
                  <img
                    src={fileUrl}
                    alt="Xem trước minh chứng"
                    className="max-h-52 object-contain rounded-lg shadow-2xs"
                  />
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">
                    📄 Tài liệu PDF / File đính kèm ({fileName})
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer"
            >
              Xem lại và xác nhận
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: XEM LẠI VÀ GỬI */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bước 3: Xem lại thông tin hồ sơ
            </h2>
            <span className="text-xs text-slate-400">3 / 3</span>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block font-medium">Tên hoạt động</span>
                <span className="text-slate-900 font-bold text-sm">{activityName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Đơn vị tổ chức</span>
                <span className="text-slate-900 font-semibold">{organizer || 'Chưa cung cấp'}</span>
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
                <span className="text-slate-400 block font-medium">Kỳ đánh giá</span>
                <span className="text-slate-900 font-semibold">{activeTerm.name}</span>
              </div>
              <div className="col-span-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
                <span className="text-slate-500 block font-medium text-[11px]">Mục tiêu chí xin cộng điểm:</span>
                <span className="text-[#1d6fc2] font-bold text-xs">
                  {criteria.find((c) => c.id === selectedCriterionId)
                    ? `Mục ${criteria.find((c) => c.id === selectedCriterionId)?.code}: ${criteria.find((c) => c.id === selectedCriterionId)?.name} (Trần tối đa ${criteria.find((c) => c.id === selectedCriterionId)?.maxScore}đ)`
                    : 'Chưa chọn'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-slate-400 block font-medium mb-1">Tệp đính kèm:</span>
              <span className="text-slate-900 font-semibold">{fileName}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            Tôi xin cam đoan minh chứng và thông tin khai báo trên là chính xác. Mọi hành vi làm giả tài liệu sẽ bị xử lý kỷ luật theo quy định của nhà trường.
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Quay lại
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(true)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Lưu bản nháp (DRAFT)
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(false)}
                className="px-7 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Đang gửi hồ sơ...' : 'Xác nhận và Gửi hồ sơ'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
