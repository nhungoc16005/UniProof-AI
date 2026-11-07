import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Notification } from '../types';
import { roleNavigation, currentNavigation, navigationHref } from '../lib/roleNavigation';

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
  const selectedTermId = new URLSearchParams(location.search).get('termId') || activeTerm?.id;
  const [workCounts, setWorkCounts] = useState<{ key: string; evidence: number; appeals: number } | null>(null);
  const countsKey = user?.id + ':' + selectedTermId + ':' + location.pathname;
  useEffect(() => {
    let cancelled = false;
    if (user?.role !== 'STAFF' || !selectedTermId) return;
    apiClient.getKpiSummary(selectedTermId).then(data => {
      if (!cancelled) setWorkCounts({ key: countsKey, evidence: data.pendingEvidences, appeals: data.pendingAppeals });
    }).catch(() => { if (!cancelled) setWorkCounts(null); });
    return () => { cancelled = true; };
  }, [countsKey, user?.role]);

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

    if (roleNavigation[user.role]) return [{ title: user.role === 'STAFF' ? 'CÁN BỘ KHOA' : 'ADMIN / CTSV', items: roleNavigation[user.role] }];

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
          { label: 'Tra cứu tiêu chí', path: '/regulations' },
        ],
      },
    ];
  }, [user]);

  const currentSection = currentNavigation(user?.role || '', location.pathname);
  const sectionHref = (path: string) => navigationHref(path, location.search, activeTerm?.id, location.pathname);

  // Dynamic Breadcrumb resolver
  const breadcrumbs = useMemo(() => {
    const p = location.pathname;
    if (currentSection) {
      const roleLabel = user?.role === 'ADMIN' ? 'Admin/CTSV' : 'Cán bộ Khoa';
      const tab = currentSection.tabs?.find(t => p === t.path || p.startsWith(t.path + '/')) || (p.startsWith('/officer/review/') ? currentSection.tabs?.find(t => t.path === '/officer/queue') : currentSection.tabs?.[0]);
      return [{ label: roleLabel, path: user?.role === 'ADMIN' ? '/admin' : '/officer' }, { label: currentSection.label, path: sectionHref(currentSection.path) }, ...(tab ? [{ label: tab.label, path: sectionHref(tab.path) }] : []), ...(/\/(assessment|review\/[^/]+|evidence\/[^/]+)$/.test(p) || /^\/admin\/results\/[^/]+$/.test(p) ? [{ label: 'Chi tiết hồ sơ' }] : [])];
    }
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
      if (p === '/officer/evaluations') crumbs.push({ label: 'Xử lý đánh giá theo lớp' });
      else if (p === '/officer/queue') crumbs.push({ label: 'Minh chứng' });
      else if (p.startsWith('/officer/review/')) crumbs.push({ label: 'Minh chứng', path: '/officer/queue' }, { label: 'Chi tiết hồ sơ' });
      else if (p === '/officer/appeals') crumbs.push({ label: 'Phúc khảo' });
      else if (p === '/officer/students') crumbs.push({ label: 'Danh sách đánh giá' });
      else if (p === '/officer/activities' || p === '/officer/external-activities') crumbs.push({ label: 'Hoạt động & điểm danh' });
      else if (p === '/officer/criteria') crumbs.push({ label: 'Tiêu chí & quy chế' });
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
  }, [location.pathname, location.search, user?.role, activeTerm?.id]);

  const isNavItemActive = (path: string) => {
    if (roleNavigation[user?.role || '']) return currentSection?.path === path;
    if (path === '/student/evidence') {
      return location.pathname === path || (location.pathname.startsWith(`${path}/`) && !location.pathname.startsWith(`${path}/new`));
    }
    return location.pathname === path || (!['/student', '/officer', '/admin'].includes(path) && location.pathname.startsWith(`${path}/`));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#0A0A0A] font-sans antialiased">
      
      {/* 1. TOPBAR HEADER (Genesis Precision Header) */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E8E8EC] transition-all">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          
          {/* Logo & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-[6px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] text-xs font-semibold border border-[#E8E8EC]"
            >
              {mobileMenuOpen ? 'Đóng' : 'Menu'}
            </button>

            <Link to="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] rounded-[6px]">
              <img
                src="/dut-logo.png"
                alt="Logo Đại học Bách Khoa"
                className="w-8 h-8 object-contain shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-base font-bold font-heading tracking-tight text-[#0A0A0A] leading-none">
                  Edu<span className="text-[#1D6FC2]">Point</span>
                </span>
                <span className="text-[10px] text-[#6B6B6B] hidden sm:block mt-0.5">
                  Đại học Bách Khoa – ĐH Đà Nẵng
                </span>
              </div>
            </Link>
          </div>

          {/* Controls: Term Selector, Role Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Term Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFFFFF] hover:bg-[#FAFAFA] border border-[#E8E8EC] rounded-[6px] text-xs font-medium text-[#0A0A0A] transition">
              <Calendar className="w-3.5 h-3.5 text-[#1D6FC2] shrink-0" />
              <select
                value={user?.role === 'STUDENT' ? activeTerm?.id : selectedTermId}
                onChange={(e) => {
                  const t = terms.find((item) => item.id === e.target.value);
                  if (t) {
                    switchTerm(t);
                    const params = new URLSearchParams(location.search);
                    params.set('termId', t.id);
                    ['classId','facultyId','state','status','filter','q','page','returnTo','jobPage','jobStatus'].forEach(key => params.delete(key));
                    let pathname = location.pathname;
                    if (/^\/officer\/students\/[^/]+\/assessment$/.test(pathname)) pathname = '/officer/students';
                    else if (pathname.startsWith('/officer/review/')) pathname = '/officer/queue';
                    else if (pathname.startsWith('/admin/results/') || pathname.startsWith('/admin/evidence/')) pathname = '/admin/results';
                    else if (/^\/student\/evidence\/[^/]+/.test(pathname)) pathname = '/student/evidence';
                    navigate({ pathname, search: params.toString() });
                  }
                }}
                className="bg-transparent border-none text-[#0A0A0A] font-semibold focus:outline-none cursor-pointer text-xs max-w-[125px] sm:max-w-none truncate"
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

            {/* User Official Role Badge (No continuous pulse) */}
            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-[6px] text-xs font-medium bg-[#F0F6FC] text-[#1D6FC2] border border-[#C2DBF2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D6FC2] mr-1.5"></span>
              {user?.role === 'STUDENT' ? 'Sinh viên' : user?.role === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị viên'}
            </div>

            {/* Notifications Button with Bell Icon */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserDropdown(false);
                }}
                className="relative p-2 text-[#6B6B6B] hover:text-[#1D6FC2] hover:bg-[#F0F6FC] rounded-[6px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2] flex items-center justify-center border border-transparent hover:border-[#E8E8EC]"
                title="Thông báo"
                aria-label="Thông báo"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-[#FFFFFF] border border-[#E8E8EC] rounded-[8px] shadow-lg z-50 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8E8EC]">
                    <span className="text-xs font-bold font-heading text-[#0A0A0A] uppercase tracking-wider">
                      Thông báo ({unreadCount})
                    </span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#1D6FC2] hover:text-[#175A9E] hover:underline font-medium"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="divide-y divide-[#E8E8EC] max-h-72 overflow-y-auto mt-1 scrollbar-thin">
                    {notificationLoadError ? (
                      <div className="p-4 text-xs text-[#DC2626]">Không tải được thông báo từ máy chủ.</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#6B6B6B]">Chưa có thông báo.</div>
                    ) : notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-[6px] text-xs transition cursor-pointer ${
                          n.isRead ? 'bg-[#FFFFFF] opacity-75' : 'bg-[#F0F6FC] font-medium'
                        }`}
                        onClick={() => {
                          setShowNotifMenu(false);
                          if (!n.isRead) void apiClient.markNotificationAsRead(n.id).then(() => setNotifications(current => current.map(item => item.id === n.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item))).catch(() => undefined);
                          if (n.targetPath?.startsWith('/') && !n.targetPath.startsWith('//')) navigate(n.targetPath);
                          else if (user?.role === 'STUDENT') navigate('/student/evidence');
                          else if (user?.role === 'STAFF') navigate('/officer/queue');
                          else navigate('/notifications');
                        }}
                      >
                        <div className="font-semibold text-[#0A0A0A]">{n.title}</div>
                        <div className="text-[#6B6B6B] text-[11px] mt-0.5">{n.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Menu */}
            <div className="relative border-l border-[#E8E8EC] pl-2">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded-[6px] hover:bg-[#FAFAFA] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FC2]"
              >
                <div className="w-7 h-7 rounded-full bg-[#1D6FC2] text-white flex items-center justify-center font-bold text-xs">
                  {user?.fullName ? user.fullName.split(' ').pop()?.[0] : 'U'}
                </div>
                <span className="text-xs font-semibold text-[#0A0A0A] hidden sm:inline">
                  {user?.fullName}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-[#FFFFFF] border border-[#E8E8EC] rounded-[8px] shadow-lg z-50 p-1.5 space-y-1 text-xs">
                  <div className="p-2.5 border-b border-[#E8E8EC]">
                    <div className="font-bold text-[#0A0A0A] truncate">{user?.fullName}</div>
                    <div className="text-[11px] text-[#6B6B6B] truncate">{user?.email}</div>
                  </div>

                  <Link
                    to="/account"
                    onClick={() => setShowUserDropdown(false)}
                    className="block px-3 py-2 text-[#0A0A0A] hover:bg-[#F0F6FC] hover:text-[#1D6FC2] rounded-[6px] transition font-medium"
                  >
                    Hồ sơ & Tài khoản
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-[#EF4444] hover:bg-[#FEF2F2] rounded-[6px] transition font-semibold"
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
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6 lg:gap-8">
        
        {/* Desktop Sidebar: Genesis Style */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-20 space-y-5">
            
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-bold font-heading text-[#9C9C9C] uppercase tracking-wider">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = isNavItemActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={sectionHref(item.path)}
                        className={`block px-3 py-2 rounded-[6px] text-xs transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#E1EDF9] text-[#1D6FC2] font-semibold border-l-2 border-[#1D6FC2]'
                            : 'text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#FFFFFF] font-medium'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-[#E8E8EC]">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-[6px] transition"
              >
                Đăng xuất
              </button>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-[#0A0A0A]/30 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-[#FFFFFF] h-full p-4 flex flex-col shadow-xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E8EC] font-bold text-sm text-[#0A0A0A]">
                <span>Menu Điều hướng</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-[#6B6B6B] hover:text-[#0A0A0A] p-1 rounded-[6px]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Term Selector */}
              <div className="p-2.5 bg-[#FAFAFA] border border-[#E8E8EC] rounded-[8px] space-y-1">
                <div className="text-[10px] font-bold text-[#9C9C9C] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#1D6FC2]" />
                  <span>Kỳ đánh giá</span>
                </div>
                <select
                  value={activeTerm?.id}
                  onChange={(e) => {
                    const t = terms.find((item) => item.id === e.target.value);
                    if (t) switchTerm(t);
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#E8E8EC] text-[#0A0A0A] font-semibold rounded-[6px] px-2 py-1.5 text-xs focus:outline-none"
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
                    <div className="px-2 text-[10px] font-bold font-heading text-[#9C9C9C] uppercase tracking-wider">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const isActive = isNavItemActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={sectionHref(item.path)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`block px-3 py-2 rounded-[6px] text-xs transition ${
                            isActive
                              ? 'bg-[#E1EDF9] text-[#1D6FC2] font-semibold border-l-2 border-[#1D6FC2]'
                              : 'text-[#6B6B6B] font-medium hover:text-[#0A0A0A]'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="pt-3 border-t border-[#E8E8EC]">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2 text-xs font-semibold text-[#EF4444] hover:bg-[#FEF2F2] rounded-[6px] text-left px-3"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pt-1">
          {/* Elegant Breadcrumb Navigation */}
          {breadcrumbs.length > 0 && (
            <nav aria-label="Đường dẫn trang" className="mb-4 flex items-center gap-1.5 text-xs text-[#6B6B6B]">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-[#9C9C9C]">/</span>}
                    {crumb.path && !isLast ? (
                      <Link to={crumb.path} className="hover:text-[#1D6FC2] transition">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-[#0A0A0A] font-semibold">{crumb.label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          {currentSection?.tabs && <section className="mb-6 space-y-3" aria-label={currentSection.label}>
            <p className="text-sm text-[#6B6B6B]">{currentSection.description}</p>
            <nav aria-label="Các mục chức năng" className="flex gap-1 overflow-x-auto border-b border-[#E8E8EC]">
              {currentSection.tabs.map((tab, index) => {
                const exactTab = currentSection.tabs?.find(t => location.pathname === t.path || location.pathname.startsWith(t.path + '/')) || (location.pathname.startsWith('/officer/review/') ? currentSection.tabs?.[1] : undefined);
                const selected = exactTab ? exactTab.path === tab.path : index === 0;
                const count = workCounts?.key === countsKey ? tab.path === '/officer/queue' ? workCounts.evidence : tab.path === '/officer/appeals' ? workCounts.appeals : undefined : undefined;
                return <Link key={tab.path} to={sectionHref(tab.path)} aria-current={selected ? 'page' : undefined} className={'shrink-0 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D6FC2] ' + (selected ? 'border-[#1D6FC2] text-[#1D6FC2]' : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A]')}>{tab.label}{typeof count === 'number' && <span className="ml-2 rounded-full bg-[#F4F4F6] px-2 py-0.5 text-xs" aria-label={count + ' việc chờ'}>{count}</span>}</Link>;
              })}
            </nav>
          </section>}
          <Outlet />
        </main>
      </div>

    </div>
  );
};
