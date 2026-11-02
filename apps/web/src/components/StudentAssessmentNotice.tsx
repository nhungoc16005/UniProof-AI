import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useStudentAssessmentAccess } from '../hooks/useStudentAssessmentAccess';

type Access = ReturnType<typeof useStudentAssessmentAccess>;
export function studentWriteLockMessage(access: Access) {
  const data = access.assessment;
  if (!data) return '';
  if (data.term?.status === 'CLOSED') return 'Kỳ đánh giá đã đóng cổng tiếp nhận. Phiếu chỉ được xem.';
  if (data.term?.status === 'REVIEWING' && !access.canEdit) return access.isReturned && access.deadlinePassed
    ? 'Kỳ đánh giá đã đóng cổng tiếp nhận và đã hết hạn nộp lại. Phiếu chỉ được xem.'
    : 'Kỳ đánh giá đã đóng cổng tiếp nhận phiếu mới. Kỳ đang trong giai đoạn xét duyệt; phiếu chỉ được xem.';
  if (data.term?.status === 'UPCOMING') return 'Kỳ đánh giá chưa mở cổng tiếp nhận. Phiếu chỉ được xem.';
  if (!data.rubricVersion) return 'Kỳ này chưa có bộ tiêu chí được ban hành.';
  if (access.deadlinePassed) return access.isReturned ? 'Đã hết hạn sửa và nộp lại phiếu. Phiếu chỉ được xem.' : 'Đã hết hạn nộp đánh giá và minh chứng. Phiếu chỉ được xem.';
  if (data.submission?.status === 'SUBMITTED') return 'Phiếu đã nộp và đang chờ cán bộ xử lý. Phiếu chỉ được xem.';
  if (['SENT', 'EXCLUDED'].includes(data.handoff?.status ?? '')) return 'Phiếu đã khóa trong quy trình đánh giá. Phiếu chỉ được xem.';
  return 'Hiện chưa được chỉnh sửa phiếu. Vui lòng liên hệ cán bộ Khoa nếu cần hỗ trợ.';
}

export const StudentAssessmentNotice: React.FC<{ access: Access; showEditLink?: boolean; termId: string; onRetry?: () => void }> = ({ access, showEditLink = false, termId, onRetry }) => {
  const message = studentWriteLockMessage(access);
  const deadline = access.editDeadline ? new Date(access.editDeadline).toLocaleString('vi-VN') : '';
  return <div className="space-y-3">
    {access.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{access.error}<button type="button" disabled={access.checking} onClick={() => onRetry ? onRetry() : void access.refresh().catch(() => undefined)} className="ml-2 font-semibold underline disabled:opacity-50">{access.checking ? 'Đang kiểm tra…' : 'Thử lại'}</button></div>}
    {!access.canEdit && message && !access.error && <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{message}</p>}
    {access.isReturned && <section role="status" aria-label="Phiếu bị trả" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900"><AlertCircle aria-hidden="true" className="h-4 w-4" />Bị trả phiếu — cần chỉnh sửa</span>
        <p className="mt-3 whitespace-pre-wrap break-words"><strong>Lý do trả: </strong>{access.assessment?.submission?.returnReason || 'Vui lòng rà soát lại phiếu theo yêu cầu của cán bộ.'}</p>
        {deadline && <p className="mt-2">Hạn nộp lại: <strong>{deadline}</strong></p>}
        {access.canEdit && <p className="mt-2">{access.assessment?.term?.status === 'REVIEWING' ? 'Cổng nộp mới đã đóng. Riêng phiếu bị trả này vẫn được sửa và nộp lại đến hạn chấm.' : 'Bạn có thể sửa thông tin, bổ sung minh chứng và nộp lại phiếu đến hạn chấm.'}</p>}
      </div>{showEditLink && (access.canEdit ? <Link to={`/student/scores?termId=${encodeURIComponent(termId)}`} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800">Sửa & Nộp lại</Link> : <button type="button" disabled className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white opacity-50">Sửa & Nộp lại</button>)}</div>
    </section>}
  </div>;
};
