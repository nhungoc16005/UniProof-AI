import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, Server, HardDrive, Cpu, Database, Clock } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  const loadHealth = async () => {
    try {
      setIsRefreshing(true);
      const data = await apiClient.getSystemHealth();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.error('Lỗi khi kiểm tra sức khỏe hệ thống:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const isDbHealthy = healthData?.database === 'UP';
  const uptimeMinutes = healthData?.uptimeSeconds ? Math.floor(healthData.uptimeSeconds / 60) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Giám sát Hạ tầng & Sức khỏe Hệ thống (A11)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trạng thái kết nối thời gian thực của NestJS API, PostgreSQL Database và các tiến trình nền.
          </p>
        </div>

        <button
          onClick={loadHealth}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Kiểm tra kết nối</span>
        </button>
      </div>

      {/* 2. Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cơ sở Dữ liệu PostgreSQL</span>
          <span className={`text-2xl font-black block ${isDbHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isDbHealthy ? 'Đang hoạt động (UP)' : 'Mất kết nối (DOWN)'}
          </span>
          <span className="text-[11px] text-slate-400">PostgreSQL / Supabase Real Database</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Thời gian hoạt động (Uptime)</span>
          <span className="text-2xl font-black text-slate-900 block">
            {uptimeMinutes} phút
          </span>
          <span className="text-[11px] text-slate-400">Tiến trình Node.js Server</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Lần kiểm tra gần nhất</span>
          <span className="text-2xl font-black text-blue-600 block">
            {lastChecked || 'Chưa kiểm tra'}
          </span>
          <span className="text-[11px] text-slate-400">Ping trực tiếp `/api/health`</span>
        </div>
      </div>

      {/* 3. Real Service Nodes Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Chi tiết các thành phần hệ thống
          </span>
          <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Hạ tầng chính hoạt động bình thường
          </span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-600" />
              <div>
                <span className="font-bold text-slate-900 block">Cơ sở dữ liệu PostgreSQL (Prisma ORM)</span>
                <span className="text-[11px] text-slate-500">Lưu trữ toàn bộ người dùng, minh chứng, điểm rèn luyện</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {healthData?.database === 'UP' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-indigo-600" />
              <div>
                <span className="font-bold text-slate-900 block">Backend REST API Service (NestJS)</span>
                <span className="text-[11px] text-slate-500">Xử lý nghiệp vụ phân quyền, chấm điểm, giải quyết khiếu nại</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ONLINE
            </span>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-slate-600" />
              <div>
                <span className="font-bold text-slate-900 block">AI Rule Engine & Verification Module</span>
                <span className="text-[11px] text-slate-500">{healthData?.aiService || 'Chế độ đối chiếu quy chế tự động'}</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              READY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
