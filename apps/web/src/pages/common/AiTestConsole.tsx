import React, { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { EvidenceInspectionResult } from '../../types';
import { AiResultPanel } from '../../components/AiResultPanel';

const EVIDENCE_TYPES = [
  { value: 'GIAY_KHEN', label: 'Giấy khen / bằng khen' },
  { value: 'GIAY_XAC_NHAN', label: 'Giấy xác nhận có đóng dấu' },
  { value: 'GIAY_HIEN_MAU', label: 'Giấy hiến máu' },
  { value: 'VE_CHECKIN', label: 'Vé điện tử / check-in' },
  { value: 'ANH_SU_KIEN', label: 'Ảnh chụp sự kiện' },
  { value: 'OTHER', label: 'Khác' },
];

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.readAsDataURL(file);
  });

const toIsoOrNull = (value: string) => (value ? new Date(value).toISOString() : null);

export const AiTestConsole: React.FC = () => {
  const { user, activeTerm } = useAuth();
  const [activityName, setActivityName] = useState('');
  const [evidenceType, setEvidenceType] = useState('GIAY_KHEN');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [studentCode, setStudentCode] = useState(user?.studentCode || '');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EvidenceInspectionResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

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
        declaredStudent: {
          fullName: fullName.trim(),
          ...(studentCode.trim() ? { studentCode: studentCode.trim() } : {}),
        },
        participationDate: null,
        termStartDate: toIsoOrNull(activeTerm.startDate),
        termEndDate: toIsoOrNull(activeTerm.endDate),
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
      <header>
        <h1 className="text-xl font-bold text-slate-900">Chạy thử luồng AI minh chứng</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tải một tệp minh chứng và nhập thông tin khai báo để xem kết quả phân tích của AI (chất lượng ảnh, OCR, đối chiếu nguồn công khai, phôi và điểm tin cậy).
          Kết quả chỉ để tham khảo, không lưu vào hồ sơ và không thay đổi điểm chính thức.
        </p>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          Tên hoạt động / thành tích (không bắt buộc)
          <input
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            placeholder="Ví dụ: Ngày hội tình nguyện DUT 2025"
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
          Họ tên sinh viên (theo khai báo)
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          MSSV (nếu có)
          <input
            value={studentCode}
            onChange={(event) => setStudentCode(event.target.value)}
            placeholder="102210001"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

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
          Bật tra cứu nguồn công khai (Luồng 2) — cần AI Service có kết nối internet
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
