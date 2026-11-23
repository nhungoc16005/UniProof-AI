import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Columns2,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { AiResultPanel } from '../../components/AiResultPanel';
import { EvidenceInspectionResult } from '../../types';

const DEFAULT_AI_URL = (import.meta.env.VITE_AI_URL as string | undefined) || 'http://127.0.0.1:8000';

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
  { value: 'rapidocr_vietocr', label: 'RapidOCR (PP-OCRv4) + VietOCR (Mới — chuẩn dấu TV)' },
  { value: 'rapidocr', label: 'RapidOCR ONNX thuần (Siêu nhẹ ~250MB RAM)' },
  { value: 'tesseract', label: 'Tesseract 5 (Baseline cũ)' },
] as const;

type OcrEngineChoice = (typeof OCR_ENGINES)[number]['value'];

interface HealthStatus {
  status: string;
  ocrAvailable?: boolean;
  tesseractAvailable?: boolean;
  rapidOcrAvailable?: boolean;
  vietOcrAvailable?: boolean;
  defaultOcrEngine?: string;
}

interface OcrBoxItem {
  text: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface CompareEngineResult {
  engine: string;
  elapsedMs: number;
  boxCount: number;
  extraction: {
    rawText: string;
    available: boolean;
    errorDetails?: string | null;
    recognitionConfidence?: number | null;
    recognitionMethod?: string | null;
    studentNameExtracted?: string | null;
    studentCodeExtracted?: string | null;
    activityNameExtracted?: string | null;
    organizerExtracted?: string | null;
    issuedDateExtracted?: string | null;
    certificateNumber?: string | null;
    citizenIdExtracted?: string | null;
    nameMatchRatio?: number;
    codeMatched?: boolean;
    codeMismatch?: boolean;
    ocrBoxes?: OcrBoxItem[] | null;
  };
}

interface CompareResponse {
  success: boolean;
  imageWidth?: number | null;
  imageHeight?: number | null;
  results: CompareEngineResult[];
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.readAsDataURL(file);
  });

const engineLabel = (engine: string) => {
  if (engine === 'rapidocr_vietocr') return 'RapidOCR + VietOCR (Mới)';
  if (engine === 'rapidocr') return 'RapidOCR ONNX';
  if (engine === 'tesseract') return 'Tesseract 5 (Cũ)';
  return engine;
};

