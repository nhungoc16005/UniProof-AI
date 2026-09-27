import React, { useState } from 'react';
import { Building, Globe, Send, ShieldCheck, Search, Plus, ExternalLink } from 'lucide-react';

export const ExternalActivities: React.FC = () => {
  const [partners, setPartners] = useState([
    {
      id: 'p-01',
      name: 'Thành đoàn Đà Nẵng & Hội LHTN Việt Nam TP. Đà Nẵng',
      contactEmail: 'thanhdoan@danang.gov.vn',
      verifiedCount: 145,
      trustLevel: 'Level 2 (Xác nhận qua email/portal chính thức)',
      status: 'VERIFIED',
    },
    {
      id: 'p-02',
      name: 'Chi hội An toàn Thông tin phía Nam (VNISA)',
      contactEmail: 'contact@vnisa.org.vn',
      verifiedCount: 42,
      trustLevel: 'Level 3 (Website sự kiện & danh sách công khai)',
      status: 'VERIFIED',
    },
    {
      id: 'p-03',
      name: 'Google Developer Student Clubs (GDSC Vietnam)',
      contactEmail: 'gdsc.vietnam@google.com',
      verifiedCount: 88,
      trustLevel: 'Level 2 (Portal chứng nhận điện tử QR)',
      status: 'VERIFIED',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hoạt động ngoài trường & Đơn vị đối tác (O05)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các đơn vị tổ chức bên ngoài để tự động đối chiếu minh chứng ngoại khóa.
          </p>
        </div>

        <button
          onClick={() => alert('Thêm đối tác tổ chức mới')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm đơn vị tổ chức</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Tên đơn vị tổ chức</th>
                <th className="py-3.5 px-4">Email đầu mối liên hệ</th>
                <th className="py-3.5 px-4">Mức xác minh mặc định</th>
                <th className="py-3.5 px-4">Số hồ sơ đã xác nhận</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {p.id}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {p.contactEmail}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{p.trustLevel}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {p.verifiedCount} hồ sơ
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => alert(`Đã tạo link xác nhận một lần C07 gửi tới ${p.contactEmail}`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition"
                      title="Gửi link xác nhận trực tuyến cho đơn vị"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi link C07</span>
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
