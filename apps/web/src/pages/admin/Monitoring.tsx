import React, { useState } from 'react';
import { AuditLogs } from './AuditLogs';
import { SystemHealth } from './SystemHealth';
import { ShieldCheck, Activity } from 'lucide-react';

export const Monitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'health'>('audit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Giám sát & nhật ký</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Theo dõi lịch sử xử lý, kết nối dữ liệu và trạng thái dịch vụ.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'audit'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Nhật ký xử lý</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'health'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Trạng thái dịch vụ</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'audit' && <AuditLogs />}
      {activeTab === 'health' && <SystemHealth />}
    </div>
  );
};
