import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Award, Printer, CheckCircle, ChevronRight, HelpCircle, FileText } from 'lucide-react';

export const ScoreReport: React.FC = () => {
  const { user, activeTerm } = useAuth();

  const scoreRows = [
    {
      code: 'KHUNG_I',
      title: 'Khung I: Ý thức học tập',
      score: 18.0,
      max: 20.0,
      evidences: [
        { name: 'Điểm trung bình học kỳ 3.42 (Học lực Giỏi)', points: 10.0, ref: 'Điều 4 Khoản 1' },
        { name: 'Giải Ba Cuộc thi Danang TechHack 2026', points: 5.0, ref: 'Điều 4 Khoản 2' },
        { name: 'Tham gia đề tài NCKH cấp Khoa', points: 3.0, ref: 'Điều 4 Khoản 3' },
      ],
    },
    {
      code: 'KHUNG_II',
      title: 'Khung II: Chấp hành pháp luật & nội quy',
      score: 25.0,
      max: 25.0,
      evidences: [
        { name: 'Không vi phạm quy chế thi, nội quy ký túc xá và an toàn giao thông', points: 25.0, ref: 'Điều 5 Khoản 1' },
      ],
    },
    {
      code: 'KHUNG_III',
      title: 'Khung III: Hoạt động chính trị - xã hội, văn hóa, thể thao',
      score: 15.0,
      max: 20.0,
      evidences: [
        { name: 'Tham gia Hiến máu tình nguyện đợt 1', points: 5.0, ref: 'Điều 6 Khoản 2' },
        { name: 'Cổ vũ Hội thao Bách Khoa DUT Games 2026', points: 2.0, ref: 'Điều 6 Khoản 3' },
        { name: 'Tham gia Cuộc thi Tiếng hát Sinh viên', points: 3.0, ref: 'Điều 6 Khoản 1' },
        { name: 'Hỗ trợ Tân sinh viên K26 nhập học', points: 5.0, ref: 'Điều 6 Khoản 2' },
      ],
    },
    {
      code: 'KHUNG_IV',
      title: 'Khung IV: Phẩm chất công dân và quan hệ cộng đồng',
      score: 10.0,
      max: 25.0,
      evidences: [
        { name: 'Tham gia hoạt động tuyên truyền an toàn giao thông', points: 10.0, ref: 'Điều 7 Khoản 1' },
      ],
    },
    {
      code: 'KHUNG_V',
      title: 'Khung V: Cán sự lớp và thành tích đặc biệt',
      score: 10.0,
      max: 10.0,
      evidences: [
        { name: 'Đảm nhiệm Bí thư Chi đoàn 21TCLC_DT1 hoàn thành Tốt nhiệm vụ', points: 10.0, ref: 'Điều 8 Khoản 1' },
      ],
    },
  ];

  const totalScore = scoreRows.reduce((sum, r) => sum + r.score, 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bảng điểm rèn luyện & Truy vết (S09)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bảng điểm chi tiết có truy vết căn cứ từng hoạt động trong {activeTerm.name}.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>In / Xuất PDF</span>
        </button>
      </div>

      {/* Student Card Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block font-medium">Họ và tên sinh viên</span>
          <span className="text-slate-900 font-bold text-sm">{user.fullName}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
          <span className="text-slate-900 font-semibold text-sm">{user.studentCode || '102210001'}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Lớp sinh hoạt / Khoa</span>
          <span className="text-slate-900 font-semibold text-sm">21TCLC_DT1 · CNTT</span>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-400 block font-medium">Tổng điểm / Xếp loại</span>
          <span className="text-emerald-700 font-extrabold text-base">
            {totalScore} / 100 ({totalScore >= 80 ? 'Loại Tốt' : 'Loại Khá'})
          </span>
        </div>
      </div>

      {/* Traceability Table: "Vì sao được X điểm?" */}
      <div className="space-y-4">
        {scoreRows.map((cat, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 uppercase">{cat.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {cat.score} / {cat.max} điểm
                </span>
                {cat.score >= cat.max && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    Đạt trần
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {cat.evidences.map((item, i) => (
                <div key={i} className="p-3.5 px-5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-800 block">{item.name}</span>
                    <span className="text-[11px] text-sky-700">Trích dẫn: {item.ref}</span>
                  </div>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                    +{item.points} đ
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
