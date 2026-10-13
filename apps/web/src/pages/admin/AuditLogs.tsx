import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Shield, Search, Filter, Lock, Eye, FileCode, CheckCircle2, X, RefreshCw, Clock, Globe } from 'lucide-react';

interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: any;
  newValue: any;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterEntityType, setFilterEntityType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.getAuditLogs({
        action: filterAction !== 'ALL' ? filterAction : undefined,
        entityType: filterEntityType !== 'ALL' ? filterEntityType : undefined,
        page,
        pageSize,
      });
      setLogs(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('Lỗi khi tải audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filterAction, filterEntityType, page]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchUser = log.user?.fullName.toLowerCase().includes(q) || log.user?.email.toLowerCase().includes(q);
    const matchEntity = log.entityType.toLowerCase().includes(q) || log.entityId.toLowerCase().includes(q);
    const matchIp = log.ipAddress?.toLowerCase().includes(q);
    return matchUser || matchEntity || matchIp;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhật ký Kiểm toán & Truy vết Hệ thống (A10)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ghi nhận toàn bộ thao tác phê duyệt, chỉnh sửa điểm, đổi mật khẩu và cập nhật quy chế từ Real Database.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 2. Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="APPROVE">Phê duyệt (APPROVE)</option>
            <option value="REJECT">Từ chối (REJECT)</option>
            <option value="OVERRIDE_SCORE">Sửa điểm (OVERRIDE_SCORE)</option>
            <option value="LOGIN">Đăng nhập (LOGIN)</option>
            <option value="EDIT_RULE">Sửa quy tắc (EDIT_RULE)</option>
          </select>

          {/* Entity Filter */}
          <select
            value={filterEntityType}
            onChange={(e) => {
              setFilterEntityType(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả đối tượng</option>
            <option value="Evidence">Hồ sơ minh chứng (Evidence)</option>
            <option value="Review">Đánh giá (Review)</option>
            <option value="User">Người dùng (User)</option>
            <option value="Criterion">Tiêu chí (Criterion)</option>
            <option value="Term">Học kỳ (Term)</option>
          </select>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo người thực hiện, IP, ID..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* 3. Audit Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành vi</th>
                <th className="py-3 px-4">Đối tượng</th>
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Không có bản ghi nhật ký kiểm toán nào.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">
                        {log.user?.fullName || 'Hệ thống'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {log.user?.email || `User ID: ${log.userId.slice(0, 8)}...`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          log.action === 'APPROVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.action === 'REJECT'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.action === 'LOGIN'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{log.entityType}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.entityId ? `ID: ${log.entityId.slice(0, 8)}...` : '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition"
                      >
                        Xem JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Chi tiết JSON Diff */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Chi tiết Bản ghi Kiểm toán ({selectedLog.action})
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] block">Người thực hiện:</span>
                  <span className="font-bold text-slate-800">{selectedLog.user?.fullName || selectedLog.userId}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Thời gian:</span>
                  <span className="font-mono text-slate-700">{new Date(selectedLog.createdAt).toLocaleString('vi-VN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Hành vi:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Đối tượng:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.entityType} ({selectedLog.entityId})</span>
                </div>
              </div>

              {selectedLog.oldValue && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Dữ liệu trước thay đổi (Old Value):</span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Dữ liệu mới cập nhật (New Value):</span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
