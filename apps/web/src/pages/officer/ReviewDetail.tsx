import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Evidence, ReviewDecision } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TwoQuestionsVerification, VerificationBadge } from '../../components/ui/VerificationBadge';
import { ConfidenceBar } from '../../components/ui/ConfidenceBar';
import { 
  ArrowLeft, 
  Check, 
  X, 
  Paperclip, 
  Edit3, 
  Eye, 
  ZoomIn, 
  ZoomOut,
  RotateCw, 
  Maximize2,
  Minimize2,
  AlertTriangle, 
  ShieldCheck, 
  Sparkles,
  HelpCircle,
  Scissors,
  ScanLine,
  SlidersHorizontal,
  Layers,
  FileCheck2,
  Info,
  CornerDownRight,
  ExternalLink
} from 'lucide-react';

interface BoundingBox {
  id: string;
  field: 'name' | 'code' | 'activity' | 'organizer' | 'date';
  label: string;
  top: number; // percentage
  left: number;
  width: number;
  height: number;
  value: string;
  confidence: number;
}

export const ReviewDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Document Viewer Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null);

  // Decision Bar State
  const [activeAction, setActiveAction] = useState<ReviewDecision | null>(null);
  const [finalScoreInput, setFinalScoreInput] = useState<number>(5.0);
  const [reasonInput, setReasonInput] = useState('');
  const [rejectBasisInput, setRejectBasisInput] = useState('REJECT_BASIS_UNVERIFIED');
  const [missingItemInput, setMissingItemInput] = useState('');
  const [deadlineInput, setDeadlineInput] = useState('2026-10-25');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Focus lock for hotkeys
  const isInputFocused = useRef(false);

  useEffect(() => {
    if (id) {
      apiClient.getEvidenceById(id).then((data) => {
        setEvidence(data);
        if (data?.aiSuggestions?.[0]?.suggestedScore) {
          setFinalScoreInput(data.aiSuggestions[0].suggestedScore);
        }
        setIsLoading(false);
      });
    }
  }, [id]);

  // Global hotkeys for rapid review (A = Approve, S = Score adjust, B = Supplement, R = Reject, Esc = Cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setActiveAction('APPROVED');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setActiveAction('SCORE_ADJUSTED');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setActiveAction('SUPPLEMENT_REQUESTED');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setActiveAction('REJECTED');
      } else if (e.key === 'Escape') {
        setActiveAction(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Đang khởi tạo buồng lái thẩm định hồ sơ (Review Cockpit)...</span>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="p-8 text-center space-y-3 bg-white border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-700">Hồ sơ không tồn tại hoặc đã bị xóa.</p>
        <Link to="/officer/queue" className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-bold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Hàng đợi</span>
        </Link>
      </div>
    );
  }

  const ocr = evidence.ocrResults?.[0];
  const verif = evidence.verificationResults?.[0];
  const ai = evidence.aiSuggestions?.[0];

  // Simulated OCR Bounding Boxes mapped to certificate
  const boundingBoxes: BoundingBox[] = [
    {
      id: 'box-name',
      field: 'name',
      label: 'Họ tên sinh viên',
      top: 36,
      left: 28,
      width: 44,
      height: 7,
      value: ocr?.studentNameExtracted || evidence.student?.fullName || 'Nguyễn Văn An',
      confidence: 0.98,
    },
    {
      id: 'box-code',
      field: 'code',
      label: 'Mã số sinh viên (MSSV)',
      top: 45,
      left: 35,
      width: 30,
      height: 6,
      value: ocr?.studentCodeExtracted || evidence.student?.studentCode || '102210001',
      confidence: 0.96,
    },
    {
      id: 'box-activity',
      field: 'activity',
      label: 'Tên sự kiện / Hoạt động',
      top: 54,
      left: 18,
      width: 64,
      height: 9,
      value: ocr?.activityNameExtracted || evidence.declaredActivityName || 'Hoạt động khai báo',
      confidence: 0.94,
    },
    {
      id: 'box-organizer',
      field: 'organizer',
      label: 'Đơn vị tổ chức & Ký tên',
      top: 72,
      left: 56,
      width: 38,
      height: 12,
      value: ocr?.organizerExtracted || 'Thành đoàn Đà Nẵng',
      confidence: 0.91,
    },
  ];

  const handleDecisionSubmit = async (decision: ReviewDecision) => {
    if ((decision === 'REJECTED' || decision === 'SUPPLEMENT_REQUESTED' || decision === 'SCORE_ADJUSTED') && !reasonInput.trim()) {
      alert('Bắt buộc phải nhập lý do khi Từ chối, Sửa điểm hoặc Yêu cầu bổ sung!');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.reviewEvidence(evidence.id, {
        decision: decision,
        finalScore: decision === 'APPROVED' || decision === 'SCORE_ADJUSTED' ? finalScoreInput : undefined,
        reason: reasonInput || (decision === 'APPROVED' ? 'Đã đối chiếu khớp minh chứng hợp lệ.' : ''),
        rejectBasis: decision === 'REJECTED' ? rejectBasisInput : undefined,
        missingItem: decision === 'SUPPLEMENT_REQUESTED' ? missingItemInput : undefined,
        supplementDeadline: decision === 'SUPPLEMENT_REQUESTED' ? deadlineInput : undefined,
      });

      alert(`Đã hoàn tất xử lý hồ sơ: ${decision}`);
      navigate('/officer/queue');
    } catch (err) {
      alert('Có lỗi xảy ra khi lưu quyết định duyệt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 relative">
      
      {/* 1. Header Toolbar Cockpit */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/officer/queue"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Quay lại Hàng đợi xét duyệt"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                COCKPIT · O03
              </span>
              <h1 className="text-base font-bold text-white">{evidence.declaredActivityName}</h1>
              <StatusBadge status={evidence.status} isOfficer={true} />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>Sinh viên: <strong className="text-slate-100">{evidence.student?.fullName || 'Nguyễn Văn An'}</strong> ({evidence.student?.studentCode || '102210001'})</span>
              <span>·</span>
              <span className="text-slate-400">Khoa CNTT</span>
              <span>·</span>
              <span className="font-mono text-slate-500">ID: {evidence.id}</span>
            </p>
          </div>
        </div>

        {/* Quick Decision Hotkey Preview */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-500 font-mono">Phím tắt nhanh:</span>
          <span className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono font-bold">[A] Duyệt</span>
          <span className="bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono font-bold">[S] Sửa điểm</span>
          <span className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono font-bold">[B] Bổ sung</span>
          <span className="bg-slate-800 text-rose-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono font-bold">[R] Từ chối</span>
        </div>
      </div>

      {/* 2. Main Cockpit Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Panel: Document Viewer with Interactive OCR Overlay (Col 6) */}
        <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg text-white space-y-3">
          
          {/* Viewer Toolbar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Minh chứng gốc & Đối chiếu OCR
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.2).toFixed(1)))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1.5 text-slate-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-slate-800 mx-1" />
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                title="Xoay 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                className={`p-1 rounded transition text-[10px] px-1.5 flex items-center gap-1 ${
                  highContrast ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Tăng tương phản (Làm rõ dấu mộc)"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Mộc đỏ</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBoxes(!showBoxes)}
                className={`p-1 rounded transition text-[10px] px-1.5 flex items-center gap-1 ${
                  showBoxes ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Bật/Tắt khung OCR"
              >
                <ScanLine className="w-3 h-3" />
                <span>OCR</span>
              </button>
            </div>
          </div>

          {/* Interactive Document Stage */}
          <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-900 min-h-[460px] flex items-center justify-center p-2 select-none">
            <div 
              className="relative transition-transform duration-200 origin-center max-w-full"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                filter: highContrast ? 'contrast(160%) saturate(140%)' : 'none',
              }}
            >
              <img
                src={evidence.files[0]?.fileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000'}
                alt="Minh chứng"
                className="max-h-[500px] w-auto object-contain rounded shadow-2xl block"
              />

              {/* Bounding Boxes Layer */}
              {showBoxes && boundingBoxes.map((box) => {
                const isHovered = hoveredField === box.field;
                const isSelected = selectedBox?.id === box.id;

                return (
                  <div
                    key={box.id}
                    onClick={() => setSelectedBox(box)}
                    onMouseEnter={() => setHoveredField(box.field)}
                    onMouseLeave={() => setHoveredField(null)}
                    style={{
                      top: `${box.top}%`,
                      left: `${box.left}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                    className={`absolute cursor-pointer transition-all duration-150 rounded border-2 ${
                      isHovered || isSelected
                        ? 'border-sky-400 bg-sky-400/25 ring-4 ring-sky-400/30 z-20'
                        : 'border-emerald-400/70 bg-emerald-400/10 hover:border-sky-400 hover:bg-sky-400/20 z-10'
                    }`}
                  >
                    <span className="absolute -top-4 left-0 bg-slate-950/90 text-sky-300 text-[9px] font-mono px-1 py-0.2 rounded border border-slate-700 whitespace-nowrap shadow pointer-events-none">
                      {box.label} ({Math.round(box.confidence * 100)}%)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* In-viewer Quick Selected Field Info Box */}
            {selectedBox && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 backdrop-blur border border-sky-500/50 rounded-lg p-2.5 shadow-2xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">{selectedBox.label}:</span>
                    <strong className="text-white font-semibold">{selectedBox.value}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-sky-950 text-sky-400 px-2 py-0.5 rounded border border-sky-800 font-mono">
                    Độ tin cậy: {Math.round(selectedBox.confidence * 100)}%
                  </span>
                  <button 
                    onClick={() => setSelectedBox(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Anomaly & Risk Cyber Signals Box (Cockpit Security Standard) */}
          <div className="p-3.5 bg-slate-900 border border-amber-500/30 rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Tín hiệu an toàn & Siêu dữ liệu số (Digital Forensics)</span>
              </div>
              <span className="text-[10px] font-mono bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                SHA-256 MATCH: OK
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">Dấu vết cắt ghép (ELA)</span>
                <span className="font-semibold text-emerald-400">Âm tính (Đồng nhất)</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">Font chữ & Căn lề</span>
                <span className="font-semibold text-emerald-400">Tự nhiên (No OCR drift)</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">Trùng lặp kho ảnh</span>
                <span className="font-semibold text-emerald-400">Duy nhất (Chưa từng nộp)</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              * Tín hiệu kỹ thuật được tạo tự động bởi AI Forensics nhằm trợ giúp Cán bộ, không cấu thành kết luận vi phạm độc lập.
            </p>
          </div>

        </div>

        {/* Right Panel: Cockpit Inspection, Rule Engine & Decision (Col 6) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Section 1: OCR Entity Cross-Check (Interactive Hoverable Cards) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Đối chiếu Thực thể OCR (Hover để highlight)
                </span>
              </div>
              <ConfidenceBar score={ocr?.confidenceScore || 0.94} isOfficer={true} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div 
                onMouseEnter={() => setHoveredField('name')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-lg border transition cursor-pointer ${
                  hoveredField === 'name' 
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-400 text-[10px]">Họ tên trên chứng nhận</span>
                  <span className="text-[9px] font-mono text-emerald-600 font-bold">98% match</span>
                </div>
                <span className="font-bold text-slate-900 block">{ocr?.studentNameExtracted || 'Nguyễn Văn An'}</span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('code')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-lg border transition cursor-pointer ${
                  hoveredField === 'code' 
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-400 text-[10px]">MSSV trích xuất</span>
                  <span className="text-[9px] font-mono text-emerald-600 font-bold">96% match</span>
                </div>
                <span className="font-bold text-slate-900 block">{ocr?.studentCodeExtracted || '102210001'}</span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('activity')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-lg border transition cursor-pointer ${
                  hoveredField === 'activity' 
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-400 text-[10px]">Hoạt động trích xuất</span>
                  <span className="text-[9px] font-mono text-sky-600 font-bold">94% match</span>
                </div>
                <span className="font-semibold text-slate-800 line-clamp-1">
                  {ocr?.activityNameExtracted || evidence.declaredActivityName}
                </span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('organizer')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-lg border transition cursor-pointer ${
                  hoveredField === 'organizer' 
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-400 text-[10px]">Đơn vị tổ chức</span>
                  <span className="text-[9px] font-mono text-sky-600 font-bold">91% match</span>
                </div>
                <span className="font-semibold text-slate-800 line-clamp-1">
                  {ocr?.organizerExtracted || 'Thành đoàn Đà Nẵng'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Two Verification Questions (Nguyên tắc 3) */}
          <TwoQuestionsVerification
            activityExists={verif?.activityExistsVerified ?? true}
            studentParticipation={verif?.studentParticipationVerified ?? true}
            sourceDesc={verif?.sourceDescription || 'Đối chiếu khớp danh sách giải thưởng công bố trên Cổng thông tin Thành đoàn.'}
          />

          <VerificationBadge level={verif?.verificationLevel || 2} isOfficer={true} />

          {/* Section 3: Rule Engine Pipeline Chain (Input -> Match -> Cap -> Final) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                <span>3. Chuỗi quy tắc Rule Engine & Khuyến nghị AI</span>
              </span>
              <span className="text-[10px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold">
                Quy chế v2025.1
              </span>
            </div>

            {/* Pipeline Flowchart Visual */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-medium space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-sky-800 bg-sky-50 px-2.5 py-1 rounded border border-sky-200">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>AI đề xuất: <strong>{ai?.suggestedScore || 5.0} đ</strong></span>
                </div>
                <div className="text-slate-400 font-mono text-xs">──►</div>
                <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  <Scissors className="w-3.5 h-3.5 text-slate-500" />
                  <span>Trần Tiêu chí 1.2: <strong>10.0 đ</strong></span>
                </div>
                <div className="text-slate-400 font-mono text-xs">──►</div>
                <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300 font-bold">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chốt đề xuất: [ {ai?.suggestedScore || 5.0} đ ]</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Căn cứ:</strong> {ai?.reasoning || 'Chứng nhận hợp lệ, khớp tiêu chí 1.2 Cuộc thi học thuật cấp Thành phố theo Điều 4 Khoản 2.'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Cockpit Action Panel (Thanh quyết định có hotkey) */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Hành động xét duyệt (Chọn 1 trong 4 hoặc ấn phím tắt)
              </span>
              <span className="text-[10px] text-slate-400">Ấn [Esc] để hủy lựa chọn</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveAction('APPROVED')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  activeAction === 'APPROVED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Duyệt hồ sơ</span>
                <span className="text-[10px] opacity-75 font-mono">[A]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('SCORE_ADJUSTED')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  activeAction === 'SCORE_ADJUSTED'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300'
                    : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>Sửa điểm</span>
                <span className="text-[10px] opacity-75 font-mono">[S]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('SUPPLEMENT_REQUESTED')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  activeAction === 'SUPPLEMENT_REQUESTED'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span>Bổ sung</span>
                <span className="text-[10px] opacity-75 font-mono">[B]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('REJECTED')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  activeAction === 'REJECTED'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                }`}
              >
                <X className="w-4 h-4" />
                <span>Từ chối</span>
                <span className="text-[10px] opacity-75 font-mono">[R]</span>
              </button>
            </div>

            {/* Action Sub-forms */}
            {activeAction === 'APPROVED' && (
              <div className="p-3.5 bg-emerald-50 rounded-lg space-y-3 text-xs border border-emerald-200 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Điểm phê duyệt chính thức:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      value={finalScoreInput}
                      onChange={(e) => setFinalScoreInput(parseFloat(e.target.value) || 0)}
                      className="w-24 p-1.5 border border-emerald-300 rounded font-bold text-center bg-white text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-emerald-800">điểm</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('APPROVED')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận Duyệt hồ sơ & Ghi điểm</span>
                </button>
              </div>
            )}

            {activeAction === 'SCORE_ADJUSTED' && (
              <div className="p-3.5 bg-sky-50 rounded-lg space-y-3 text-xs border border-sky-200 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-950">Điểm điều chỉnh mới:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      value={finalScoreInput}
                      onChange={(e) => setFinalScoreInput(parseFloat(e.target.value) || 0)}
                      className="w-24 p-1.5 border border-sky-300 rounded font-bold text-center bg-white text-sky-900 text-sm focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="font-bold text-sky-800">điểm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-sky-950 mb-1">
                    Lý do điều chỉnh điểm (Bắt buộc theo nguyên tắc giải trình):
                  </label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="VD: Điều chỉnh về mức 3.0đ do đạt giải khuyến khích theo Điều 5."
                    className="w-full p-2 border border-sky-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('SCORE_ADJUSTED')}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Lưu điểm điều chỉnh</span>
                </button>
              </div>
            )}

            {activeAction === 'SUPPLEMENT_REQUESTED' && (
              <div className="p-3.5 bg-amber-50 rounded-lg space-y-3 text-xs border border-amber-200 animate-in fade-in">
                <div>
                  <label className="block font-semibold text-amber-950 mb-1">
                    Giấy tờ cần bổ sung cụ thể:
                  </label>
                  <input
                    type="text"
                    value={missingItemInput}
                    onChange={(e) => setMissingItemInput(e.target.value)}
                    placeholder="VD: Ảnh chụp thẻ đeo đại biểu hoặc Email xác nhận của BTC..."
                    className="w-full p-2 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-950">Hạn chót sinh viên phải nộp:</span>
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="p-1.5 border border-amber-300 rounded-lg bg-white font-semibold text-amber-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-950 mb-1">Lý do yêu cầu:</label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="VD: Ảnh giấy chứng nhận bị mờ con dấu, cần thẻ đeo đối chiếu."
                    className="w-full p-2 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('SUPPLEMENT_REQUESTED')}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
                >
                  <Paperclip className="w-4 h-4" />
                  <span>Gửi yêu cầu bổ sung cho Sinh viên</span>
                </button>
              </div>
            )}

            {activeAction === 'REJECTED' && (
              <div className="p-3.5 bg-rose-50 rounded-lg space-y-3 text-xs border border-rose-200 animate-in fade-in">
                <div>
                  <label className="block font-semibold text-rose-950 mb-1">
                    Căn cứ từ chối (Bắt buộc theo nguyên tắc 6):
                  </label>
                  <select
                    value={rejectBasisInput}
                    onChange={(e) => setRejectBasisInput(e.target.value)}
                    className="w-full p-2 border border-rose-300 rounded-lg bg-white font-semibold text-rose-900 focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="REJECT_BASIS_UNVERIFIED">Không tìm thấy thông tin xác minh sau đối chiếu</option>
                    <option value="REJECT_BASIS_INCONSISTENT">Phát hiện mâu thuẫn họ tên / MSSV / thời gian</option>
                    <option value="REJECT_BASIS_OUT_OF_TERM">Hoạt động diễn ra ngoài khung thời gian của kỳ</option>
                    <option value="REJECT_BASIS_DUPLICATE">Minh chứng đã được nộp và tính điểm ở tiêu chí khác</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-rose-950 mb-1">
                    Giải thích lý do cụ thể gửi sinh viên:
                  </label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="Nêu rõ lý do từ chối để sinh viên nắm rõ căn cứ quy chế..."
                    className="w-full p-2 border border-rose-300 rounded-lg bg-white focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('REJECTED')}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Xác nhận Từ chối hồ sơ</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Floating Bottom Quick Bar (Always accessible on long screens) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 text-xs">
        <span className="text-slate-400 font-medium hidden sm:inline">Phê duyệt nhanh:</span>
        <button
          onClick={() => setActiveAction('APPROVED')}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-full transition flex items-center gap-1.5 shadow"
        >
          <Check className="w-3.5 h-3.5" />
          <span>[A] Duyệt</span>
        </button>
        <button
          onClick={() => setActiveAction('SCORE_ADJUSTED')}
          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 font-bold rounded-full transition flex items-center gap-1.5 shadow"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>[S] Sửa điểm</span>
        </button>
        <button
          onClick={() => setActiveAction('SUPPLEMENT_REQUESTED')}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 font-bold rounded-full transition flex items-center gap-1.5 shadow"
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>[B] Bổ sung</span>
        </button>
        <button
          onClick={() => setActiveAction('REJECTED')}
          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 font-bold rounded-full transition flex items-center gap-1.5 shadow"
        >
          <X className="w-3.5 h-3.5" />
          <span>[R] Từ chối</span>
        </button>
      </div>

    </div>
  );
};
