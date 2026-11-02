import React from 'react';
import { EvaluationBoard } from '../../components/EvaluationBoard';
export const ResultsReception: React.FC = () => (
  <div className="space-y-5 font-sans">
    <header className="space-y-1">
      <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#0A0A0A] tracking-tight">
        Tiếp nhận & công bố
      </h1>
      <p className="text-xs sm:text-sm text-[#6B6B6B]">
        Kiểm tra bản kết quả Khoa gửi, trả phiếu cần chỉnh sửa và công bố đúng phiên bản.
      </p>
    </header>
    <EvaluationBoard admin />
  </div>
);
