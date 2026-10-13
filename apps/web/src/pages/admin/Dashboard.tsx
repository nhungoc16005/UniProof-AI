import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
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
  ArrowRight,
  RefreshCw,
  Clock
} from 'lucide-react';

interface FacultyStat {
  id: string;
  code: string;
  name: string;
  totalStudents: number;
  submittedCount: number;
  approvedCount: number;
  approvedRate: string;
  status: string;
}

export const AdminDashboard: React.FC = () => {
  const { activeTerm } = useAuth();
  const [facultyStats, setFacultyStats] = useState<FacultyStat[]>([]);
  const [kpiData, setKpiData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [faculties, kpi, health] = await Promise.all([
        apiClient.getFacultyReports(activeTerm?.id),
        apiClient.getKpiSummary(activeTerm?.id),
        apiClient.getSystemHealth(),
      ]);
      setFacultyStats(faculties || []);
      setKpiData(kpi);
      setHealthData(health);
    } catch (err) {
      console.error('Lỗi tải dữ liệu bảng điều hành:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeTerm?.id]);

  const totalStudents = kpiData?.totalStudents ?? facultyStats.reduce((sum, f) => sum + f.totalStudents, 0);
  const totalEvidences = kpiData?.totalEvidences ?? facultyStats.reduce((sum, f) => sum + f.submittedCount, 0);
  const approvedEvidences = kpiData?.approvedEvidences ?? facultyStats.reduce((sum, f) => sum + f.approvedCount, 0);
  const reviewRate = kpiData?.reviewRate ?? (totalEvidences > 0 ? Math.round((approvedEvidences / totalEvidences) * 100) : 0);
  const isDbHealthy = healthData?.database === 'UP';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            Phòng Công tác Sinh viên (Cấp Trường)
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Trung tâm Điều hành Toàn trường
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Học kỳ: <strong className="text-slate-800 font-semibold">{activeTerm?.name || 'Đang diễn ra'}</strong> · Giám sát tiến độ đánh giá điểm rèn luyện trực tiếp từ Real Database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition inline-flex items-center gap-1.5"
            title="Tải lại số liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <Link
            to="/admin/terms"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            Quản lý Kỳ & Khoa
          </Link>
          <Link
            to="/admin/monitoring"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
          >
            Nhật ký kiểm toán
          </Link>
        </div>
      </div>

      {/* 2. Cockpit KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tổng số sinh viên toàn trường</span>
          <span className="text-3xl font-black text-slate-900 block">
            {isLoading ? '...' : totalStudents.toLocaleString('vi-VN')}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Tài khoản sinh viên chính thức</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tổng minh chứng đã nộp</span>
          <span className="text-3xl font-black text-blue-600 block">
            {isLoading ? '...' : totalEvidences.toLocaleString('vi-VN')}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">
            {reviewRate}% đã được Cán bộ xem xét
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tổng số Khoa / Viện</span>
          <span className="text-3xl font-black text-indigo-600 block">
            {isLoading ? '...' : facultyStats.length}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Đơn vị quản lý cơ sở</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Trạng thái Cơ sở Dữ liệu</span>
          <span className={`text-3xl font-black block ${isDbHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isDbHealthy ? 'Kết nối tốt' : 'Mất kết nối'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            PostgreSQL Real Database (Ping OK)
          </span>
        </div>
      </div>

      {/* 3. Breakdown by Faculty (Real Data Table) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tiến độ đánh giá theo Khoa / Viện
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Số liệu thống kê thực tế tính theo sinh viên và hồ sơ nộp trong học kỳ {activeTerm?.name || 'hiện tại'}.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            {facultyStats.length} đơn vị
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Khoa / Đơn vị</th>
                <th className="py-3 px-4">Số lượng sinh viên</th>
                <th className="py-3 px-4">Hồ sơ đã nộp</th>
                <th className="py-3 px-4">Tỷ lệ Cán bộ đã duyệt</th>
                <th className="py-3 px-4 text-right">Trạng thái tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Đang tải tiến độ từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : facultyStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Chưa có dữ liệu Khoa nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                facultyStats.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Mã: {f.code}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {f.totalStudents.toLocaleString('vi-VN')} sinh viên
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <strong className="text-slate-900">{f.submittedCount}</strong> hồ sơ
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all" 
                            style={{ width: f.approvedRate }} 
                          />
                        </div>
                        <span className="font-bold text-slate-800">{f.approvedRate}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          f.status === 'Đúng tiến độ'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : f.status === 'Cần đẩy nhanh'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
