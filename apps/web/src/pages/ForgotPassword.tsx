import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

export const ForgotPassword: React.FC = () => (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-3"><KeyRound className="w-6 h-6" /></div>
        <h1 className="text-xl font-bold text-slate-900">Quên mật khẩu</h1>
        <p className="text-sm text-slate-600 mt-2">EduPoint chưa gửi liên kết đặt lại mật khẩu qua email.</p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />Liên hệ CTSV hoặc quản trị hệ thống</div>
        <p className="mt-2 leading-6">Quản trị viên sẽ cấp một mật khẩu tạm. Khi đăng nhập bằng mật khẩu này, bạn bắt buộc đổi mật khẩu trước khi sử dụng chức năng khác.</p>
      </div>
      <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline"><ArrowLeft className="h-4 w-4" />Quay lại đăng nhập</Link>
    </div>
  </div>
);
