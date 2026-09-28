import React, { useState } from 'react';

export const AppealsResolution: React.FC = () => {
  const [appeals, setAppeals] = useState([
    {
      id: 'apl-001',
      evidenceId: 'evd-003',
      studentName: 'Nguyễn Văn An',
      studentCode: '102210001',
      class: '21TCLC_DT1',
      activityName: 'Hội thảo An toàn thông tin VNISA 2026',
      content: 'Em đã tham dự đầy đủ cả ngày và có bổ sung thẻ đeo đại biểu. Mong Thầy/Cô xem xét lại điểm tiêu chí 1.2.',
      status: 'PENDING',
      requestedScore: 4.0,
      submittedAt: '2026-09-29T08:30:00Z',
    },
  ]);

  const [selectedAppeal, setSelectedAppeal] = useState<any | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [newScore, setNewScore] = useState(4.0);

  const handleResolve = (action: 'ACCEPTED' | 'REJECTED') => {
    if (!decisionNote.trim()) {
      alert('Vui lòng nhập lý do giải quyết khiếu nại!');
      return;
    }

    setAppeals((prev) =>
      prev.map((a) =>
        a.id === selectedAppeal.id
          ? { ...a, status: action, resolutionNote: decisionNote, adjustedScore: action === 'ACCEPTED' ? newScore : undefined }
          : a
      )
    );
    setSelectedAppeal(null);
    setDecisionNote('');
    alert(`Đã xử lý xong khiếu nại: ${action === 'ACCEPTED' ? 'Chấp thuận' : 'Bác bỏ'}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Xử lý khiếu nại điểm sinh viên</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Xem xét giải trình của sinh viên và quyết định cập nhật điểm hoặc bảo lưu kết quả.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Sinh viên</th>
                <th className="py-3 px-4">Hoạt động khiếu nại</th>
                <th className="py-3 px-4">Nội dung giải trình</th>
                <th className="py-3 px-4">Điểm mong muốn</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appeals.map((apl) => (
                <tr key={apl.id} className="hover:bg-blue-50/20 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{apl.studentName}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{apl.studentCode} · {apl.class}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {apl.activityName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate" title={apl.content}>
                    {apl.content}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-blue-700">
                    +{apl.requestedScore} đ
                  </td>
                  <td className="py-3.5 px-4">
                    {apl.status === 'PENDING' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Chờ xử lý
                      </span>
                    ) : apl.status === 'ACCEPTED' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Đã chấp thuận
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                        Đã bác bỏ
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {apl.status === 'PENDING' && (
                      <button
                        onClick={() => setSelectedAppeal(apl)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition text-xs"
                      >
                        Giải quyết
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Xử lý Khiếu nại */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Xử lý đơn khiếu nại</h3>
              <button onClick={() => setSelectedAppeal(null)}>✕</button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div>Sinh viên: <strong>{selectedAppeal.studentName}</strong> ({selectedAppeal.studentCode})</div>
              <div>Hoạt động: <strong>{selectedAppeal.activityName}</strong></div>
              <div>Giải trình: <em>"{selectedAppeal.content}"</em></div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Điểm sau khi giải quyết:</label>
                <input
                  type="number"
                  step="0.5"
                  value={newScore}
                  onChange={(e) => setNewScore(parseFloat(e.target.value) || 0)}
                  className="w-24 p-1.5 border rounded font-bold text-center"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kết luận & Căn cứ gửi sinh viên:
                </label>
                <textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Ghi rõ lý do chấp thuận hoặc bác khiếu nại..."
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => handleResolve('REJECTED')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-xs"
              >
                Bác khiếu nại
              </button>
              <button
                type="button"
                onClick={() => handleResolve('ACCEPTED')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs"
              >
                Chấp thuận & Cập nhật điểm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
