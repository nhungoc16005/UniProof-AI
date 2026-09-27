import React, { useState } from 'react';
import { Database, Upload, FileText, CheckCircle, Clock, BookOpen, Trash2 } from 'lucide-react';
import { mockRegulationDocs } from '../../lib/mockData';

export const KnowledgeBase: React.FC = () => {
  const [docs, setDocs] = useState(mockRegulationDocs);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadNew = () => {
    setIsUploading(true);
    setTimeout(() => {
      setDocs([
        ...docs,
        {
          id: `doc-${Date.now()}`,
          title: 'Hướng dẫn số 145/HD-ĐTN về việc tính điểm rèn luyện hoạt động Đoàn - Hội 2026',
          version: 'v2026.2',
          effectiveDate: '2026-09-15',
          fileUrl: '/docs/hd-145.pdf',
          status: 'ACTIVE',
          uploadedById: 'usr-admin-01',
        },
      ]);
      setIsUploading(false);
      alert('Đã upload và lập chỉ mục (RAG Indexing) thành công tài liệu!');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Knowledge Base Quy chế (A06)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kho tài liệu văn bản gốc phục vụ Chatbot RAG tra cứu điều khoản và trích dẫn căn cứ tự động.
          </p>
        </div>

        <button
          onClick={handleUploadNew}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          <span>{isUploading ? 'Đang index vector...' : 'Tải lên quy chế mới (PDF)'}</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Tên văn bản quy chế</th>
                <th className="py-3.5 px-4">Phiên bản</th>
                <th className="py-3.5 px-4">Ngày ban hành / Hiệu lực</th>
                <th className="py-3.5 px-4">Trạng thái RAG Index</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{d.title}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">{d.version}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(d.effectiveDate).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Đã lập chỉ mục (86 chunks)</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="p-1 text-slate-500 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
