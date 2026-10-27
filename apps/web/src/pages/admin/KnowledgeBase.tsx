import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Database, Upload, FileText, CheckCircle, Clock, BookOpen, Trash2, Eye, Layers, Search, X, Plus } from 'lucide-react';

interface RegulationDoc {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  fileUrl: string;
  status: 'ACTIVE' | 'EXPIRED';
  uploadedById?: string;
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    chunks?: number;
    criteria?: number;
  };
  createdAt?: string;
}

export const KnowledgeBase: React.FC = () => {
  const [docs, setDocs] = useState<RegulationDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDocs = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getRegulations();
      setDocs(data || []);
    } catch (err) {
      console.error('Lỗi tải văn bản quy chế:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !version.trim() || !/^https?:\/\//i.test(fileUrl.trim())) {
      alert('Nhập tiêu đề, số hiệu/phiên bản và URL tài liệu hợp lệ');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.createRegulation({
        title: title.trim(),
        version: version.trim(),
        fileUrl: fileUrl.trim(),
        effectiveDate: effectiveDate || new Date().toISOString(),
      });

      setShowAddModal(false);
      setTitle('');
      setVersion('');
      setFileUrl('');
      setEffectiveDate('');
      await loadDocs();
      alert('Đã thêm văn bản quy chế thành công vào cơ sở dữ liệu!');
    } catch (err: any) {
      console.error('Lỗi thêm văn bản quy chế:', err);
      alert(err.response?.data?.message || 'Không thể tạo văn bản quy chế');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa văn bản quy chế "${docTitle}"?`)) return;

    try {
      await apiClient.deleteRegulation(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      alert('Đã xóa văn bản quy chế thành công.');
    } catch (err: any) {
      console.error('Lỗi xóa văn bản quy chế:', err);
      alert(err.response?.data?.message || 'Không thể xóa văn bản này');
    }
  };

  const filteredDocs = docs.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.version.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tài liệu quy chế</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tài liệu nguồn và thời gian hiệu lực. Lập chỉ mục AI chưa được cấu hình; tài liệu được dùng để tra cứu thủ công.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm văn bản quy chế mới</span>
        </button>
      </div>

      {/* 2. Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên quy chế, số hiệu..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Tổng cộng: <strong className="text-slate-800">{docs.length}</strong> tài liệu
        </span>
      </div>

      {/* 3. Document Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Tên văn bản quy chế</th>
                <th className="py-3.5 px-4">Số hiệu / Phiên bản</th>
                <th className="py-3.5 px-4">Ngày ban hành</th>
                <th className="py-3.5 px-4">Tiêu chí liên kết</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Đang tải dữ liệu từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Chưa có tài liệu quy chế nào trong cơ sở dữ liệu. Bấm nút trên để thêm mới.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 block">{doc.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {doc.uploadedBy ? `Đăng bởi: ${doc.uploadedBy.fullName}` : `ID: ${doc.id}`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {doc.version}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(doc.effectiveDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {doc._count?.criteria ?? 0} tiêu chí
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        <span>{doc.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Thêm văn bản mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Thêm văn bản quy chế mới</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên văn bản / Quyết định</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Quyết định 42/QĐ-ĐHBK ban hành Quy chế Đánh giá Rèn luyện"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Số hiệu / Phiên bản</label>
                <input
                  type="text"
                  required
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="VD: QD-42-2026 hoặc v2026.1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ngày ban hành / Hiệu lực</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Đường dẫn tệp tài liệu (PDF / URL)</label>
                <input
                  type="text"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="/docs/qd-42-drl.pdf"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu tài liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
