import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Notification } from '../types';
import {
  GraduationCap,
  Bell,
  Search,
  CheckCircle,
  FileText,
  UploadCloud,
  ListFilter,
  BarChart3,
  Award,
  BookOpen,
  HelpCircle,
  Scale,
  Users,
  Settings,
  Calendar,
  Layers,
  Database,
  Cpu,
  Activity as ActivityIcon,
  Shield,
  ChevronDown,
  LogOut,
  UserCheck,
  Building,
  Menu,
  X,
  Sparkles,
  User as UserIcon
} from 'lucide-react';

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

  // Định nghĩa menu điều hướng theo Role (Ánh xạ chuẩn theo mục 5 tài liệu FE)
  const getNavItems = () => {
    if (!user) return [];
    if (user.role === 'STAFF') {
      return [
        { label: 'Tổng quan xử lý (O01)', path: '/officer', icon: BarChart3 },
        { label: 'Hàng đợi duyệt (O02)', path: '/officer/queue', icon: ListFilter },
        { label: 'Xử lý khiếu nại (O07)', path: '/officer/appeals', icon: Scale },
        { label: 'Tra cứu sinh viên (O09)', path: '/officer/students', icon: Users },
        { label: 'Hoạt động nội bộ (O06)', path: '/officer/activities', icon: ActivityIcon },
        { label: 'Nguồn ngoài trường (O05)', path: '/officer/external-activities', icon: Building },
        { label: 'Tiêu chí & Rule (O08)', path: '/officer/criteria', icon: Layers },
        { label: 'Báo cáo thống kê (O10)', path: '/officer/reports', icon: FileText },
        { label: 'Hỏi đáp quy chế (C04)', path: '/regulations/ask', icon: HelpCircle },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        { label: 'Tổng quan trường (A01)', path: '/admin', icon: BarChart3 },
        { label: 'Quản lý người dùng (A02)', path: '/admin/users', icon: Users },
        { label: 'Dữ liệu nền & Kỳ (A03)', path: '/admin/terms', icon: Calendar },
        { label: 'Tiêu chí khung (A04)', path: '/admin/criteria', icon: Layers },
        { label: 'Rule Engine (A05)', path: '/admin/rules', icon: Settings },
        { label: 'Knowledge Base (A06)', path: '/admin/knowledge-base', icon: Database },
        { label: 'Cấu hình AI (A07)', path: '/admin/ai-config', icon: Cpu },
        { label: 'Ground Truth (A08)', path: '/admin/ground-truth', icon: FileText },
        { label: 'Đánh giá AI (A09)', path: '/admin/ai-evaluation', icon: Sparkles },
        { label: 'Audit Log (A10)', path: '/admin/audit-logs', icon: Shield },
        { label: 'Hàng đợi & Sức khỏe (A11)', path: '/admin/health', icon: ActivityIcon },
      ];
    }

    // Default: STUDENT
    return [
      { label: 'Tổng quan điểm (S01)', path: '/student', icon: Award },
      { label: 'Nộp minh chứng (S03)', path: '/student/evidence/new', icon: UploadCloud },
      { label: 'Minh chứng của tôi (S04)', path: '/student/evidence', icon: ListFilter },
      { label: 'Bảng điểm chi tiết (S09)', path: '/student/scores', icon: BarChart3 },
      { label: 'Có thể claim thêm (S08)', path: '/student/what-can-i-claim', icon: CheckCircle },
      { label: 'Tiêu chí & Quy chế (S02)', path: '/student/criteria', icon: BookOpen },
      { label: 'Khiếu nại điểm (S07)', path: '/student/appeals', icon: Scale },
      { label: 'Hỏi đáp quy chế (C04)', path: '/regulations/ask', icon: HelpCircle },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 1. TOPBAR HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-900 leading-tight">EduPoint</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">Đánh giá điểm rèn luyện minh bạch</span>
              </div>
            </Link>
          </div>

          {/* Kỳ đánh giá, Role Switcher & User Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Term Selector */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Kỳ:</span>
              <select
                value={activeTerm?.id}
                onChange={(e) => {
                  const t = terms.find((item) => item.id === e.target.value);
                  if (t) switchTerm(t);
                }}
                className="bg-transparent border-none text-slate-900 font-semibold focus:outline-none cursor-pointer"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.status === 'ACTIVE' ? '(Đang mở)' : '(Đã đóng)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Role Switcher for Testing & Verification */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => {
                  switchRole('STUDENT');
                  navigate('/student');
                }}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  user?.role === 'STUDENT'
                    ? 'bg-white text-sky-700 shadow-sm font-semibold'
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
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  user?.role === 'STAFF'
                    ? 'bg-white text-sky-700 shadow-sm font-semibold'
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
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  user?.role === 'ADMIN'
                    ? 'bg-white text-sky-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Ask Regulations Quick Action */}
            <Link
              to="/regulations/ask"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Hỏi quy chế (AI RAG)</span>
            </Link>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserDropdown(false);
                }}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"
                title="Thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 uppercase">Thông báo ({unreadCount} chưa đọc)</span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-sky-600 hover:underline"
                    >
                      Đọc tất cả
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg text-xs transition cursor-pointer ${
                          n.isRead ? 'bg-white opacity-70' : 'bg-sky-50/60 font-medium'
                        }`}
                        onClick={() => {
                          setShowNotifMenu(false);
                          if (user?.role === 'STUDENT') navigate('/student/evidence');
                          if (user?.role === 'STAFF') navigate('/officer/queue');
                        }}
                      >
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{n.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Logout Dropdown */}
            <div className="relative pl-2 border-l border-slate-200">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.fullName ? user.fullName.split(' ').pop()?.[0] : 'U'}
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 leading-none">{user?.fullName}</span>
                  <span className="text-[10px] text-slate-500 uppercase mt-0.5">{user?.role}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 space-y-1">
                  <div className="p-2 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
                      Vai trò: {user?.role}
                    </span>
                  </div>

                  <Link
                    to="/account"
                    onClick={() => setShowUserDropdown(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>Hồ sơ & Bảo mật (C03)</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CONTENT */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="sticky top-24 bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {user?.role === 'STUDENT' ? 'Cổng Sinh viên' : user?.role === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị hệ thống'}
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Logout button at bottom of sidebar */}
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-72 bg-white h-full p-4 flex flex-col shadow-xl z-10">
              <div className="flex items-center justify-between pb-4 border-b">
                <span className="font-bold text-slate-900">Menu chức năng</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <nav className="mt-4 space-y-1 overflow-y-auto flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                        isActive ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-sky-600" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất tài khoản</span>
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
