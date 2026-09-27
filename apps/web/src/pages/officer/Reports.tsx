import React from 'react';
import { BarChart3, FileSpreadsheet, Download, Filter, CheckCircle2 } from 'lucide-react';

export const OfficerReports: React.FC = () => {
  const classesStats = [
    { class: '21TCLC_DT1', total: 45, submitted: 43, avgScore: 84.2, excellent: 12, good: 28, fair: 3 },
    { class: '21TCLC_DT2', total: 48, submitted: 46, avgScore: 82.8, excellent: 10, good: 31, fair: 5 },
    { class: '22T_DT1', total: 52, submitted: 50, avgScore: 79.5, excellent: 8, good: 34, fair: 8 },
    { class: '22T_DT2', total: 50, submitted: 47, avgScore: 81.0, excellent: 9, good: 32, fair: 6 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Báo cáo & Thống kê điểm rèn luyện (O10)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp kết quả đánh giá điểm rèn luyện cấp Khoa và trích xuất bảng điểm Excel.
          </p>
        </div>

        <button
          onClick={() => alert('Đang tạo và tải xuống file Excel: Bang_Diem_Ren_Luyen_Khoa_CNTT_HK1_2026.xlsx')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Xuất Báo cáo Excel theo mẫu trường</span>
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-slate-500 text-xs font-semibold uppercase block">Tỷ lệ sinh viên nộp minh chứng</span>
          <span className="text-3xl font-extrabold text-sky-600 mt-1 block">96.8%</span>
          <span className="text-[11px] text-slate-400 mt-1 block">186 / 195 sinh viên đã nộp</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-slate-500 text-xs font-semibold uppercase block">Điểm trung bình toàn khoa</span>
          <span className="text-3xl font-extrabold text-emerald-600 mt-1 block">81.9 đ</span>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">Xếp loại trung bình: Loại Tốt</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-slate-500 text-xs font-semibold uppercase block">Tiến độ duyệt của Cán bộ</span>
          <span className="text-3xl font-extrabold text-indigo-600 mt-1 block">91.4%</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Chỉ còn 16 hồ sơ chờ đối chiếu</span>
        </div>
      </div>

      {/* Breakdown by Class */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Thống kê theo từng Lớp sinh hoạt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Lớp sinh hoạt</th>
                <th className="py-3 px-4">Sĩ số</th>
                <th className="py-3 px-4">Đã nộp</th>
                <th className="py-3 px-4">Điểm trung bình</th>
                <th className="py-3 px-4">Xuất sắc (≥90)</th>
                <th className="py-3 px-4">Tốt (80 - 89)</th>
                <th className="py-3 px-4">Khá (65 - 79)</th>
                <th className="py-3 px-4 text-right">Tải file lớp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classesStats.map((c) => (
                <tr key={c.class} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{c.class}</td>
                  <td className="py-3.5 px-4 text-slate-600">{c.total}</td>
                  <td className="py-3.5 px-4 text-slate-600">{c.submitted}</td>
                  <td className="py-3.5 px-4 font-bold text-sky-700">{c.avgScore} đ</td>
                  <td className="py-3.5 px-4 text-emerald-700 font-semibold">{c.excellent}</td>
                  <td className="py-3.5 px-4 text-sky-700 font-semibold">{c.good}</td>
                  <td className="py-3.5 px-4 text-slate-600">{c.fair}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => alert(`Xuất bảng điểm lớp ${c.class}`)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                      title="Tải bảng điểm lớp"
                    >
                      <Download className="w-4 h-4" />
                    </button>
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
