import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';
import { Layers, ShieldAlert, BookOpen, CheckCircle } from 'lucide-react';

export const CriteriaRulesView: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  useEffect(() => {
    apiClient.getCriteria().then(setCriteria);
  }, []);

  const sampleRules = [
    {
      code: 'RULE_CAP_CHEERLEADER',
      name: 'Khống chế trần điểm cổ vũ (Điều 6 Khoản 3)',
      logic: 'Nêu sinh viên có vai trò CHEERLEADER thì điểm tối đa = 2.0 đ / hoạt động và tổng không quá 5.0 đ / kỳ.',
      status: 'PUBLISHED',
    },
    {
      code: 'RULE_PREREQUISITE_BLOOD_DONATION',
      name: 'Quy tắc công nhận hiến máu (Điều 7 Khoản 2)',
      logic: 'Bắt buộc đối chiếu khớp danh sách điểm danh Đoàn trường hoặc có giấy xác nhận có mộc đỏ hợp lệ.',
      status: 'PUBLISHED',
    },
    {
      code: 'RULE_TERM_DEADLINE_CHECK',
      name: 'Chặn nộp sau hạn chót (Submission Deadline)',
      logic: 'Thời gian tham gia và nộp minh chứng phải nằm trong khung thời gian của Term đang ACTIVE.',
      status: 'PUBLISHED',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tiêu chí & Quy tắc Rule Engine (O08)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Chế độ tra cứu chuẩn dành cho Cán bộ đối chiếu khi xét duyệt hoặc xử lý giải trình.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600" />
          <span>Quy tắc Rule Engine đang kích hoạt (Automated Constraints)</span>
        </h2>

        <div className="space-y-3">
          {sampleRules.map((r, i) => (
            <div key={i} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{r.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  {r.status}
                </span>
              </div>
              <div className="font-mono text-[11px] text-sky-800">{r.code}</div>
              <p className="text-slate-600">{r.logic}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
