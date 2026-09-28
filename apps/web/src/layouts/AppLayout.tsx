import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Notification } from '../types';

export const AppLayout: React.FC = () => {
  const { user, activeTerm, terms, switchRole, switchTerm, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    apiClient.getNotifications().then(setNotifications);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    await apiClient.markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleLogout = () => {
    setShowUserDropdown(false);
    logout();
    navigate('/login');
  };

  // Clean, professional navigation items without spec codes or cluttered icons
  const getNavItems = () => {
    if (!user) return [];
    if (user.role === 'STAFF') {
      return [
        { label: 'Bảng điều hành', path: '/officer' },
        { label: 'Hàng đợi xét duyệt', path: '/officer/queue' },
        { label: 'Xử lý khiếu nại', path: '/officer/appeals' },
        { label: 'Hồ sơ sinh viên', path: '/officer/students' },
        { label: 'Hoạt động nội bộ', path: '/officer/activities' },
        { label: 'Nguồn ngoài trường', path: '/officer/external-activities' },
        { label: 'Tiêu chí & Quy tắc', path: '/officer/criteria' },
        { label: 'Báo cáo & Thống kê', path: '/officer/reports' },
        { label: 'Hỏi đáp quy chế RAG', path: '/regulations/ask' },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        { label: 'Bảng điều hành', path: '/admin' },
        { label: 'Quản lý người dùng', path: '/admin/users' },
        { label: 'Kỳ đánh giá', path: '/admin/terms' },
        { label: 'Khung tiêu chí', path: '/admin/criteria' },
        { label: 'Rule Engine', path: '/admin/rules' },
        { label: 'Knowledge Base (RAG)', path: '/admin/knowledge-base' },
        { label: 'Cấu hình AI & OCR', path: '/admin/ai-config' },
        { label: 'Dữ liệu kiểm chuẩn', path: '/admin/ground-truth' },
        { label: 'Đánh giá chất lượng AI', path: '/admin/ai-evaluation' },
        { label: 'Nhật ký kiểm toán', path: '/admin/audit-logs' },
        { label: 'Sức khỏe hệ thống', path: '/admin/health' },
      ];
    }

    // Default: STUDENT
    return [
      { label: 'Bảng điều khiển', path: '/student' },
      { label: 'Nộp minh chứng mới', path: '/student/evidence/new' },
      { label: 'Danh sách minh chứng', path: '/student/evidence' },
      { label: 'Bảng điểm chi tiết', path: '/student/scores' },
      { label: 'Cơ hội tích lũy điểm', path: '/student/what-can-i-claim' },
      { label: 'Khung tiêu chí rèn luyện', path: '/student/criteria' },
      { label: 'Khiếu nại điểm', path: '/student/appeals' },
      { label: 'Hỏi đáp quy chế RAG', path: '/regulations/ask' },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc] text-slate-900 font-sans">
      
      {/* 1. TOPBAR HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4 py-2.5">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold"
            >
              {mobileMenuOpen ? 'Đóng' : 'Menu'}
            </button>

            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/25 tracking-wider">
                EP
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                  Edu<span className="text-blue-600">Point</span>
                </span>
                <span className="text-[10px] font-medium text-slate-400 hidden sm:block">
                  Hệ thống Quản lý Điểm Rèn Luyện
                </span>
              </div>
            </Link>
          </div>

          {/* Controls: Term Selector, Role Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Term Selector */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
              <span className="text-slate-400">Kỳ:</span>
              <select
                value={activeTerm?.id}
                onChange={(e) => {
                  const t = terms.find((item) => item.id === e.target.value);
                  if (t) switchTerm(t);
                }}
                className="bg-transparent border-none text-slate-900 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Role Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs gap-0.5">
              <button
                onClick={() => {
                  switchRole('STUDENT');
                  navigate('/student');
                }}
                className={`px-3 py-1 rounded-lg transition text-xs font-semibold ${
                  user?.role === 'STUDENT'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sinh viên
              </button>
              <button
                onClick={() => {
                  switchRole('STAFF');
                  navigate('/officer');
                }}
                className={`px-3 py-1 rounded-lg transition text-xs font-semibold ${
                  user?.role === 'STAFF'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cán bộ
              </button>
              <button
                onClick={() => {
                  switchRole('ADMIN');
                  navigate('/admin');
                }}
                className={`px-3 py-1 rounded-lg transition text-xs font-semibold ${
                  user?.role === 'ADMIN'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserDropdown(false);
                }}
                className="relative px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 rounded-lg hover:bg-blue-50/60 transition"
              >
                <span>Thông báo</span>
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Thông báo ({unreadCount})
                    </span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg text-xs transition cursor-pointer ${
                          n.isRead ? 'bg-white opacity-70' : 'bg-slate-50 font-medium'
                        }`}
                        onClick={() => {
                          setShowNotifMenu(false);
                          if (user?.role === 'STUDENT') navigate('/student/evidence');
                          if (user?.role === 'STAFF') navigate('/officer/queue');
                        }}
                      >
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{n.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Menu */}
            <div className="relative border-l border-slate-200 pl-2">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition focus:outline-none"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/20">
                  {user?.fullName ? user.fullName.split(' ').pop()?.[0] : 'U'}
                </div>
                <span className="text-xs font-semibold text-slate-900 hidden sm:inline">
                  {user?.fullName}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1.5 space-y-1 text-xs">
                  <div className="p-2 border-b border-slate-100">
                    <div className="font-bold text-slate-900 truncate">{user?.fullName}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  </div>

                  <Link
                    to="/account"
                    onClick={() => setShowUserDropdown(false)}
                    className="block px-3 py-1.5 text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 rounded-lg transition font-medium"
                  >
                    Hồ sơ & Tài khoản
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition font-semibold"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CONTENT */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-8">
        
        {/* Clean Typographic Desktop Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-20 space-y-0.5">
            <div className="px-3 py-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              {user?.role === 'STUDENT' ? 'Sinh viên' : user?.role === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị viên'}
            </div>

            {navItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-3 py-2 rounded-lg text-xs transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/70 font-medium'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                Đăng xuất
              </button>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white h-full p-4 flex flex-col shadow-xl z-10 space-y-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-bold text-sm text-slate-900">
                <span>Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
              <nav className="space-y-1 overflow-y-auto flex-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2.5 rounded-lg text-xs ${
                        isActive ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 font-medium hover:text-blue-600'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="pt-3 border-t border-slate-200">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg text-left px-3"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
