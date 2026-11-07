import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuditLogs } from './AuditLogs';
import { SystemHealth } from './SystemHealth';
import { PageHeader } from '../../components/shared/PageHeader';
import { ShieldCheck, Activity } from 'lucide-react';

export const Monitoring: React.FC = () => {
  const [params] = useSearchParams();
  const activeTab = ['audit', 'health'].includes(params.get('tab') || '') ? params.get('tab')! : 'audit';


  return (
    <div className="space-y-6">
      <PageHeader
        title="Giám sát & nhật ký"
      />

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#E8E8EC] [&>a]:shrink-0">
        <Link
          to={'/admin/monitoring?' + new URLSearchParams({ ...(params.get('termId') ? { termId: params.get('termId')! } : {}), tab: 'audit' }).toString()}
          aria-current={activeTab === 'audit' ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'audit'
              ? 'border-[#1D6FC2] text-[#1D6FC2]'
              : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Nhật ký xử lý</span>
        </Link>

        <Link
          to={'/admin/monitoring?' + new URLSearchParams({ ...(params.get('termId') ? { termId: params.get('termId')! } : {}), tab: 'health' }).toString()}
          aria-current={activeTab === 'health' ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'health'
              ? 'border-[#1D6FC2] text-[#1D6FC2]'
              : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Trạng thái dịch vụ</span>
        </Link>

      </div>

      {/* Tab Content */}
      {activeTab === 'audit' && <AuditLogs />}
      {activeTab === 'health' && <SystemHealth />}
    </div>
  );
};
