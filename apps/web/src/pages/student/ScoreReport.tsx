import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Award, Printer, CheckCircle, ChevronRight, HelpCircle, FileText } from 'lucide-react';

export const ScoreReport: React.FC = () => {
  const { user, activeTerm } = useAuth();

  const scoreRows = [
    {
      code: 'KHUNG_I',
      title: 'Khung I: Ý thức tham gia học tập',
      score: 17.0,
      max: 20.0,
      evidences: [
        { name: 'Tiêu chí 1: Đi học đầy đủ, đúng giờ, nghiêm túc trong giờ học', points: 6.0, ref: 'Mục 1' },
        { name: 'Tiêu chí 2: Có ý thức, trách nhiệm khi tham gia nhóm làm việc chung', points: 3.0, ref: 'Mục 2' },
        { name: 'Tiêu chí 3: Kết quả học tập đạt loại Giỏi và cao hơn kỳ trước', points: 5.0, ref: 'Mục 3' },
        { name: 'Tiêu chí 4: Tham gia CLB Tin học học thuật và Khởi nghiệp đổi mới sáng tạo', points: 3.0, ref: 'Mục 4' },
        { name: 'Tiêu chí 5: Tham gia NCKH hoặc thi Olympic môn học (Chưa có)', points: 0.0, ref: 'Mục 5' },
      ],
    },
    {
      code: 'KHUNG_II',
      title: 'Khung II: Ý thức chấp hành nội quy, quy chế, quy định',
      score: 25.0,
      max: 25.0,
      evidences: [
        { name: 'Tiêu chí 6: Chấp hành chủ trương, phong trào hoạt động do Nhà trường và Đoàn thể phát động', points: 5.0, ref: 'Mục 6' },
        { name: 'Tiêu chí 7: Không vi phạm quy chế, quy định, nội quy của Trường, Khoa, Lớp', points: 15.0, ref: 'Mục 7' },
        { name: 'Tiêu chí 8: Tích cực tham gia hoạt động giáo dục chính trị, kỹ năng mềm', points: 5.0, ref: 'Mục 8' },
      ],
    },
    {
      code: 'KHUNG_III',
      title: 'Khung III: Ý thức tham gia các hoạt động chính trị, xã hội, phong trào',
      score: 20.0,
      max: 20.0,
      evidences: [
        { name: 'Tiêu chí 9: Tham gia tích cực các hoạt động văn hóa, văn nghệ, thể thao (từ 3 lần trở lên)', points: 10.0, ref: 'Mục 9' },
        { name: 'Tiêu chí 10: Tham gia hoạt động tuyên truyền, phòng chống tệ nạn, an toàn giao thông, an ninh mạng', points: 10.0, ref: 'Mục 10' },
      ],
    },
    {
      code: 'KHUNG_IV',
      title: 'Khung IV: Ý thức công dân trong quan hệ cộng đồng',
      score: 25.0,
      max: 25.0,
      evidences: [
        { name: 'Tiêu chí 11: Tham gia BHYT, đăng ký tạm trú tạm vắng và chấp hành pháp luật', points: 10.0, ref: 'Mục 11' },
        { name: 'Tiêu chí 12: Tham gia hoạt động phục vụ cộng đồng (HĐPVCĐ), công ích, tình nguyện (≥ 3 hoạt động)', points: 10.0, ref: 'Mục 12' },
        { name: 'Tiêu chí 13: Thành viên Ban tổ chức / cộng tác viên các sự kiện của Trường, Khoa', points: 5.0, ref: 'Mục 13' },
      ],
    },
    {
      code: 'KHUNG_V',
      title: 'Khung V: Ý thức và kết quả khi tham gia công tác cán bộ lớp, đoàn thể',
      score: 0.0,
      max: 10.0,
      evidences: [
        { name: 'Tiêu chí 14: Thành viên Ban Cán sự lớp, BCH Đoàn, Hội hoàn thành tốt nhiệm vụ', points: 0.0, ref: 'Mục 14' },
        { name: 'Tiêu chí 15: Thành viên BCS, Đoàn, Hội hoàn thành xuất sắc nhiệm vụ và khen thưởng', points: 0.0, ref: 'Mục 15' },
        { name: 'Tiêu chí 16: Khen thưởng từ cấp Trường trở lên về học tập, rèn luyện, phong trào', points: 0.0, ref: 'Mục 16' },
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
