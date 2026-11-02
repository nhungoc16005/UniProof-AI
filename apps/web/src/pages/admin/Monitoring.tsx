import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiJobs } from '../../components/AiJobs';
import { AuditLogs } from './AuditLogs';
import { SystemHealth } from './SystemHealth';
import { ShieldCheck, Activity } from 'lucide-react';

export const Monitoring: React.FC = () => {
  const [params,setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'audit';
  const setActiveTab = (tab: string) => setParams(p => { const n=new URLSearchParams(p); n.set('tab',tab); return n; });

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

      <button onClick={() => setActiveTab('jobs')} className={'rounded-lg border px-4 py-2 text-sm ' + (activeTab === 'jobs' ? 'bg-blue-50 text-blue-700' : '')}>Job AI</button>
      {/* Tab Content */}
      {activeTab === 'audit' && <AuditLogs />}
      {activeTab === 'health' && <SystemHealth />}
      {activeTab === 'jobs' && <AiJobs />}
    </div>
  );
};
