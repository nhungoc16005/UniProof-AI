import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Criterion } from '../../types';
import { Layers, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

export const CriteriaManager: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [maxScore, setMaxScore] = useState(5.0);
  const [category, setCategory] = useState('KHUNG_I');

  useEffect(() => {
    apiClient.getCriteria().then(setCriteria);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newCrit: Criterion = {
      id: `crit-${Date.now()}`,
      code,
      name,
      description: desc,
      minScore: 0,
      maxScore: Number(maxScore),
      category,
    };
    setCriteria([...criteria, newCrit]);
    setShowAddModal(false);
    setCode('');
    setName('');
    setDesc('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Cấu trúc Tiêu chí Khung I–V (A04)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình danh mục tiêu chí, trần điểm tối đa và điều kiện áp dụng điểm rèn luyện.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm tiêu chí mới</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Mã số</th>
                <th className="py-3 px-4">Tên tiêu chí</th>
                <th className="py-3 px-4">Khung quy định</th>
                <th className="py-3 px-4">Trần điểm (Max)</th>
                <th className="py-3 px-4">Mô tả chi tiết</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-sky-700">{c.code}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {c.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700">
                    +{c.maxScore} đ
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={c.description}>
                    {c.description}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button className="p-1 text-slate-500 hover:text-sky-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 text-slate-500 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Criterion */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Thêm tiêu chí đánh giá mới</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mã tiêu chí (VD: 3.3)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Trần điểm (Max Float)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={maxScore}
                    onChange={(e) => setMaxScore(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Thuộc Khung tiêu chí</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border rounded bg-white"
                >
                  <option value="KHUNG_I">Khung I: Ý thức học tập</option>
                  <option value="KHUNG_II">Khung II: Ý thức chấp hành pháp luật & nội quy</option>
                  <option value="KHUNG_III">Khung III: Hoạt động chính trị - xã hội, văn thể mỹ</option>
                  <option value="KHUNG_IV">Khung IV: Phẩm chất công dân & cộng đồng</option>
                  <option value="KHUNG_V">Khung V: Cán sự lớp & Đoàn - Hội</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên tiêu chí</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Tham gia các hội thảo học thuật chuyên ngành"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mô tả và điều kiện áp dụng</label>
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Nêu rõ yêu cầu về minh chứng (giấy chứng nhận có dấu, vé check-in...)"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded"
                >
                  Tạo tiêu chí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
