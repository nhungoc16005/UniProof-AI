import React, { useState } from 'react';
import { Database, Upload, FileText, CheckCircle, Clock, BookOpen, Trash2, Eye, Layers, Search, X } from 'lucide-react';
import { mockRegulationDocs } from '../../lib/mockData';

export const KnowledgeBase: React.FC = () => {
  const [docs, setDocs] = useState(mockRegulationDocs);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocForChunks, setSelectedDocForChunks] = useState<any | null>(null);

  // Sample chunks for the inspection modal
  const sampleChunks = [
    {
      id: 'chk-001',
      section: 'Điều 4 · Khoản 2 · Điểm b',
      page: 4,
      content: 'Sinh viên đạt giải thưởng các cuộc thi học thuật, tin học, khởi nghiệp sáng tạo cấp Thành phố hoặc tương đương được tính từ 5.0 đến 10.0 điểm vào Tiêu chí 1.2.',
      tokens: 38,
      vectorDim: 1536,
    },
    {
      id: 'chk-002',
      section: 'Điều 5 · Khoản 1 · Hoạt động Tình nguyện',
      page: 6,
      content: 'Mỗi lần tham gia hiến máu tình nguyện được cấp Giấy chứng nhận hợp lệ sẽ được cộng 5.0 điểm vào Tiêu chí 3 (Ý thức tham gia hoạt động chính trị - xã hội).',
      tokens: 42,
      vectorDim: 1536,
    },
    {
      id: 'chk-003',
      section: 'Điều 2 · Khoản 4 · Nguyên tắc xét duyệt độc lập',
      page: 2,
      content: 'Mỗi văn bản minh chứng chỉ được sử dụng để đề xuất điểm cho một tiêu chí duy nhất. Nghiêm cấm sử dụng một minh chứng để cộng điểm nhiều lần.',
      tokens: 35,
      vectorDim: 1536,
    },
  ];

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
    <div className="space-y-6 pb-12">
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
                    <button
                      type="button"
                      onClick={() => setSelectedDocForChunks(d)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
                      title="Bấm để xem các vector chunks"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Đã lập chỉ mục (86 chunks)</span>
                      <Eye className="w-3 h-3 ml-0.5" />
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button 
                      onClick={() => alert(`Đang xóa tài liệu ${d.version}...`)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Xóa tài liệu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAG Chunks Inspection Modal */}
      {selectedDocForChunks && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Chi Tiết Vector Chunks — {selectedDocForChunks.version}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Các phân đoạn văn bản và embedding phục vụ tìm kiếm ngữ nghĩa
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedDocForChunks(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-xs">
              {sampleChunks.map((chk) => (
                <div key={chk.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-900">{chk.section}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>Trang {chk.page}</span>
                      <span>·</span>
                      <span>{chk.tokens} tokens</span>
                      <span>·</span>
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{chk.vectorDim}d vector</span>
                    </div>
                  </div>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    "{chk.content}"
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDocForChunks(null)}
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
