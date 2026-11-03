import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { EvaluationBoard } from '../../components/EvaluationBoard';
export const StudentLookup: React.FC = () => {
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  const safeReturnTo = returnTo?.startsWith('/officer/evaluations?') ? returnTo : '';
  return <div className="space-y-5 font-sans">
    {safeReturnTo && <Link to={safeReturnTo} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1D6FC2] hover:underline"><ChevronLeft className="h-4 w-4" /> Quay lại lớp đang xem</Link>}
    <header className="space-y-1">
      <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#0A0A0A] tracking-tight">
        Danh sách đánh giá
      </h1>
      <p className="text-xs sm:text-sm text-[#6B6B6B]">
        Theo dõi tiến độ từng sinh viên, kiểm tra căn cứ và gửi kết quả đã hoàn tất đến CTSV.
      </p>
    </header>
    <EvaluationBoard />
  </div>
};