export const AiOcrLab: React.FC = () => {
  const [aiUrl, setAiUrl] = useState(DEFAULT_AI_URL);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState('');
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  const [evidenceType, setEvidenceType] = useState('GIAY_KHEN');
  const [ocrEngine, setOcrEngine] = useState<OcrEngineChoice>('auto');
  const [fullName, setFullName] = useState('Nguyễn Văn A');
  const [studentCode, setStudentCode] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [activityName, setActivityName] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  const [mode, setMode] = useState<'inspect' | 'compare' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [inspectResult, setInspectResult] = useState<(EvidenceInspectionResult & {
    ocrExtraction?: EvidenceInspectionResult['ocrExtraction'] & {
      recognitionMethod?: string | null;
      recognitionConfidence?: number | null;
      processingTimeMs?: number | null;
      ocrBoxes?: OcrBoxItem[] | null;
    };
  }) | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

  const checkHealth = async (url = aiUrl) => {
    setCheckingHealth(true);
    setHealthError('');
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HealthStatus;
      setHealth(data);
    } catch (err: any) {
      setHealth(null);
      setHealthError(`Không kết nối được AI Service tại ${url} (${err?.message || 'network error'}).`);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    void checkHealth();
  }, []);

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    setInspectResult(null);
    setCompareResult(null);
    setError('');
    setNaturalSize(null);
    if (selected && selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  };

  const runInspect = async () => {
    if (!file) {
      setError('Vui lòng chọn tệp ảnh hoặc PDF minh chứng.');
      return;
    }
    setError('');
    setLoading(true);
    setMode('inspect');
    setInspectResult(null);
    setCompareResult(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${aiUrl.replace(/\/$/, '')}/api/v1/evidence/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: `lab-${Date.now()}`,
          activityName: activityName.trim() || null,
          evidenceType,
          ocrEngine,
          declaredStudent: {
            fullName: fullName.trim() || 'Sinh viên kiểm thử',
            studentCode: studentCode.trim() || null,
            citizenId: citizenId.trim() || null,
          },
          fileBytesBase64: dataUrl,
          enableWebSearch,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
      setInspectResult(json);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi chạy pipeline kiểm tra.');
    } finally {
      setLoading(false);
    }
  };

  const runCompare = async () => {
    if (!file) {
      setError('Vui lòng chọn tệp ảnh hoặc PDF minh chứng.');
      return;
    }
    setError('');
    setLoading(true);
    setMode('compare');
    setInspectResult(null);
    setCompareResult(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${aiUrl.replace(/\/$/, '')}/api/v1/evidence/compare-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBytesBase64: dataUrl,
          evidenceType,
          activityName: activityName.trim() || null,
          declaredStudent: {
            fullName: fullName.trim() || 'Sinh viên kiểm thử',
            studentCode: studentCode.trim() || null,
            citizenId: citizenId.trim() || null,
          },
          engines: ['tesseract', 'rapidocr_vietocr'],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
      setCompareResult(json);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi so sánh A/B các engine OCR.');
    } finally {
      setLoading(false);
    }
  };

  const activeBoxes: OcrBoxItem[] =
    inspectResult?.ocrExtraction?.ocrBoxes ||
    compareResult?.results.find((r) => r.engine !== 'tesseract')?.extraction.ocrBoxes ||
    [];

  const overlayW = compareResult?.imageWidth || naturalSize?.w || 0;
  const overlayH = compareResult?.imageHeight || naturalSize?.h || 0;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Cpu className="h-3.5 w-3.5" />
              UniProof-AI • Local Document AI Lab (CPU 8GB ONNX-First)
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Phòng kiểm thử OCR & Pipeline Minh chứng mới
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Kiểm tra trực tiếp lõi <strong>RapidOCR (PP-OCRv4) + VietOCR</strong> chạy 100% nội bộ, xem khung nhận diện chữ và so sánh A/B với Tesseract cũ. Không cần đăng nhập, không lưu DB.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <input
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                className="w-52 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                title="AI Service Base URL"
              />
              <button
                type="button"
                onClick={() => void checkHealth(aiUrl)}
                disabled={checkingHealth}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
                Kiểm tra
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 text-xs">
              {health ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> AI Online
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${health.rapidOcrAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    RapidOCR: {health.rapidOcrAvailable ? 'Sẵn sàng' : 'Chưa cài'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${health.vietOcrAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    VietOCR: {health.vietOcrAvailable ? 'Sẵn sàng' : 'Chưa cài'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${health.tesseractAvailable ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}>
                    Tesseract: {health.tesseractAvailable ? 'OK' : 'Off'}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 font-medium text-rose-700">
                  <XCircle className="h-3.5 w-3.5" /> {healthError || 'Offline'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Input & Preview */}
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Upload className="h-4 w-4 text-blue-600" />
              1. Chọn tệp minh chứng & thông tin khai báo
            </h2>

            <label className="block text-xs font-semibold text-slate-700">
              Tệp minh chứng (JPG, PNG, PDF ≤ 8MB)
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="mt-1.5 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 py-2 file:font-semibold file:text-white hover:border-blue-400"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Loại minh chứng
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {EVIDENCE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Engine OCR (khi chạy Pipeline)
                <select
                  value={ocrEngine}
                  onChange={(e) => setOcrEngine(e.target.value as OcrEngineChoice)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {OCR_ENGINES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Họ tên sinh viên khai báo
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Thị Thảo Vy"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                MSSV (nếu có)
                <input
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="VD: 102230027"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                Tên hoạt động (không bắt buộc)
                <input
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="VD: Da Nang Code League / Chiến dịch Mùa hè xanh"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              {evidenceType === 'GIAY_HIEN_MAU' && (
                <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                  Số CCCD (chỉ dùng cho Giấy hiến máu)
                  <input
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    placeholder="12 chữ số CCCD"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Bật tra cứu nguồn chính thống Allow-list (Luồng 2 — D1)
            </label>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => void runInspect()}
                disabled={loading || !file}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {loading && mode === 'inspect' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                Chạy Pipeline mới
              </button>

              <button
                type="button"
                onClick={() => void runCompare()}
                disabled={loading || !file}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading && mode === 'compare' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Columns2 className="h-4 w-4" />
                )}
                So sánh A/B (Tesseract cũ vs RapidOCR + VietOCR)
              </button>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}
          </div>

          {/* Preview + Bounding Boxes */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Activity className="h-4 w-4 text-emerald-600" />
                2. Xem trước tệp & Vùng chữ AI phát hiện ({activeBoxes.length} box)
              </h2>
              {activeBoxes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBoxes((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {showBoxes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showBoxes ? 'Ẩn khung chữ' : 'Hiện khung chữ'}
                </button>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 min-h-[320px]">
              {previewUrl ? (
                <div className="relative inline-block max-h-[460px] max-w-full">
                  <img
                    src={previewUrl}
                    alt="Minh chứng xem trước"
                    onLoad={(e) =>
                      setNaturalSize({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      })
                    }
                    className="block max-h-[460px] max-w-full rounded object-contain"
                  />
                  {showBoxes && activeBoxes.length > 0 && overlayW > 0 && overlayH > 0 && (
                    <svg
                      viewBox={`0 0 ${overlayW} ${overlayH}`}
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      preserveAspectRatio="none"
                    >
                      {activeBoxes.map((b, idx) => {
                        const [x1, y1, x2, y2] = b.bbox;
                        return (
                          <g key={idx}>
                            <rect
                              x={x1}
                              y={y1}
                              width={Math.max(1, x2 - x1)}
                              height={Math.max(1, y2 - y1)}
                              fill="rgba(37, 99, 235, 0.12)"
                              stroke="#2563eb"
                              strokeWidth={Math.max(2, overlayW / 450)}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <FileText className="h-10 w-10 text-blue-600" />
                  <span className="text-sm font-semibold">{file.name}</span>
                  <span className="text-xs text-slate-500">Tệp PDF — nhấn chạy để xem kết quả trích xuất</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">Chưa chọn tệp minh chứng</span>
              )}
            </div>
          </div>
        </section>

        {/* A/B Comparison View */}
        {compareResult && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Kết quả so sánh A/B trên cùng 1 tệp minh chứng
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {compareResult.results.map((item) => {
                const isNew = item.engine !== 'tesseract';
                const ex = item.extraction;
                return (
                  <div
                    key={item.engine}
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      isNew ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isNew ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {engineLabel(item.engine)}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">
                          Phương thức thực tế: <code>{ex.recognitionMethod || item.engine}</code>
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold text-slate-900">{item.elapsedMs} ms</div>
                        <div className="text-slate-500">
                          Conf: {ex.recognitionConfidence != null ? `${ex.recognitionConfidence}%` : '—'} • {item.boxCount} box
                        </div>
                      </div>
                    </div>

                    {/* Extracted 6 fields */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['Họ tên', ex.studentNameExtracted],
                        ['MSSV', ex.studentCodeExtracted],
                        ['Hoạt động', ex.activityNameExtracted],
                        ['Đơn vị tổ chức', ex.organizerExtracted],
                        ['Ngày cấp', ex.issuedDateExtracted],
                        ['Số QĐ / CCCD', ex.certificateNumber || ex.citizenIdExtracted],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[11px] font-medium text-slate-500">{label}</div>
                          <div className={`mt-0.5 font-semibold ${val ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                            {val || 'Không trích xuất được'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Raw OCR Text */}
                    <div className="mt-4">
                      <div className="mb-1 text-xs font-semibold text-slate-700">
                        Toàn văn OCR đọc được ({ex.rawText.length} ký tự):
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
                        {ex.rawText || ex.errorDetails || '(Trống)'}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Full Pipeline Inspection Result */}
        {inspectResult && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              <span>
                <strong>Engine đã chạy:</strong>{' '}
                <code>{inspectResult.ocrExtraction?.recognitionMethod || ocrEngine}</code>
              </span>
              <span>
                <strong>Thời gian OCR:</strong>{' '}
                {inspectResult.ocrExtraction?.processingTimeMs != null
                  ? `${inspectResult.ocrExtraction.processingTimeMs} ms`
                  : '—'}
              </span>
              <span>
                <strong>Độ tin cậy OCR (chẩn đoán):</strong>{' '}
                {inspectResult.ocrExtraction?.recognitionConfidence != null
                  ? `${inspectResult.ocrExtraction.recognitionConfidence}%`
                  : '—'}
              </span>
            </div>
            <AiResultPanel result={inspectResult} />
          </section>
        )}
      </div>
    </div>
  );
};
