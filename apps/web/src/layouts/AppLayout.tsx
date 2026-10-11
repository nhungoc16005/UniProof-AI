import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Notification } from '../types';

interface NavGroup {
  title: string;
  items: { label: string; path: string }[];
}

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

  // Grouped Navigation per role
  const navGroups: NavGroup[] = useMemo(() => {
    if (!user) return [];

    if (user.role === 'STAFF') {
      return [
        {
          title: 'ĐIỀU HÀNH & XÉT DUYỆT',
          items: [
            { label: 'Bảng điều hành', path: '/officer' },
            { label: 'Hàng đợi xét duyệt', path: '/officer/queue' },
            { label: 'Xử lý khiếu nại', path: '/officer/appeals' },
          ],
        },
        {
          title: 'QUẢN LÝ DỮ LIỆU',
          items: [
            { label: 'Hồ sơ sinh viên', path: '/officer/students' },
            { label: 'Hoạt động nội bộ', path: '/officer/activities' },
            { label: 'Nguồn ngoài trường', path: '/officer/external-activities' },
          ],
        },
        {
          title: 'QUY CHẾ & BÁO CÁO',
          items: [
            { label: 'Tiêu chí & Quy tắc', path: '/officer/criteria' },
            { label: 'Báo cáo & Thống kê', path: '/officer/reports' },
            { label: 'Hỏi đáp quy chế AI', path: '/regulations/ask' },
          ],
        },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        {
          title: 'HỆ THỐNG & NGƯỜI DÙNG',
          items: [
            { label: 'Bảng điều hành', path: '/admin' },
            { label: 'Quản lý người dùng', path: '/admin/users' },
            { label: 'Kỳ đánh giá', path: '/admin/terms' },
          ],
        },
        {
          title: 'TIÊU CHÍ & LUẬT ĐIỂM',
          items: [
            { label: 'Khung tiêu chí', path: '/admin/criteria' },
            { label: 'Rule Engine', path: '/admin/rules' },
            { label: 'Knowledge Base (RAG)', path: '/admin/knowledge-base' },
          ],
        },
        {
          title: 'AI & AN TOÀN HỆ THỐNG',
          items: [
            { label: 'Cấu hình AI & OCR', path: '/admin/ai-config' },
            { label: 'Dữ liệu kiểm chuẩn', path: '/admin/ground-truth' },
            { label: 'Đánh giá chất lượng AI', path: '/admin/ai-evaluation' },
            { label: 'Nhật ký kiểm toán', path: '/admin/audit-logs' },
            { label: 'Sức khỏe hệ thống', path: '/admin/health' },
          ],
        },
      ];
    }

    // Default: STUDENT
    return [
      {
        title: 'TỔNG QUAN',
        items: [
          { label: 'Bảng điều khiển', path: '/student' },
          { label: 'Bảng điểm chi tiết', path: '/student/scores' },
        ],
      },
      {
        title: 'HỒ SƠ RÈN LUYỆN',
        items: [
          { label: 'Nộp minh chứng mới', path: '/student/evidence/new' },
          { label: 'Danh sách minh chứng', path: '/student/evidence' },
          { label: 'Khiếu nại điểm', path: '/student/appeals' },
        ],
      },
      {
        title: 'QUY CHẾ & HỖ TRỢ',
        items: [
          { label: 'Cơ hội tích lũy điểm', path: '/student/what-can-i-claim' },
          { label: 'Khung tiêu chí rèn luyện', path: '/student/criteria' },
          { label: 'Hỏi đáp quy chế AI', path: '/regulations/ask' },
        ],
      },
    ];
  }, [user]);

  // Dynamic Breadcrumb resolver
  const breadcrumbs = useMemo(() => {
    const p = location.pathname;
    const crumbs: { label: string; path?: string }[] = [];

    if (p.startsWith('/student')) {
      crumbs.push({ label: 'Sinh viên', path: '/student' });
      if (p === '/student') return crumbs;
      if (p === '/student/evidence') crumbs.push({ label: 'Danh sách minh chứng' });
      else if (p === '/student/evidence/new') crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Nộp minh chứng mới' });
      else if (p.includes('/supplement')) crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Bổ sung hồ sơ' });
      else if (p.startsWith('/student/evidence/')) crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Chi tiết hồ sơ' });
      else if (p === '/student/scores') crumbs.push({ label: 'Bảng điểm chi tiết' });
      else if (p === '/student/what-can-i-claim') crumbs.push({ label: 'Cơ hội tích lũy điểm' });
      else if (p === '/student/criteria') crumbs.push({ label: 'Khung tiêu chí rèn luyện' });
      else if (p === '/student/appeals') crumbs.push({ label: 'Khiếu nại điểm' });
    } else if (p.startsWith('/officer')) {
      crumbs.push({ label: 'Cán bộ', path: '/officer' });
      if (p === '/officer') return crumbs;
      if (p === '/officer/queue') crumbs.push({ label: 'Hàng đợi xét duyệt' });
      else if (p.startsWith('/officer/review/')) crumbs.push({ label: 'Hàng đợi xét duyệt', path: '/officer/queue' }, { label: 'Thẩm định hồ sơ' });
      else if (p === '/officer/appeals') crumbs.push({ label: 'Xử lý khiếu nại' });
      else if (p === '/officer/students') crumbs.push({ label: 'Hồ sơ sinh viên' });
      else if (p === '/officer/activities') crumbs.push({ label: 'Hoạt động nội bộ' });
      else if (p === '/officer/external-activities') crumbs.push({ label: 'Nguồn ngoài trường' });
      else if (p === '/officer/criteria') crumbs.push({ label: 'Tiêu chí & Quy tắc' });
      else if (p === '/officer/reports') crumbs.push({ label: 'Báo cáo & Thống kê' });
    } else if (p.startsWith('/admin')) {
      crumbs.push({ label: 'Quản trị hệ thống', path: '/admin' });
      if (p === '/admin') return crumbs;
      if (p === '/admin/users') crumbs.push({ label: 'Quản lý người dùng' });
      else if (p === '/admin/terms') crumbs.push({ label: 'Kỳ đánh giá' });
      else if (p === '/admin/criteria') crumbs.push({ label: 'Khung tiêu chí' });
      else if (p === '/admin/rules') crumbs.push({ label: 'Rule Engine' });
      else if (p === '/admin/knowledge-base') crumbs.push({ label: 'Knowledge Base (RAG)' });
      else if (p === '/admin/ai-config') crumbs.push({ label: 'Cấu hình AI & OCR' });
      else if (p === '/admin/ground-truth') crumbs.push({ label: 'Dữ liệu kiểm chuẩn' });
      else if (p === '/admin/ai-evaluation') crumbs.push({ label: 'Đánh giá chất lượng AI' });
      else if (p === '/admin/audit-logs') crumbs.push({ label: 'Nhật ký kiểm toán' });
      else if (p === '/admin/health') crumbs.push({ label: 'Sức khỏe hệ thống' });
    } else if (p.startsWith('/regulations')) {
      crumbs.push({ label: 'Hỏi đáp quy chế AI' });
    } else if (p === '/account') {
      crumbs.push({ label: 'Hồ sơ & Tài khoản' });
    }

    return crumbs;
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc] text-slate-900 font-sans antialiased">
      
      {/* 1. TOPBAR HEADER (Glassmorphism & Deep Subtle Shadow) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4 py-2.5">
          
          {/* Logo & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold"
            >
              {mobileMenuOpen ? 'Đóng' : 'Menu'}
            </button>

            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1d6fc2] text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/25 tracking-wider">
                EP
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                  Edu<span className="text-[#1d6fc2]">Point</span>
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
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/90 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
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

            {/* User Official Role Badge */}
            <div className="flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-[#1d6fc2] border border-blue-200/60 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1d6fc2] mr-1.5 animate-pulse"></span>
              {user?.role === 'STUDENT' ? 'Sinh viên' : user?.role === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị viên'}
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserDropdown(false);
                }}
                className="relative px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#1d6fc2] rounded-lg hover:bg-blue-50/60 transition"
              >
                <span>Thông báo</span>
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#1d6fc2] text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 z-50 p-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Thông báo ({unreadCount})
                    </span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#1d6fc2] hover:underline font-medium"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl text-xs transition cursor-pointer ${
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
                <div className="w-7 h-7 rounded-full bg-[#1d6fc2] text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/20">
                  {user?.fullName ? user.fullName.split(' ').pop()?.[0] : 'U'}
                </div>
                <span className="text-xs font-semibold text-slate-900 hidden sm:inline">
                  {user?.fullName}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 z-50 p-1.5 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 border-b border-slate-100">
                    <div className="font-bold text-slate-900 truncate">{user?.fullName}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  </div>

                  <Link
                    to="/account"
                    onClick={() => setShowUserDropdown(false)}
                    className="block px-3 py-2 text-slate-700 hover:bg-blue-50/70 hover:text-[#1d6fc2] rounded-xl transition font-medium"
                  >
                    Hồ sơ & Tài khoản
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition font-semibold"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: CATEGORIZED SIDEBAR + MAIN CONTENT */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-8">
        
        {/* Desktop Sidebar: Clean Grouped Navigation */}
        <aside className="hidden lg:block w-60 shrink-0">
          <nav className="sticky top-20 space-y-5">
            
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block px-3 py-2 rounded-xl text-xs transition duration-150 ${
                          isActive
                            ? 'bg-[#1d6fc2] text-white font-bold shadow-sm shadow-blue-600/20'
                            : 'text-slate-600 hover:text-[#1d6fc2] hover:bg-blue-50/70 font-medium'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                Đăng xuất
              </button>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white h-full p-4 flex flex-col shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-bold text-sm text-slate-900">
                <span>Menu Điều hướng</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
              <nav className="space-y-4 overflow-y-auto flex-1">
                {navGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`block px-3 py-2 rounded-xl text-xs transition ${
                            isActive
                              ? 'bg-[#1d6fc2] text-white font-bold shadow-sm'
                              : 'text-slate-700 font-medium hover:text-[#1d6fc2]'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="pt-3 border-t border-slate-200">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl text-left px-3"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Elegant Breadcrumb Navigation */}
          {breadcrumbs.length > 0 && (
            <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-slate-300">/</span>}
                    {crumb.path && !isLast ? (
                      <Link to={crumb.path} className="hover:text-[#1d6fc2] transition">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-slate-700 font-semibold">{crumb.label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          <Outlet />
        </main>
      </div>

    </div>
  );
};
