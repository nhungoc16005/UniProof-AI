import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">404 — Không tìm thấy trang</h1>
      <p className="text-xs text-slate-500 max-w-sm mb-6">
        Trang bạn đang truy cập không tồn tại hoặc bạn không có quyền xem thông tin hồ sơ này.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
      >
        <Home className="w-4 h-4" />
        <span>Trở về Trang chủ</span>
      </Link>
    </div>
  );
};
