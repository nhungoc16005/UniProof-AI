import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Building } from 'lucide-react';

export const OrganizerConfirm: React.FC = () => {
  const { token } = useParams<{ token?: string }>();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white p-6 flex items-center gap-3">
          <Building className="w-6 h-6" />
          <div>
            <h1 className="text-base font-bold">Xác nhận hoạt động</h1>
            <p className="text-xs text-slate-300 mt-0.5">Cổng phản hồi dành cho đơn vị tổ chức</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div role="alert" className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Chức năng xác nhận chưa được kết nối với Backend.</p>
              <p className="mt-1 text-xs">Chưa có thông tin hồ sơ để xác nhận và phản hồi chưa được gửi. Vui lòng liên hệ nhà trường để xác minh yêu cầu này.</p>
            </div>
          </div>
          {!token && <p className="text-xs text-slate-500">Liên kết không có mã xác nhận.</p>}
          <Link to="/login" className="inline-flex text-sm font-semibold text-blue-700 hover:underline">Quay về trang đăng nhập</Link>
        </div>
      </div>
    </div>
  );
};
