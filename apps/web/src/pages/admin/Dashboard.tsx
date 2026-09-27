import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Calendar, 
  ShieldCheck, 
  Cpu, 
  Database, 
  AlertCircle, 
  CheckCircle2,
  Building,
  ArrowRight
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const facultyStats = [
    { name: 'Khoa Công nghệ Thông tin', students: 1250, submitted: 1180, approvedRate: '94.2%', status: 'Đúng tiến độ' },
    { name: 'Khoa Điện - Điện tử', students: 1420, submitted: 1310, approvedRate: '88.5%', status: 'Đúng tiến độ' },
    { name: 'Khoa Cơ khí', students: 1600, submitted: 1420, approvedRate: '79.1%', status: 'Cần đẩy nhanh' },
    { name: 'Khoa Xây dựng', students: 950, submitted: 890, approvedRate: '91.0%', status: 'Đúng tiến độ' },
    { name: 'Khoa Hóa', students: 820, submitted: 780, approvedRate: '92.3%', status: 'Đúng tiến độ' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block mb-1">
            Phòng Công tác Sinh viên (Cấp Trường)
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Trung tâm Điều hành Toàn trường (A01)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Giám sát tiến độ đánh giá điểm rèn luyện của tất cả các Khoa trong Học kỳ 1 (2026-2027).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/terms"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
          >
            Quản lý Kỳ & Khoa
          </Link>
          <Link
            to="/admin/audit-logs"
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            Xem Audit Log
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Tổng số sinh viên toàn trường</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1 block">6,040</span>
          <span className="text-[11px] text-emerald-600 font-medium">92.4% đã nộp minh chứng</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Tổng hồ sơ đã xử lý</span>
          <span className="text-3xl font-extrabold text-sky-600 mt-1 block">18,420</span>
          <span className="text-[11px] text-slate-400">Tự động đối chiếu AI: 76.5%</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Cán bộ tham gia xét duyệt</span>
          <span className="text-3xl font-extrabold text-indigo-600 mt-1 block">48</span>
          <span className="text-[11px] text-slate-400">Trên 14 Khoa / Viện</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Sức khỏe hệ thống AI & Worker</span>
          <span className="text-3xl font-extrabold text-emerald-600 mt-1 block">100%</span>
          <span className="text-[11px] text-emerald-700 font-medium">Đang hoạt động ổn định</span>
        </div>
      </div>

      {/* Breakdown by Faculty */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Tiến độ đánh giá theo Khoa / Viện
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Khoa / Đơn vị</th>
                <th className="py-3 px-4">Số lượng sinh viên</th>
                <th className="py-3 px-4">Đã nộp minh chứng</th>
                <th className="py-3 px-4">Tỷ lệ Cán bộ đã duyệt</th>
                <th className="py-3 px-4">Tình trạng</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facultyStats.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{f.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{f.students.toLocaleString('vi-VN')}</td>
                  <td className="py-3.5 px-4 text-slate-600">{f.submitted.toLocaleString('vi-VN')}</td>
                  <td className="py-3.5 px-4 font-bold text-sky-700">{f.approvedRate}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        f.status === 'Đúng tiến độ'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to="/officer/queue"
                      className="text-sky-600 hover:underline font-semibold"
                    >
                      Xem hàng đợi Khoa
                    </Link>
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
