import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Activity, RefreshCw, Database, Server, Cpu } from 'lucide-react';

interface HealthData {
  status: string;
  database: string;
  aiService?: string;
  uptimeSeconds?: number;
  timestamp?: string;
}

export const SystemHealth: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadHealth = async () => {
    setIsRefreshing(true);
    setLoadError('');
    try {
      setHealthData(await apiClient.getSystemHealth());
    } catch {
      setHealthData(null);
      setLoadError('Không thể lấy trạng thái hệ thống từ Backend.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadHealth(); }, []);

  const checkedAt = healthData?.timestamp
    ? new Date(healthData.timestamp).toLocaleString('vi-VN')
    : 'Chưa có dữ liệu';
  const uptimeMinutes = healthData?.uptimeSeconds == null
    ? null
    : Math.floor(healthData.uptimeSeconds / 60);

  const statusLabel = (value?: string) => {
    if (value === 'UP' || value === 'healthy') return 'Đang hoạt động';
    if (value === 'NOT_CONFIGURED') return 'Chưa cấu hình · xử lý thủ công';
    if (value === 'CONFIGURED_NOT_CHECKED') return 'Đã cấu hình · chưa kiểm tra kết nối';
    if (value === 'DOWN' || value === 'unhealthy') return 'Không khả dụng';
    return value || 'Chưa có dữ liệu';
  };

  const Status = ({ value }: { value?: string }) => (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
      value === 'UP' || value === 'healthy'
        ? 'bg-emerald-50 text-emerald-700'
        : value
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-600'
      }`}>{statusLabel(value)}</span>
  );

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Theo dõi hệ thống</h1>
          <p className="mt-1 text-sm text-slate-500">Trạng thái được lấy từ API kiểm tra sức khỏe của Backend.</p>
        </div>
        <button onClick={loadHealth} disabled={isRefreshing} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </header>

      {loadError && <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{loadError}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="bg-white border border-slate-200 rounded-xl p-5">
          <Database className="w-5 h-5 text-blue-700" />
          <p className="mt-3 text-xs text-slate-500">Cơ sở dữ liệu</p>
          <div className="mt-2"><Status value={healthData?.database} /></div>
        </article>
        <article className="bg-white border border-slate-200 rounded-xl p-5">
          <Server className="w-5 h-5 text-indigo-700" />
          <p className="mt-3 text-xs text-slate-500">Backend API</p>
          <div className="mt-2"><Status value={healthData?.status} /></div>
        </article>
        <article className="bg-white border border-slate-200 rounded-xl p-5">
          <Cpu className="w-5 h-5 text-slate-700" />
          <p className="mt-3 text-xs text-slate-500">Dịch vụ AI</p>
          <div className="mt-2"><Status value={healthData?.aiService} /></div>
        </article>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="w-4 h-4" /> Thông tin lần kiểm tra gần nhất</div>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500">Thời điểm</dt><dd className="mt-1 font-medium">{checkedAt}</dd></div>
          <div><dt className="text-slate-500">Thời gian hoạt động</dt><dd className="mt-1 font-medium">{uptimeMinutes == null ? 'Chưa có dữ liệu' : `${uptimeMinutes} phút`}</dd></div>
        </dl>
      </section>
    </div>
  );
};
