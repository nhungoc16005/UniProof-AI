import React, { useState } from 'react';
import { Database, Plus, CheckCircle, Search, Tag, FileText } from 'lucide-react';

export const GroundTruth: React.FC = () => {
  const [samples, setSamples] = useState([
    {
      id: 'gt-01',
      activityText: 'Đạt Giải Nhất Cuộc thi Lập trình Hackathon Bách Khoa 2026',
      trueCriterion: '1.2 (Nghiên cứu & Sáng tạo học thuật)',
      trueScore: 5.0,
      source: 'Xác thực thủ công bởi Trưởng Khoa',
      verifiedDate: '2026-09-10',
    },
    {
      id: 'gt-02',
      activityText: 'Tham gia Ngày hội Chủ nhật Đỏ hiến máu tình nguyện tại Khu F',
      trueCriterion: '3.2 (Hoạt động tình nguyện vì cộng đồng)',
      trueScore: 5.0,
      source: 'Đối chiếu danh sách Đoàn trường',
      verifiedDate: '2026-09-12',
    },
    {
      id: 'gt-03',
      activityText: 'Cổ vũ trận chung kết giải bóng đá Sinh viên khoa CNTT',
      trueCriterion: '3.1 (Văn hóa, Thể thao - Cổ vũ)',
      trueScore: 2.0,
      source: 'Quy định Rule Cap Cheerleader',
      verifiedDate: '2026-09-15',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Ground Truth Dataset (A08)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tập dữ liệu nhãn vàng đối chứng chuẩn để huấn luyện và đánh giá định kỳ các mô hình PhoBERT / LLM.
          </p>
        </div>

        <button
          onClick={() => alert('Thêm mẫu ground truth mới')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Gán nhãn mẫu mới</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Đoạn text hoạt động mẫu</th>
                <th className="py-3 px-4">Nhãn tiêu chí chuẩn (Ground Truth)</th>
                <th className="py-3 px-4">Điểm chuẩn</th>
                <th className="py-3 px-4">Nguồn thẩm định</th>
                <th className="py-3 px-4 text-right">Ngày xác thực</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 max-w-sm">
                    {s.activityText}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-sky-700">
                    {s.trueCriterion}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700">
                    +{s.trueScore} đ
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{s.source}</td>
                  <td className="py-3.5 px-4 text-right text-slate-400 font-mono">
                    {s.verifiedDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
