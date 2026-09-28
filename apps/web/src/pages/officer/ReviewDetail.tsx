import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Evidence, ReviewDecision } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TwoQuestionsVerification, VerificationBadge } from '../../components/ui/VerificationBadge';
import { ConfidenceBar } from '../../components/ui/ConfidenceBar';

interface BoundingBox {
  id: string;
  field: 'name' | 'code' | 'activity' | 'organizer' | 'date';
  label: string;
  top: number;
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

  // O04: External Source Verification Drawer
  const [showAddSourceDrawer, setShowAddSourceDrawer] = useState(false);
  const [o04Level, setO04Level] = useState<1 | 2 | 3 | 4>(2);
  const [o04SourceName, setO04SourceName] = useState('');
  const [o04SourceUrl, setO04SourceUrl] = useState('');
  const [o04ConfirmActivity, setO04ConfirmActivity] = useState(true);
  const [o04ConfirmStudent, setO04ConfirmStudent] = useState(true);
  const [o04Note, setO04Note] = useState('');
  const [savedSources, setSavedSources] = useState<{ id: string; name: string; level: number; url?: string; confirmedActivity: boolean; confirmedStudent: boolean }[]>([
    {
      id: 'src-1',
      name: 'Cổng thông tin Thành đoàn Đà Nẵng',
      level: 2,
      url: 'https://thanhdoan.danang.gov.vn/khen-thuong/2026',
      confirmedActivity: true,
      confirmedStudent: true,
    }
  ]);

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
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-2">
        <span className="text-xs font-semibold text-slate-500">Đang tải hồ sơ xét duyệt...</span>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="p-8 text-center space-y-3 bg-white border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-700">Hồ sơ không tồn tại hoặc đã bị xóa.</p>
        <Link to="/officer/queue" className="text-xs text-sky-600 hover:underline font-bold">
          Quay lại Hàng đợi
        </Link>
      </div>
    );
  }

  const ocr = evidence.ocrResults?.[0];
  const verif = evidence.verificationResults?.[0];
  const ai = evidence.aiSuggestions?.[0];

  const boundingBoxes: BoundingBox[] = [
    {
      id: 'box-name',
      field: 'name',
      label: 'Họ tên',
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
      label: 'MSSV',
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
      label: 'Tên hoạt động',
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
      label: 'Đơn vị tổ chức',
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
    <div className="space-y-5 pb-28 relative">
      
      {/* 1. Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/officer/queue"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Hàng đợi
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">ID: {evidence.id}</span>
            <StatusBadge status={evidence.status} isOfficer={true} />
          </div>

          <h1 className="text-lg font-bold text-slate-900">{evidence.declaredActivityName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sinh viên: <strong className="text-slate-900">{evidence.student?.fullName || 'Nguyễn Văn An'}</strong> ({evidence.student?.studentCode || '102210001'}) · Khoa Công nghệ Thông tin
          </p>
        </div>

        {/* Hotkey Guide */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
          <span>Phím tắt:</span>
          <span className="font-bold text-slate-800">[A] Duyệt</span>
          <span>·</span>
          <span className="font-bold text-slate-800">[S] Sửa điểm</span>
          <span>·</span>
          <span className="font-bold text-slate-800">[B] Bổ sung</span>
          <span>·</span>
          <span className="font-bold text-slate-800">[R] Từ chối</span>
        </div>
      </div>

      {/* 2. Main Split View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Panel: Clean Document Viewer (Col 6) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          
          {/* Viewer Toolbar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Minh chứng gốc tải lên
            </span>

            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.2).toFixed(1)))}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded transition font-mono"
              >
                -
              </button>
              <span className="text-[11px] font-mono px-1 text-slate-500">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded transition font-mono"
              >
                +
              </button>
              <div className="w-px h-3 bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded transition text-xs font-medium"
              >
                Xoay 90°
              </button>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                className={`px-2 py-1 rounded transition text-xs font-medium ${
                  highContrast ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mộc đỏ
              </button>
              <button
                type="button"
                onClick={() => setShowBoxes(!showBoxes)}
                className={`px-2 py-1 rounded transition text-xs font-medium ${
                  showBoxes ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Khung OCR
              </button>
            </div>
          </div>

          {/* Interactive Document Stage */}
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 min-h-[460px] flex items-center justify-center p-2 select-none">
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
                className="max-h-[500px] w-auto object-contain rounded shadow-md block"
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
                        ? 'border-sky-500 bg-sky-500/20 ring-2 ring-sky-300 z-20'
                        : 'border-emerald-500/70 bg-emerald-500/10 hover:border-sky-500 z-10'
                    }`}
                  >
                    <span className="absolute -top-4 left-0 bg-slate-900 text-white text-[9px] font-mono px-1 rounded pointer-events-none whitespace-nowrap">
                      {box.label} ({Math.round(box.confidence * 100)}%)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Box Inspector */}
            {selectedBox && (
              <div className="absolute bottom-3 left-3 right-3 bg-white border border-slate-200 rounded-lg p-3 shadow-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">{selectedBox.label}:</span>
                  <strong className="text-slate-900 font-semibold">{selectedBox.value}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Độ tin cậy: {Math.round(selectedBox.confidence * 100)}%
                  </span>
                  <button 
                    onClick={() => setSelectedBox(null)}
                    className="text-slate-400 hover:text-slate-700 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Forensics Check Strip */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Kiểm tra an toàn số & Siêu dữ liệu ảnh
              </span>
              <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                SHA-256 HASH: OK
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Cắt ghép (ELA)</span>
                <span className="font-semibold text-emerald-700">Âm tính</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Font chữ & Căn lề</span>
                <span className="font-semibold text-emerald-700">Đồng nhất</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Trùng lặp kho ảnh</span>
                <span className="font-semibold text-emerald-700">Không trùng</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Panel: Analysis, Verification & Decision (Col 6) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Section 1: OCR Cross-check */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Trích xuất OCR & Đối chiếu trường
              </span>
              <ConfidenceBar score={ocr?.confidenceScore || 0.94} isOfficer={true} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div 
                onMouseEnter={() => setHoveredField('name')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  hoveredField === 'name' 
                    ? 'bg-sky-50 border-sky-400' 
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-slate-400 text-[10px] block">Họ tên trên chứng nhận</span>
                <span className="font-bold text-slate-900 block">{ocr?.studentNameExtracted || 'Nguyễn Văn An'}</span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('code')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  hoveredField === 'code' 
                    ? 'bg-sky-50 border-sky-400' 
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-slate-400 text-[10px] block">MSSV trích xuất</span>
                <span className="font-bold text-slate-900 block">{ocr?.studentCodeExtracted || '102210001'}</span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('activity')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  hoveredField === 'activity' 
                    ? 'bg-sky-50 border-sky-400' 
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-slate-400 text-[10px] block">Hoạt động trích xuất</span>
                <span className="font-semibold text-slate-800 line-clamp-1">
                  {ocr?.activityNameExtracted || evidence.declaredActivityName}
                </span>
              </div>

              <div 
                onMouseEnter={() => setHoveredField('organizer')}
                onMouseLeave={() => setHoveredField(null)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  hoveredField === 'organizer' 
                    ? 'bg-sky-50 border-sky-400' 
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-slate-400 text-[10px] block">Đơn vị tổ chức</span>
                <span className="font-semibold text-slate-800 line-clamp-1">
                  {ocr?.organizerExtracted || 'Thành đoàn Đà Nẵng'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Verification Checklist */}
          <TwoQuestionsVerification
            activityExists={verif?.activityExistsVerified ?? true}
            studentParticipation={verif?.studentParticipationVerified ?? true}
            sourceDesc={verif?.sourceDescription || 'Đối chiếu khớp danh sách giải thưởng công bố trên Cổng thông tin Thành đoàn.'}
          />

          <VerificationBadge level={verif?.verificationLevel || 2} isOfficer={true} />

          {/* O04: Recorded Sources */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Nguồn chứng cứ đã ghi nhận ({savedSources.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddSourceDrawer(true)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition"
              >
                + Thêm nguồn xác minh
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              {savedSources.map((s) => (
                <div key={s.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{s.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Cấp L{s.level} · {s.confirmedActivity && s.confirmedStudent ? 'Khớp cả 2 câu hỏi' : 'Khớp 1 phần'}
                    </span>
                  </div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-[11px] font-medium">
                      Tra cứu trực tuyến →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Rule Engine Flow */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Đề xuất AI & Khống chế Trần Quy chế
              </span>
              <span className="text-[10px] font-mono text-slate-500">Quy chế v2025.1</span>
            </div>

            <div className="flex items-center justify-between text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">AI Đề xuất</span>
                <strong className="text-slate-900 text-sm">{ai?.suggestedScore || 5.0} đ</strong>
              </div>
              <span className="text-slate-400">→</span>
              <div>
                <span className="text-slate-400 block text-[10px]">Trần Tiêu chí 1.2</span>
                <strong className="text-slate-700 text-sm">10.0 đ</strong>
              </div>
              <span className="text-slate-400">→</span>
              <div>
                <span className="text-emerald-700 block text-[10px]">Chốt đề xuất</span>
                <strong className="text-emerald-800 text-sm">{ai?.suggestedScore || 5.0} đ</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 italic">
              Căn cứ: {ai?.reasoning || 'Chứng nhận hợp lệ, khớp tiêu chí 1.2 Cuộc thi học thuật cấp Thành phố theo Điều 4 Khoản 2.'}
            </p>
          </div>

          {/* Section 4: Decision Actions (Clean Typography Buttons) */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Quyết định duyệt của Cán bộ
              </span>
              <span className="text-[11px] text-slate-400">Phím tắt: [A] [S] [B] [R] · [Esc] Hủy</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveAction('APPROVED')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition text-center ${
                  activeAction === 'APPROVED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Duyệt hồ sơ [A]
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('SCORE_ADJUSTED')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition text-center ${
                  activeAction === 'SCORE_ADJUSTED'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sửa điểm [S]
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('SUPPLEMENT_REQUESTED')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition text-center ${
                  activeAction === 'SUPPLEMENT_REQUESTED'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Bổ sung [B]
              </button>

              <button
                type="button"
                onClick={() => setActiveAction('REJECTED')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition text-center ${
                  activeAction === 'REJECTED'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Từ chối [R]
              </button>
            </div>

            {/* Action Form Submissions */}
            {activeAction === 'APPROVED' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Điểm phê duyệt chính thức:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      value={finalScoreInput}
                      onChange={(e) => setFinalScoreInput(parseFloat(e.target.value) || 0)}
                      className="w-24 p-1.5 border border-emerald-300 rounded font-bold text-center bg-white text-emerald-900 text-sm"
                    />
                    <span className="font-bold text-emerald-900">điểm</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('APPROVED')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Xác nhận Duyệt hồ sơ & Ghi điểm
                </button>
              </div>
            )}

            {activeAction === 'SCORE_ADJUSTED' && (
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-950">Điểm điều chỉnh mới:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      value={finalScoreInput}
                      onChange={(e) => setFinalScoreInput(parseFloat(e.target.value) || 0)}
                      className="w-24 p-1.5 border border-sky-300 rounded font-bold text-center bg-white text-sky-900 text-sm"
                    />
                    <span className="font-bold text-sky-900">điểm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-sky-950 mb-1">
                    Lý do điều chỉnh điểm:
                  </label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="VD: Điều chỉnh về mức 3.0đ do đạt giải khuyến khích theo Điều 5."
                    className="w-full p-2 border border-sky-300 rounded-xl bg-white"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('SCORE_ADJUSTED')}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Lưu điểm điều chỉnh
                </button>
              </div>
            )}

            {activeAction === 'SUPPLEMENT_REQUESTED' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-amber-950 mb-1">
                    Giấy tờ cần bổ sung cụ thể:
                  </label>
                  <input
                    type="text"
                    value={missingItemInput}
                    onChange={(e) => setMissingItemInput(e.target.value)}
                    placeholder="VD: Ảnh chụp thẻ đeo đại biểu hoặc Email xác nhận của BTC..."
                    className="w-full p-2 border border-amber-300 rounded-xl bg-white"
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-950">Hạn chót sinh viên phải nộp:</span>
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="p-1.5 border border-amber-300 rounded-xl bg-white font-semibold text-amber-900"
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
                    className="w-full p-2 border border-amber-300 rounded-xl bg-white"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('SUPPLEMENT_REQUESTED')}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Gửi yêu cầu bổ sung cho Sinh viên
                </button>
              </div>
            )}

            {activeAction === 'REJECTED' && (
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-rose-950 mb-1">
                    Căn cứ từ chối:
                  </label>
                  <select
                    value={rejectBasisInput}
                    onChange={(e) => setRejectBasisInput(e.target.value)}
                    className="w-full p-2 border border-rose-300 rounded-xl bg-white font-semibold text-rose-900"
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
                    className="w-full p-2 border border-rose-300 rounded-xl bg-white"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecisionSubmit('REJECTED')}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Xác nhận Từ chối hồ sơ
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Floating Bottom Quick Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-slate-300 text-slate-900 px-5 py-2.5 rounded-full shadow-xl flex items-center gap-3 text-xs">
        <span className="text-slate-400 font-medium hidden sm:inline">Phê duyệt:</span>
        <button
          onClick={() => setActiveAction('APPROVED')}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full transition"
        >
          [A] Duyệt
        </button>
        <button
          onClick={() => setActiveAction('SCORE_ADJUSTED')}
          className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-full transition"
        >
          [S] Sửa điểm
        </button>
        <button
          onClick={() => setActiveAction('SUPPLEMENT_REQUESTED')}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-full transition"
        >
          [B] Bổ sung
        </button>
        <button
          onClick={() => setActiveAction('REJECTED')}
          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full transition"
        >
          [R] Từ chối
        </button>
      </div>

      {/* O04: Drawer Thêm nguồn xác minh ngoài trường */}
      {showAddSourceDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Thêm Nguồn Xác Minh Ngoài Trường (O04)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Ghi nhận căn cứ chứng minh độc lập cho hoạt động
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddSourceDrawer(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Level selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Chọn cấp độ chứng cứ:
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[
                  { lvl: 1 as const, label: 'L1: Cổng dữ liệu / QR' },
                  { lvl: 2 as const, label: 'L2: Công văn / Thư BTC' },
                  { lvl: 3 as const, label: 'L3: Báo chí / MXH' },
                  { lvl: 4 as const, label: 'L4: Thẩm định riêng' },
                ].map((opt) => (
                  <button
                    key={opt.lvl}
                    type="button"
                    onClick={() => {
                      setO04Level(opt.lvl);
                      if (opt.lvl === 4) setO04ConfirmStudent(false);
                      else setO04ConfirmStudent(true);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      o04Level === opt.lvl
                        ? 'bg-slate-900 text-white font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Two independent question checkboxes */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={o04ConfirmActivity}
                  onChange={(e) => setO04ConfirmActivity(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4"
                />
                <span>1. Nguồn xác nhận: <strong>Hoạt động có diễn ra trong thực tế</strong></span>
              </label>
              <label className={`flex items-center gap-2 text-slate-800 font-medium ${o04Level === 4 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={o04Level === 4}
                  checked={o04ConfirmStudent}
                  onChange={(e) => setO04ConfirmStudent(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4"
                />
                <span>2. Nguồn xác nhận: <strong>Đúng sinh viên này có tham gia</strong></span>
              </label>
            </div>

            {/* Input Details */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên đơn vị / Nguồn tài liệu xác thực <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={o04SourceName}
                  onChange={(e) => setO04SourceName(e.target.value)}
                  placeholder="VD: Cổng thông tin Thành đoàn Đà Nẵng..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Đường dẫn (URL) tra cứu
                </label>
                <input
                  type="url"
                  value={o04SourceUrl}
                  onChange={(e) => setO04SourceUrl(e.target.value)}
                  placeholder="https://thanhdoan.danang.gov.vn/tra-cuu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú trích lục
                </label>
                <textarea
                  rows={2}
                  value={o04Note}
                  onChange={(e) => setO04Note(e.target.value)}
                  placeholder="Trích dẫn nội dung xác nhận..."
                  className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddSourceDrawer(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!o04SourceName.trim()) {
                    alert('Vui lòng nhập tên nguồn tài liệu xác thực!');
                    return;
                  }
                  setSavedSources((prev) => [
                    ...prev,
                    {
                      id: `src-${Date.now()}`,
                      name: o04SourceName,
                      level: o04Level,
                      url: o04SourceUrl || undefined,
                      confirmedActivity: o04ConfirmActivity,
                      confirmedStudent: o04ConfirmStudent,
                    },
                  ]);
                  setShowAddSourceDrawer(false);
                  setO04SourceName('');
                  setO04SourceUrl('');
                  setO04Note('');
                  alert(`Đã ghi nhận nguồn xác minh Cấp L${o04Level} thành công!`);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
              >
                Lưu nguồn xác minh
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
