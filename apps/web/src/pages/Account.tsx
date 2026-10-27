import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { User as UserIcon, KeyRound, LogOut, Check, AlertCircle } from 'lucide-react';

export const Account: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPw !== confirmPw) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPw.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.changePassword(currentPw, newPw);
      setSavedSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống EduPoint?')) {
      logout();
      navigate('/login');
    }
  };

  if (!user || !user.id) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hồ sơ cá nhân và bảo mật (C03)</h1>
        <p className="text-xs text-slate-500 mt-1">
          Thông tin tài khoản trường cấp được đồng bộ từ Cơ sở Dữ liệu Đào tạo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-sky-600" />
            <span>Thông tin người dùng</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Họ và tên</span>
              <span className="text-slate-900 font-semibold text-sm">{user.fullName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Email trường cấp</span>
              <span className="text-slate-900 font-semibold text-sm">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Vai trò hệ thống</span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                {user.role}
              </span>
            </div>
            {user.studentCode && (
              <div>
                <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
                <span className="text-slate-900 font-semibold text-sm">{user.studentCode}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block font-medium">Đơn vị / Khoa</span>
              <span className="text-slate-900 font-semibold text-sm">
                {user.faculty?.name || 'Chưa cập nhật'}
              </span>
            </div>
            {user.studentCode && (
              <div>
                <span className="text-slate-400 block font-medium">Lớp sinh hoạt</span>
                <span className="text-slate-900 font-semibold text-sm">
                  {user.class?.name || user.class?.code || 'Chưa cập nhật'}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>* Thông tin hành chính do Nhà trường quản lý, không thể chỉnh sửa trực tiếp.</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-600" />
              <span>Đổi mật khẩu</span>
            </h2>

            {savedSuccess && (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đổi mật khẩu thành công!</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition"
              >
                {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
