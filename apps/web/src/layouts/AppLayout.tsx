import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, X } from 'lucide-react';
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
  const [notificationLoadError, setNotificationLoadError] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiClient.getNotifications().then((items) => {
        if (cancelled) return;
        setNotifications(items);
        setNotificationLoadError(false);
      }).catch(() => {
        if (!cancelled) setNotificationLoadError(true);
      });
    }, 750);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      window.alert('Không thể cập nhật thông báo. Vui lòng thử lại.');
    }
  };

  const handleLogout = () => {
    setShowUserDropdown(false);
    logout();
    navigate('/login');
  };

  // Điều hướng Web theo vai trò; chỉ đưa các luồng Core đã có API vào menu.
  const navGroups: NavGroup[] = useMemo(() => {
    if (!user) return [];

    if (user.role === 'STAFF') {
      return [
        {
          title: 'CÔNG VIỆC',
          items: [
            { label: 'Tổng quan', path: '/officer' },
            { label: 'Minh chứng', path: '/officer/queue' },
            { label: 'Phúc khảo', path: '/officer/appeals' },
          ],
        },
        {
          title: 'DỮ LIỆU',
          items: [
            { label: 'Hoạt động & điểm danh', path: '/officer/activities' },
            { label: 'Phiếu rèn luyện', path: '/officer/students' },
          ],
        },
        {
          title: 'TRA CỨU',
          items: [
            { label: 'Tiêu chí & quy chế', path: '/officer/criteria' },
          ],
        },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        {
          title: 'QUẢN LÝ',
          items: [
            { label: 'Tổng quan', path: '/admin' },
            { label: 'Tài khoản & đơn vị', path: '/admin/users' },
            { label: 'Kỳ đánh giá', path: '/admin/terms' },
          ],
        },
        {
          title: 'QUY ĐỊNH',
          items: [
            { label: 'Bộ tiêu chí', path: '/admin/criteria' },
            { label: 'Tài liệu quy chế', path: '/admin/knowledge-base' },
          ],
        },
        {
          title: 'HỆ THỐNG',
          items: [
            { label: 'Giám sát & nhật ký', path: '/admin/monitoring' },
          ],
        },
      ];
    }

    return [
      {
        title: 'HỌC KỲ HIỆN TẠI',
        items: [
          { label: 'Tổng quan', path: '/student' },
          { label: 'Chấm điểm rèn luyện', path: '/student/scores' },
        ],
      },
      {
        title: 'HỒ SƠ & KẾT QUẢ',
        items: [
          { label: 'Minh chứng của tôi', path: '/student/evidence' },
          { label: 'Phúc khảo', path: '/student/appeals' },
        ],
      },
      {
        title: 'TRA CỨU',
        items: [
          { label: 'Hỗ trợ', path: '/regulations/ask' },
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
      if (p === '/student/evidence') crumbs.push({ label: 'Minh chứng của tôi' });
      else if (p === '/student/evidence/new') crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Nộp minh chứng mới' });
      else if (p.includes('/supplement')) crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Bổ sung hồ sơ' });
      else if (p.startsWith('/student/evidence/')) crumbs.push({ label: 'Danh sách minh chứng', path: '/student/evidence' }, { label: 'Chi tiết hồ sơ' });
      else if (p === '/student/scores') crumbs.push({ label: 'Chấm điểm rèn luyện' });
      else if (p === '/student/what-can-i-claim') crumbs.push({ label: 'Chấm điểm rèn luyện', path: '/student/scores' });
      else if (p === '/student/criteria') crumbs.push({ label: 'Chấm điểm rèn luyện', path: '/student/scores' });
      else if (p === '/student/appeals') crumbs.push({ label: 'Khiếu nại điểm' });
    } else if (p.startsWith('/officer')) {
      crumbs.push({ label: 'Cán bộ', path: '/officer' });
      if (p === '/officer') return crumbs;
      if (p === '/officer/queue') crumbs.push({ label: 'Minh chứng' });
      else if (p.startsWith('/officer/review/')) crumbs.push({ label: 'Minh chứng', path: '/officer/queue' }, { label: 'Chi tiết hồ sơ' });
      else if (p === '/officer/appeals') crumbs.push({ label: 'Phúc khảo' });
      else if (p === '/officer/students') crumbs.push({ label: 'Phiếu rèn luyện' });
      else if (p === '/officer/activities' || p === '/officer/external-activities') crumbs.push({ label: 'Hoạt động & điểm danh' });
      else if (p === '/officer/criteria') crumbs.push({ label: 'Tiêu chí & Quy tắc' });
      else if (p === '/officer/reports') crumbs.push({ label: 'Điểm rèn luyện theo Lớp', path: '/officer/students' });
    } else if (p.startsWith('/admin')) {
      crumbs.push({ label: 'Quản trị hệ thống', path: '/admin' });
      if (p === '/admin') return crumbs;
      if (p === '/admin/users') crumbs.push({ label: 'Tài khoản & đơn vị' });
      else if (p === '/admin/terms') crumbs.push({ label: 'Kỳ đánh giá' });
      else if (p === '/admin/criteria' || p === '/admin/rules') crumbs.push({ label: 'Bộ tiêu chí' });
      else if (p === '/admin/knowledge-base') crumbs.push({ label: 'Tài liệu quy chế' });
      else if (p === '/admin/ai-center' || p === '/admin/ai-config' || p === '/admin/ground-truth' || p === '/admin/ai-evaluation') crumbs.push({ label: 'Trung tâm AI' });
      else if (p === '/admin/monitoring' || p === '/admin/audit-logs' || p === '/admin/health') crumbs.push({ label: 'Giám sát & Kiểm toán' });
    } else if (p.startsWith('/regulations')) {
      crumbs.push({ label: 'Hỗ trợ quy chế' });
    } else if (p === '/account') {
      crumbs.push({ label: 'Hồ sơ & Tài khoản' });
    }

    return crumbs;
  }, [location.pathname]);

  const isNavItemActive = (path: string) => {
    if (path === '/student/evidence') {
      return location.pathname === path || (location.pathname.startsWith(`${path}/`) && !location.pathname.startsWith(`${path}/new`));
    }
    return location.pathname === path || (!['/student', '/officer', '/admin'].includes(path) && location.pathname.startsWith(`${path}/`));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc] text-slate-900 font-sans antialiased">
      
      {/* 1. TOPBAR HEADER (Glassmorphism & Deep Subtle Shadow) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4 py-2.5">
          
          {/* Logo & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold"
            >
              {mobileMenuOpen ? 'Đóng' : 'Menu'}
            </button>

            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/dut-logo.png"
                alt="Logo Đại học Bách Khoa"
                className="w-9 h-9 object-contain shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                  Edu<span className="text-[#1d6fc2]">Point</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 hidden sm:block">
                  Đại học Bách Khoa – ĐH Đà Nẵng
                </span>
              </div>
            </Link>
          </div>

          {/* Controls: Term Selector, Role Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Term Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 shadow-xs transition">
              <Calendar className="w-3.5 h-3.5 text-[#1d6fc2] shrink-0" />
              <select
                value={activeTerm?.id}
                onChange={(e) => {
                  const t = terms.find((item) => item.id === e.target.value);
                  if (t) {
                    switchTerm(t);
                    const params = new URLSearchParams(location.search);
                    params.set('termId', t.id);
                    navigate({ pathname: location.pathname, search: params.toString() });
                  }
                }}
                className="bg-transparent border-none text-slate-900 font-bold focus:outline-none cursor-pointer text-xs max-w-[125px] sm:max-w-none truncate"
                title="Chọn kỳ học đánh giá"
              >
                {terms.length > 0 ? (
                  terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.status === 'ACTIVE' ? '(Hiện tại)' : ''}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {activeTerm?.name || 'Chưa có kỳ đánh giá'}
                  </option>
                )}
              </select>
            </div>

            {/* User Official Role Badge */}
            <div className="hidden sm:flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-[#1d6fc2] border border-blue-200/60 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1d6fc2] mr-1.5 animate-pulse"></span>
              {user?.role === 'STUDENT' ? 'Sinh viên' : user?.role === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị viên'}
            </div>

            {/* Notifications Button with Bell Icon */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserDropdown(false);
                }}
                className="relative p-2 text-slate-600 hover:text-[#1d6fc2] hover:bg-blue-50/70 rounded-xl transition focus:outline-none flex items-center justify-center"
                title="Thông báo"
                aria-label="Thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute 0 top-0.5 right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xs">
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
                    {notificationLoadError ? (
                      <div className="p-4 text-xs text-rose-700">Không tải được thông báo từ máy chủ.</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500">Chưa có thông báo.</div>
                    ) : notifications.map((n) => (
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
      <div className="flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-8">
        
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
                    const isActive = isNavItemActive(item.path);

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
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Term Selector */}
              <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#1d6fc2]" />
                  <span>Kỳ đánh giá</span>
                </div>
                <select
                  value={activeTerm?.id}
                  onChange={(e) => {
                    const t = terms.find((item) => item.id === e.target.value);
                    if (t) switchTerm(t);
                  }}
                  className="w-full bg-white border border-slate-200 text-slate-900 font-semibold rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                >
                  {terms.length > 0 ? (
                    terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.status === 'ACTIVE' ? '(Hiện tại)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      {activeTerm?.name || 'Chưa có kỳ đánh giá'}
                    </option>
                  )}
                </select>
              </div>
              <nav className="space-y-4 overflow-y-auto flex-1">
                {navGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const isActive = isNavItemActive(item.path);
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
