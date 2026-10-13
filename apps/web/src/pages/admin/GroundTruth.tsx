import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface GroundTruthItem {
  id: string;
  activityText: string;
  trueCriterion: string;
  trueScore: number;
  source: string;
  verifiedDate: string;
}

export const GroundTruth: React.FC = () => {
  const [samples, setSamples] = useState<GroundTruthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchGroundTruth = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getEvidences({ status: 'APPROVED', pageSize: 50 });
      const rawList = Array.isArray(res) ? res : [];
      const items: GroundTruthItem[] = rawList.map((e: any) => {
        const primaryReview = e.reviews?.[0];
        const critName = primaryReview?.criterion 
          ? `${primaryReview.criterion.code} - ${primaryReview.criterion.name}` 
          : 'Tiêu chí đã duyệt';
        const reviewerName = primaryReview?.reviewer?.fullName || 'Hội đồng Khoa';
        return {
          id: e.id,
          activityText: e.title || e.description || e.activity?.name || 'Minh chứng hoạt động',
          trueCriterion: critName,
          trueScore: primaryReview?.approvedScore ?? e.finalScore ?? 0,
          source: `Thẩm định bởi ${reviewerName}`,
          verifiedDate: new Date(primaryReview?.createdAt || e.updatedAt).toLocaleDateString('vi-VN'),
        };
      });
      setSamples(items);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu Ground Truth:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroundTruth();
  }, []);

  const filteredSamples = samples.filter((s) =>
    s.activityText.toLowerCase().includes(search.toLowerCase()) ||
    s.trueCriterion.toLowerCase().includes(search.toLowerCase()) ||
    s.source.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Ground Truth Dataset (A08)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tập dữ liệu chuẩn đối chứng trích xuất trực tiếp từ các hồ sơ đã thẩm định và phê duyệt (APPROVED) trong hệ thống để huấn luyện và đánh giá mô hình.
          </p>
        </div>

        <button
          onClick={fetchGroundTruth}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo nội dung hoạt động, tiêu chí hoặc người thẩm định..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Tổng số mẫu chuẩn: <span className="font-bold text-slate-900">{filteredSamples.length}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Đoạn text hoạt động mẫu</th>
                <th className="py-3 px-4">Nhãn tiêu chí chuẩn (Ground Truth)</th>
                <th className="py-3 px-4">Điểm chuẩn</th>
                <th className="py-3 px-4">Nguồn thẩm định</th>
                <th className="py-3 px-4 text-right">Ngày xác thực</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Đang truy vấn cơ sở dữ liệu hồ sơ đã duyệt...
                  </td>
                </tr>
              ) : filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Chưa có hồ sơ minh chứng nào được thẩm định và phê duyệt (APPROVED) để đưa vào tập dữ liệu chuẩn.
                  </td>
                </tr>
              ) : (
                filteredSamples.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 max-w-sm">
                      {s.activityText}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-blue-700">
                      {s.trueCriterion}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      +{s.trueScore} đ
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{s.source}</td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-mono">
                      {s.verifiedDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
