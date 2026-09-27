import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, CheckCircle2, Clock, AlertCircle, Plus, ChevronRight } from 'lucide-react';

export const Appeals: React.FC = () => {
  const [appeals, setAppeals] = useState([
    {
      id: 'apl-001',
      evidenceId: 'evd-001',
      activityName: 'Cuộc thi Danang TechHack 2026',
      content: 'Em nộp giấy chứng nhận đạt Giải Ba nhưng hệ thống ban đầu chỉ ghi nhận tham gia thường.',
      status: 'ACCEPTED',
      requestedScore: 5.0,
      adjustedScore: 5.0,
      resolutionNote: 'Đã đối chiếu lại chứng nhận Giải Ba, cập nhật điểm chính thức 5.0.',
      createdAt: '2026-09-17T10:00:00Z',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Khiếu nại điểm rèn luyện (S07)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi tiến trình giải quyết các thắc mắc, khiếu nại về điểm đánh giá từ Cán bộ Khoa.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Lịch sử khiếu nại ({appeals.length})
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {appeals.map((apl) => (
            <div key={apl.id} className="p-5 hover:bg-slate-50/50 transition space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">{apl.activityName}</span>
                  <span className="text-[10px] text-slate-400">ID: {apl.id}</span>
                </div>
                {apl.status === 'ACCEPTED' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã chấp thuận (+{apl.adjustedScore} đ)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Đang thụ lý</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-0.5">Nội dung giải trình:</strong>
                {apl.content}
              </div>

              {apl.resolutionNote && (
                <div className="text-xs text-emerald-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                  <strong className="block mb-0.5">Kết luận của Cán bộ:</strong>
                  {apl.resolutionNote}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
