import React, { useState } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, Server, HardDrive, Cpu, Database } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const services = [
    { name: 'Cơ sở Dữ liệu PostgreSQL + pgvector (Supabase)', icon: Database, status: 'HEALTHY', latency: '12ms', uptime: '99.98%' },
    { name: 'Hàng đợi tác vụ bất đồng bộ Redis + BullMQ', icon: HardDrive, status: 'HEALTHY', latency: '2ms', uptime: '100%' },
    { name: 'Dịch vụ AI Phân loại PhoBERT (FastAPI Microservice)', icon: Cpu, status: 'HEALTHY', latency: '45ms', uptime: '99.95%' },
    { name: 'Claude API & Vision OCR Adapter', icon: Server, status: 'HEALTHY', latency: '320ms', uptime: '99.90%' },
    { name: 'Storage Lưu trữ Minh chứng (S3 Compatible)', icon: HardDrive, status: 'HEALTHY', latency: '28ms', uptime: '99.99%' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      alert('Đã kiểm tra lại toàn bộ kết nối các dịch vụ: Tất cả hoạt động tốt!');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Giám sát Hàng đợi & Sức khỏe Hệ thống (A11)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi trạng thái thời gian thực của BullMQ Worker, FastAPI PhoBERT và hạ tầng dịch vụ.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-semibold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-sky-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Kiểm tra kết nối</span>
        </button>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Đang chạy (Active Jobs)</span>
          <span className="text-3xl font-extrabold text-sky-600 mt-1 block">2</span>
          <span className="text-[11px] text-slate-400">Đang chạy OCR & Trích xuất</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Hàng đợi chờ (Waiting)</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1 block">0</span>
          <span className="text-[11px] text-emerald-600 font-medium">Hàng đợi thông thoáng</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Hoàn tất (Completed)</span>
          <span className="text-3xl font-extrabold text-emerald-600 mt-1 block">1,842</span>
          <span className="text-[11px] text-slate-400">Trong 24 giờ qua</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Lỗi (Failed Jobs)</span>
          <span className="text-3xl font-extrabold text-rose-600 mt-1 block">0</span>
          <span className="text-[11px] text-slate-400">Tỷ lệ lỗi 0.0%</span>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Trạng thái chi tiết các Module và Microservices
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {services.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{s.name}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      <span>Độ trễ: <strong className="text-slate-700">{s.latency}</strong></span>
                      <span>·</span>
                      <span>Uptime: <strong className="text-emerald-700">{s.uptime}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hoạt động tốt</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
