import React, { useState } from 'react';
import { Shield, Search, Filter, Lock, Eye } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState([
    {
      id: 'log-001',
      user: 'ThS. Trần Thị Mai (Cán bộ Khoa CNTT)',
      action: 'APPROVE',
      entityType: 'Evidence',
      entityId: 'evd-001',
      details: 'Duyệt hồ sơ Danang TechHack 2026: +5.0 điểm vào Tiêu chí 1.2',
      ip: '10.20.4.15',
      time: '2026-09-18 14:20:15',
    },
    {
      id: 'log-002',
      user: 'TS. Lê Hoàng Nam (Quản trị viên)',
      action: 'EDIT_RULE',
      entityType: 'Rule',
      entityId: 'RULE_CAP_CHEERLEADER',
      details: 'Cập nhật phiên bản Rule v2: Khống chế trần điểm cổ vũ tối đa 5.0đ/kỳ',
      ip: '10.20.1.2',
      time: '2026-09-15 09:12:00',
    },
    {
      id: 'log-003',
      user: 'ThS. Trần Thị Mai (Cán bộ Khoa CNTT)',
      action: 'SUPPLEMENT_REQUEST',
      entityType: 'Evidence',
      entityId: 'evd-003',
      details: 'Yêu cầu sinh viên Nguyễn Văn An bổ sung thẻ đeo hoặc email VNISA',
      ip: '10.20.4.15',
      time: '2026-09-28 16:00:32',
    },
    {
      id: 'log-004',
      user: 'Nguyễn Văn An (Sinh viên)',
      action: 'LOGIN',
      entityType: 'User',
      entityId: 'usr-student-01',
      details: 'Đăng nhập thành công từ thiết bị di động',
      ip: '113.161.42.10',
      time: '2026-09-27 08:00:10',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhật ký Kiểm toán Toàn hệ thống — Audit Log (A10)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bản ghi bất biến (Append-only & Hash-chain) lưu lại mọi hành động thay đổi dữ liệu và quyết định chấm điểm.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Bảo mật chống can thiệp</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng (Entity)</th>
                <th className="py-3 px-4">Chi tiết thao tác</th>
                <th className="py-3 px-4 text-right">Địa chỉ IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 text-slate-500 font-sans">{l.time}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 font-sans">{l.user}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.action === 'APPROVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.action === 'EDIT_RULE'
                          ? 'bg-purple-100 text-purple-800'
                          : l.action === 'SUPPLEMENT_REQUEST'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {l.entityType} ({l.entityId})
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-sans max-w-sm truncate" title={l.details}>
                    {l.details}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
