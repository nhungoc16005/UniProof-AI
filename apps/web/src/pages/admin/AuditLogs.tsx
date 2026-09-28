import React, { useState } from 'react';
import { Shield, Search, Filter, Lock, Eye, FileCode, CheckCircle2, X } from 'lucide-react';

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
      hashSignature: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      diffPayload: {
        before: { status: 'NEEDS_HUMAN_REVIEW', finalScore: null, reviewerId: null },
        after: { status: 'APPROVED', finalScore: 5.0, reviewerId: 'usr-staff-01', ruleId: 'RULE_HACKATHON_PRIZE' },
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0',
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
      hashSignature: 'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      diffPayload: {
        before: { maxCap: 10.0, version: 'v1.0' },
        after: { maxCap: 5.0, version: 'v2.0', updatedBy: 'usr-admin-01' },
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.0',
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
      hashSignature: 'sha256:ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      diffPayload: {
        before: { status: 'NEEDS_HUMAN_REVIEW' },
        after: { status: 'NEEDS_SUPPLEMENT', missingItem: 'Thẻ đeo đại biểu hoặc Email BTC', deadline: '2026-10-25' },
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0',
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
      hashSignature: 'sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      diffPayload: {
        before: { lastLoginAt: '2026-09-26 19:40:11' },
        after: { lastLoginAt: '2026-09-27 08:00:10', authMethod: 'PASSWORD' },
      },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    },
  ]);

  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  return (
    <div className="space-y-6 pb-12">
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
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.map((l) => (
                <tr 
                  key={l.id} 
                  onClick={() => setSelectedLog(l)}
                  className="hover:bg-slate-50/80 transition cursor-pointer"
                >
                  <td className="py-3.5 px-4 text-slate-500 font-sans">{l.time}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">{l.user}</td>
                  <td className="py-3.5 px-4">
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
                  <td className="py-3.5 px-4 text-slate-700 font-sans">
                    {l.entityType} ({l.entityId})
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 font-sans max-w-sm truncate" title={l.details}>
                    {l.details}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{l.ip}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="p-1 text-slate-400 hover:text-sky-600 transition">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail & Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Chi Tiết Bản Ghi Kiểm Toán (Audit Payload Diff)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Bản ghi toàn vẹn ID: {selectedLog.id}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Người thực hiện:</span>
                  <strong className="text-slate-900">{selectedLog.user}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Thời gian ghi nhận:</span>
                  <span className="font-mono text-slate-700">{selectedLog.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Địa chỉ IP & Thiết bị:</span>
                  <span className="font-mono text-slate-700">{selectedLog.ip}</span>
                </div>
              </div>

              {/* Hash Chain Integrity */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chữ ký số toàn vẹn (Cryptographic Hash Signature)</span>
                </div>
                <p className="font-mono text-[10px] text-emerald-800 break-all bg-white/80 p-1.5 rounded border border-emerald-200">
                  {selectedLog.hashSignature}
                </p>
              </div>

              {/* JSON Diff Payload */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5 text-sky-600" />
                  <span>Dữ liệu biến động (Payload Before vs After):</span>
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-rose-800 font-bold block mb-1">BEFORE:</span>
                    <pre className="text-rose-950 whitespace-pre-wrap">{JSON.stringify(selectedLog.diffPayload.before, null, 2)}</pre>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-emerald-800 font-bold block mb-1">AFTER:</span>
                    <pre className="text-emerald-950 whitespace-pre-wrap">{JSON.stringify(selectedLog.diffPayload.after, null, 2)}</pre>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">User-Agent:</span>
                <span className="font-mono text-[10px] text-slate-500">{selectedLog.userAgent}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl"
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
