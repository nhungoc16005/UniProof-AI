import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { User as UserIcon, KeyRound, LogOut, Check, AlertCircle, Building2, GraduationCap, ShieldCheck, Flag, X } from 'lucide-react';

const roleLabels = { STUDENT: 'Sinh viên', STAFF: 'Cán bộ Khoa', ADMIN: 'Quản trị viên / CTSV' } as const;

export const Account: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState('Thông tin cá nhân');
  const [issueContent, setIssueContent] = useState('');
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueNotice, setIssueNotice] = useState('');

  const submitIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (issueContent.trim().length < 10) return;
    try {
      setIssueBusy(true);
      await apiClient.createProfileDataIssue({ category: issueCategory, content: issueContent.trim() });
      setIssueOpen(false);
      setIssueContent('');
      setIssueNotice('Đã gửi yêu cầu. CTSV có thể theo dõi và phản hồi ngay trong EduPoint.');
    } catch (error: any) {
      setIssueNotice(error.response?.data?.error?.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally { setIssueBusy(false); }
  };

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
      await logout();
      navigate('/login', { replace: true, state: { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' } });
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hồ sơ của tôi</h1>
        <p className="text-xs text-slate-500 mt-1">
          Dữ liệu học vụ do Nhà trường quản lý. Bạn có thể kiểm tra thông tin và quản lý bảo mật tài khoản tại đây.
        </p>
      </div>

      {(location.state as any)?.firstLogin && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Đây là lần đăng nhập đầu tiên. Vui lòng đổi mật khẩu trước khi sử dụng các chức năng khác.
        </div>
      )}
      {issueNotice && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{issueNotice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-sky-600" />
            <span>Thông tin học vụ</span>
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
              <span className="text-slate-400 block font-medium">Loại tài khoản</span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                {roleLabels[user.role]}
              </span>
            </div>
            {user.studentCode && (
              <div>
                <span className="text-slate-400 block font-medium">Mã số sinh viên (MSSV)</span>
                <span className="text-slate-900 font-semibold text-sm">{user.studentCode}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
              <span className="text-slate-400 block font-medium">Đơn vị / Khoa</span>
              <span className="text-slate-900 font-semibold text-sm">
                {user.faculty?.name || user.class?.faculty?.name || 'Chưa cập nhật'}
              </span>
              </div>
            </div>
            {user.studentCode && (
              <div className="flex gap-2">
                <GraduationCap className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                <span className="text-slate-400 block font-medium">Lớp sinh hoạt</span>
                <span className="text-slate-900 font-semibold text-sm">
                  {user.class?.code || user.class?.name || 'Chưa cập nhật'}{user.class?.cohort ? ` · ${user.class.cohort}` : ''}
                </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-400" />
              <div><span className="text-slate-400 block font-medium">Trạng thái tài khoản</span><span className="text-emerald-700 font-semibold text-sm">{user.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></div>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Cập nhật gần nhất</span>
              <span className="text-slate-900 font-semibold text-sm">{user.updatedAt ? new Date(user.updatedAt).toLocaleString('vi-VN') : 'Chưa có thông tin'}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>* Thông tin hành chính do Nhà trường quản lý, không thể chỉnh sửa trực tiếp.</span>
            <button type="button" onClick={() => { setIssueNotice(''); setIssueOpen(true); }} className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline"><Flag className="h-3.5 w-3.5" />Báo sai thông tin</button>
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
        <details className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm" open={Boolean((location.state as any)?.firstLogin)}>
          <div>
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-600" />
              <span>Bảo mật & mật khẩu</span>
            </summary>

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
        </details>
      </div>
      {issueOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-issue-title">
        <form onSubmit={submitIssue} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3"><div><h2 id="profile-issue-title" className="font-bold text-slate-900">Báo sai thông tin hồ sơ</h2><p className="mt-1 text-sm text-slate-600">Yêu cầu được lưu lịch sử và chuyển tới CTSV. Dữ liệu không tự thay đổi.</p></div><button type="button" onClick={() => setIssueOpen(false)} aria-label="Đóng"><X className="h-5 w-5" /></button></div>
          <label className="block text-sm font-semibold text-slate-700">Loại thông tin<select value={issueCategory} onChange={event => setIssueCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option>Thông tin cá nhân</option><option>MSSV</option><option>Lớp / khóa</option><option>Khoa phụ trách</option><option>Khác</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Nội dung sai và thông tin đúng<textarea autoFocus required minLength={10} rows={5} value={issueContent} onChange={event => setIssueContent(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" placeholder="Mô tả thông tin đang sai và thông tin đúng cần đối soát…" /></label>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setIssueOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button disabled={issueBusy || issueContent.trim().length < 10} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{issueBusy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button></div>
        </form>
      </div>}
    </div>
  );
};
