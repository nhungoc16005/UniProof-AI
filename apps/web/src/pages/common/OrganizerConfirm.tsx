import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Building, AlertCircle, Send, Check } from 'lucide-react';

export const OrganizerConfirm: React.FC = () => {
  const { token } = useParams<{ token?: string }>();
  const [selectedChoice, setSelectedChoice] = useState<'CONFIRMED' | 'ACTIVITY_ONLY' | 'REJECTED'>('CONFIRMED');
  const [note, setNote] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-sky-700 text-white p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Building className="w-5 h-5 text-sky-200" />
          </div>
          <div>
            <h1 className="text-base font-bold">Xác nhận Hoạt động Ngoại khóa — EduPoint</h1>
            <p className="text-xs text-sky-200 mt-0.5">Cổng phản hồi độc lập dành cho Đơn vị tổ chức</p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Cảm ơn Quý đơn vị đã phản hồi!</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thông tin xác nhận đã được tự động đồng bộ vào hệ thống thẩm định điểm rèn luyện của trường đại học. Liên kết xác nhận này hiện đã hết hiệu lực.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
            
            {/* Minimal Student & Activity Info (Ẩn MSSV & dữ liệu cá nhân theo nguyên tắc bảo vệ quyền riêng tư) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                Thông tin sinh viên khai báo cần xác nhận:
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Họ và tên sinh viên:</span>
                  <span className="font-bold text-slate-900 text-sm">Nguyễn Văn An</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vai trò khai báo:</span>
                  <span className="font-semibold text-slate-800">Thí sinh / Người tham gia</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Tên sự kiện / Hoạt động:</span>
                  <span className="font-bold text-sky-800 text-sm">Cuộc thi Sáng tạo Danang TechHack 2026</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Thời gian diễn ra:</span>
                  <span className="font-medium text-slate-700">10/09/2026 – 12/09/2026</span>
                </div>
              </div>
            </div>

            {/* 3 Lựa chọn xác nhận */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800">
                Kính đề nghị Quý đơn vị xác nhận mức độ tham gia:
              </label>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="confirmChoice"
                    checked={selectedChoice === 'CONFIRMED'}
                    onChange={() => setSelectedChoice('CONFIRMED')}
                    className="mt-0.5 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">1. Xác nhận sinh viên đã tham gia</span>
                    <span className="text-[11px] text-slate-500">Hoạt động có diễn ra và sinh viên có tên trong danh sách tham dự / đoạt giải.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="confirmChoice"
                    checked={selectedChoice === 'ACTIVITY_ONLY'}
                    onChange={() => setSelectedChoice('ACTIVITY_ONLY')}
                    className="mt-0.5 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">2. Hoạt động có diễn ra, nhưng KHÔNG có tên sinh viên này</span>
                    <span className="text-[11px] text-slate-500">Chỉ xác nhận tính xác thực của sự kiện, không ghi nhận sự tham gia của cá nhân này.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="confirmChoice"
                    checked={selectedChoice === 'REJECTED'}
                    onChange={() => setSelectedChoice('REJECTED')}
                    className="mt-0.5 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">3. Không xác nhận / Sự kiện không có thực</span>
                    <span className="text-[11px] text-slate-500">Đơn vị không tổ chức hoặc minh chứng không hợp lệ.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Ghi chú bổ sung (tùy chọn):</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập thông tin đính chính hoặc lưu ý cho nhà trường..."
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Gửi phản hồi xác nhận cho Trường Đại học</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
