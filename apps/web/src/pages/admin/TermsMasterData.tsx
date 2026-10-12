import React, { useState, useEffect } from 'react';
import { Term } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Plus, Lock, AlertTriangle, Building } from 'lucide-react';

export const TermsMasterData: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TERMS' | 'FACULTIES' | 'CLASSES'>('TERMS');

  const loadTerms = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getTerms();
      setTerms(data);
    } catch (err) {
      console.error('Lỗi tải danh sách học kỳ', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  const handleToggleCloseTerm = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'ACTIVE') {
        await apiClient.closeTerm(id);
      } else {
        await apiClient.updateTerm(id, { status: 'ACTIVE' });
      }
      await loadTerms();
    } catch (err) {
      console.error('Lỗi đổi trạng thái học kỳ', err);
      alert('Không thể cập nhật trạng thái học kỳ.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dữ liệu nền & Kỳ đánh giá (A03)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình thời hạn nộp, xét duyệt, khiếu nại và chốt sổ điểm chính thức từng học kỳ.
          </p>
        </div>

        <button
          onClick={() => alert('Mở form tạo Kỳ đánh giá mới')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo kỳ đánh giá mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('TERMS')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'TERMS'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Kỳ đánh giá học kỳ
        </button>
        <button
          onClick={() => setActiveTab('FACULTIES')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'FACULTIES'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Danh mục Khoa / Viện
        </button>
        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'CLASSES'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Danh mục Lớp sinh hoạt
        </button>
      </div>

      {activeTab === 'TERMS' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-0.5">Chính sách chốt kỳ (TERM_CLOSED):</strong>
              Khi chuyển trạng thái sang <strong>CLOSED</strong>, toàn bộ hệ thống sẽ tự động khóa chức năng nộp minh chứng của sinh viên và cố định điểm rèn luyện chính thức của học kỳ đó.
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="text-center py-10 text-xs text-slate-400">Đang tải danh sách học kỳ...</div>
            ) : terms.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">Chưa có học kỳ nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Tên kỳ đánh giá</th>
                      <th className="py-3 px-4">Mã kỳ</th>
                      <th className="py-3 px-4">Hạn nộp của SV</th>
                      <th className="py-3 px-4">Hạn duyệt Cán bộ</th>
                      <th className="py-3 px-4">Hạn khiếu nại</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {terms.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{t.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{t.code}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.submissionDeadline ? new Date(t.submissionDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.reviewDeadline ? new Date(t.reviewDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {t.appealDeadline ? new Date(t.appealDeadline).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {t.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Đang mở nhận bài (ACTIVE)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                              <Lock className="w-3 h-3 text-slate-500" />
                              <span>Đã chốt sổ (CLOSED)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleToggleCloseTerm(t.id, t.status)}
                            className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition ${
                              t.status === 'ACTIVE'
                                ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {t.status === 'ACTIVE' ? 'Chốt kỳ' : 'Mở lại kỳ'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'FACULTIES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs space-y-3">
          <span className="font-bold text-slate-800 text-sm">Danh sách các Khoa thuộc Trường</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {['Khoa Công nghệ Thông tin (CNTT)', 'Khoa Điện - Điện tử (DDT)', 'Khoa Cơ khí (CK)', 'Khoa Xây dựng (XD)', 'Khoa Hóa (H)'].map((f, i) => (
              <div key={i} className="p-3 bg-slate-50 border rounded-lg font-medium text-slate-800 flex items-center gap-2">
                <Building className="w-4 h-4 text-sky-600" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'CLASSES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs space-y-3">
          <span className="font-bold text-slate-800 text-sm">Danh sách Lớp sinh hoạt mẫu</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {['21TCLC_DT1', '21TCLC_DT2', '22T_DT1', '22T_DT2', '23T_DT1'].map((c, i) => (
              <div key={i} className="p-3 bg-slate-50 border rounded-lg font-mono font-bold text-slate-800">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
