import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Columns2, FlaskConical, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { EvidenceInspectionResult, RubricPayload } from '../../types';
import { AiResultPanel } from '../../components/AiResultPanel';

const EVIDENCE_TYPES = [
  { value: 'GIAY_KHEN', label: 'Giấy khen / bằng khen' },
  { value: 'GIAY_XAC_NHAN', label: 'Giấy xác nhận có đóng dấu' },
  { value: 'GIAY_HIEN_MAU', label: 'Giấy hiến máu' },
  { value: 'VE_CHECKIN', label: 'Vé điện tử / check-in' },
  { value: 'ANH_SU_KIEN', label: 'Ảnh chụp sự kiện' },
  { value: 'OTHER', label: 'Khác' },
];

const OCR_ENGINES = [
  { value: 'auto', label: 'Tự động (Ưu tiên RapidOCR + VietOCR)' },
  { value: 'rapidocr_vietocr', label: 'RapidOCR (PP-OCRv4) + VietOCR (Mới)' },
  { value: 'rapidocr', label: 'RapidOCR ONNX thuần (Nhẹ)' },
  { value: 'tesseract', label: 'Tesseract 5 (Baseline cũ)' },
] as const;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.readAsDataURL(file);
  });

const toIsoOrNull = (value?: string) => (value ? new Date(value).toISOString() : null);

export const AiTestConsole: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [activityName, setActivityName] = useState('');
  const [evidenceType, setEvidenceType] = useState('GIAY_KHEN');
  const [ocrEngine, setOcrEngine] = useState<'auto' | 'rapidocr_vietocr' | 'rapidocr' | 'tesseract'>('auto');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [studentCode, setStudentCode] = useState(user?.studentCode || '');
  const [citizenId, setCitizenId] = useState('');
  const [criterionId, setCriterionId] = useState('');
  const [rubric, setRubric] = useState<RubricPayload | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EvidenceInspectionResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (activeTerm?.id) {
      apiClient.getRubric(activeTerm.id).then(setRubric).catch(() => setRubric(null));
    }
  }, [activeTerm?.id]);

  const criteriaOptions = (rubric?.categories || []).flatMap((cat) =>
    (cat.criteria || []).map((c) => ({
      id: c.id,
      label: `Mục ${c.code} (tối đa ${c.maxScore}đ) — ${c.name}`,
    })),
  );

  const runInspection = async () => {
    setError('');
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên sinh viên khai báo.');
      return;
    }
    if (!file) {
      setError('Vui lòng chọn một tệp minh chứng (ảnh hoặc PDF).');
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const fileData = await readFileAsDataUrl(file);
      const response = await apiClient.inspectEvidenceAi({
        activityName: activityName.trim(),
        evidenceType,
        ocrEngine,
        criterionId: criterionId || undefined,
        declaredStudent: {
          fullName: fullName.trim(),
          ...(studentCode.trim() ? { studentCode: studentCode.trim() } : {}),
          ...(citizenId.trim() ? { citizenId: citizenId.trim() } : {}),
        },
        participationDate: null,
        termStartDate: toIsoOrNull(activeTerm?.startDate),
        termEndDate: toIsoOrNull(activeTerm?.endDate),
        enableWebSearch,
        fileData,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
      });
      setResult(response);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Không chạy được AI. Vui lòng thử lại.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Chạy thử luồng AI minh chứng (Theo hồ sơ & kỳ xét duyệt)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sử dụng thông tin sinh viên đăng nhập, kỳ học đang mở ({activeTerm?.name || 'chưa chọn kỳ'}) và bộ tiêu chí Rubric DUT để kiểm tra đối chiếu 3 chiều + gợi ý điểm tiêu chí.
            Kết quả chỉ để tham khảo, không lưu vào hồ sơ và không thay đổi điểm chính thức.
          </p>
        </div>
        <Link
          to="/ai-lab"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          <Columns2 className="h-4 w-4" />
          Mở AI OCR Lab (So sánh A/B)
        </Link>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          Tên hoạt động / thành tích (không bắt buộc)
          <input
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            placeholder="Ví dụ: Ngày hội tình nguyện DUT 2026"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Loại minh chứng
          <select
            value={evidenceType}
            onChange={(event) => setEvidenceType(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {EVIDENCE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Họ tên sinh viên (mặc định từ tài khoản đăng nhập)
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          MSSV (mặc định từ tài khoản đăng nhập)
          <input
            value={studentCode}
            onChange={(event) => setStudentCode(event.target.value)}
            placeholder="102210001"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Tiêu chí Rubric muốn thử gợi ý điểm (tùy chọn)
          <select
            value={criterionId}
            onChange={(event) => setCriterionId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">-- Không chấm tiêu chí (chỉ kiểm tra minh chứng) --</option>
            {criteriaOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Engine OCR
          <select
            value={ocrEngine}
            onChange={(event) => setOcrEngine(event.target.value as any)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {OCR_ENGINES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {evidenceType === 'GIAY_HIEN_MAU' && (
          <label className="block text-xs font-semibold text-slate-700 lg:col-span-2">
            Số CCCD khai báo (dùng đối chiếu giấy hiến máu)
            <input
              value={citizenId}
              onChange={(event) => setCitizenId(event.target.value)}
              placeholder="12 số CCCD"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        )}

        <label className="block text-xs font-semibold text-slate-700 lg:col-span-2">
          Tệp minh chứng (ảnh hoặc PDF, tối đa 8 MB)
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 lg:col-span-2">
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(event) => setEnableWebSearch(event.target.checked)}
            className="h-4 w-4"
          />
          Bật tra cứu nguồn chính thống Allow-list (Luồng 2 — D1)
        </label>

        <div className="lg:col-span-2">
          <button
            type="button"
            onClick={() => void runInspection()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {running ? 'Đang phân tích…' : 'Chạy AI'}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      )}

      {result && <AiResultPanel result={result} />}
    </div>
  );
};
