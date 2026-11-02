import React from 'react';
import { Award, Clock, GraduationCap, ChevronRight } from 'lucide-react';
import { percentage } from '../../lib/facultyAnalytics';

type ReportSummary = {
  total: number;
  totalEvaluated: number;
  pendingStudents: number;
  averageScore: number | null;
  distribution: Record<string, number>;
  source: string;
  summary?: { recordedNotSubmitted?: number };
  classProgress: {
    id: string;
    code: string;
    total: number;
    completed: number;
    pending: number;
    average: number | null;
  }[];
};
const GRADE_LEVELS = [
  { key: 'XUAT_SAC', label: 'Xuất sắc', range: '≥ 90', color: '#059669' },
  { key: 'TOT', label: 'Tốt', range: '80 – 89', color: '#1D6FC2' },
  { key: 'KHA', label: 'Khá', range: '65 – 79', color: '#0284C7' },
  { key: 'TRUNG_BINH', label: 'Trung bình', range: '50 – 64', color: '#F59E0B' },
  { key: 'YEU', label: 'Yếu', range: '< 50', color: '#EF4444' },
] as const;

export const FacultyResultsCard: React.FC<{
  report: ReportSummary | null;
  termId: string;
  onOpenLookup?: (classId?: string) => void;
}> = ({ report, onOpenLookup }) => {
  if (!report) {
    return (
      <div className="py-8 text-center text-xs text-[#6B6B6B]">
        Đang tổng hợp kết quả công bố…
      </div>
    );
  }

  const { total, totalEvaluated, pendingStudents, averageScore, distribution, classProgress } = report;
  const maxGradeCount = Math.max(1, ...GRADE_LEVELS.map((g) => distribution[g.key] || 0));
  const recorded = report.summary?.recordedNotSubmitted ?? 0;

  return (
    <div className="space-y-4">
      {/* CARD HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold font-heading text-[#0A0A0A]">
            Kết quả đã công bố
          </h2>
          <p className="mt-0.5 text-xs text-[#6B6B6B]">
            Phiên bản công bố chính thức mới nhất.
          </p>
        </div>
        {onOpenLookup && (
          <button
            type="button"
            onClick={() => onOpenLookup()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6FC2] hover:underline"
          >
            Tra cứu chi tiết <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* 3 CONTEXTUAL STATS */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5]/80 p-2 shadow-2xs">
          <span className="block text-[10px] font-semibold text-[#065F46] uppercase tracking-wider">Đã công bố</span>
          <strong className="text-base font-bold font-heading text-[#059669] tabular-nums">
            {totalEvaluated}/{total}
          </strong>
          <span className="block text-[10px] text-[#065F46] font-medium">
            ({percentage(totalEvaluated, total)}%)
          </span>
        </div>
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB]/80 p-2 shadow-2xs">
          <span className="block text-[10px] font-semibold text-[#92400E] uppercase tracking-wider">Chưa có KQ</span>
          <strong className="text-base font-bold font-heading text-[#D97706] tabular-nums">
            {pendingStudents}
          </strong>
          <span className="block text-[10px] text-[#92400E] font-medium">
            ({percentage(pendingStudents, total)}%)
          </span>
        </div>
        <div className="rounded-lg border border-[#C2DBF2] bg-[#F0F6FC]/80 p-2 shadow-2xs">
          <span className="block text-[10px] font-semibold text-[#12457A] uppercase tracking-wider">Điểm TB</span>
          <strong className="text-base font-bold font-heading text-[#1D6FC2] tabular-nums">
            {averageScore !== null && averageScore !== undefined ? averageScore : '—'}
          </strong>
          <span className="block text-[10px] text-[#12457A] font-medium">thang 100</span>
        </div>
      </div>

      {/* 2 SUB-COLUMNS: PHỔ ĐIỂM + TIẾN ĐỘ LỚP */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PHỔ ĐIỂM (HORIZONTAL BARS) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0A0A0A]">Phổ điểm xếp loại</p>
          {totalEvaluated === 0 ? (
            <p className="py-4 text-center text-xs text-[#6B6B6B]">Chưa có sinh viên nào có điểm.</p>
          ) : (
            <div className="space-y-1.5">
              {GRADE_LEVELS.map((grade) => {
                const count = distribution[grade.key] || 0;
                const pct = percentage(count, totalEvaluated);
                const barWidth = Math.round((count / maxGradeCount) * 100);

                return (
                  <div key={grade.key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-[#0A0A0A]">
                        <span
                          className="h-2 w-2 rounded-sm shrink-0"
                          style={{ backgroundColor: grade.color }}
                        />
                        {grade.label}
                      </span>
                      <span className="tabular-nums font-medium text-[#0A0A0A]">
                        {count} <span className="text-[#6B6B6B]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F3F5]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%`, backgroundColor: grade.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TIẾN ĐỘ THEO LỚP (COMPACT LIST) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0A0A0A]">Tiến độ theo lớp</p>
          {!classProgress?.length ? (
            <p className="py-4 text-center text-xs text-[#6B6B6B]">Chưa có lớp.</p>
          ) : (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {classProgress.slice(0, 6).map((cls) => {
                const pct = cls.total > 0 ? Math.round((cls.completed / cls.total) * 100) : 0;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => onOpenLookup?.(cls.id)}
                    className="w-full text-left rounded p-1 hover:bg-[#F4F4F6] transition-colors"
                    title={`Xem sinh viên lớp ${cls.code}`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#1D6FC2] truncate">{cls.code}</span>
                      <span className="tabular-nums text-[#6B6B6B]">
                        {cls.completed}/{cls.total} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#F1F3F5]">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? 'bg-[#059669]' : 'bg-[#1D6FC2]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2 COMPACT CALLOUTS */}
      <div className="grid grid-cols-2 gap-2 border-t border-[#E8E8EC] pt-2.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#6B6B6B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D97706] shrink-0" />
          <span>Chưa có KQ: <strong>{pendingStudents} SV</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-[#6B6B6B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#991B1B] shrink-0" />
          <span>K.Nộp quy chế: <strong>{recorded} SV</strong></span>
        </div>
      </div>
    </div>
  );
};
