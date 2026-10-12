import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [studentCodeOrEmail, setStudentCodeOrEmail] = useState('102210001');
  const [password, setPassword] = useState('Student@123');
  const [selectedRole, setSelectedRole] = useState<Role>('STUDENT');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Đếm ngược khóa tạm nếu vượt quá 5 lần sai
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setErrorMsg('');
    if (role === 'STUDENT') {
      setStudentCodeOrEmail('102210001');
      setPassword('Student@123');
    } else if (role === 'STAFF') {
      setStudentCodeOrEmail('officer.cntt@dut.udn.vn');
      setPassword('Officer@123');
    } else {
      setStudentCodeOrEmail('admin@dut.udn.vn');
      setPassword('Admin@123');
    }
  };

  const executeLogin = async (loginIdentifier: string, loginPass: string, roleToUse: Role) => {
    if (lockoutSeconds > 0) return;
    setErrorMsg('');
    setIsLoading(true);

    // Map student code to email if user typed MSSV
    let emailToSubmit = loginIdentifier.trim();
    if (!emailToSubmit.includes('@')) {
      if (emailToSubmit === '102210001') {
        emailToSubmit = 'sv1.cntt@sv.dut.udn.vn';
      } else {
        emailToSubmit = `${emailToSubmit}@sv.dut.udn.vn`;
      }
    }

    const result = await login(emailToSubmit, loginPass, roleToUse);
    setIsLoading(false);

    if (result.success) {
      setFailedAttempts(0);
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (roleToUse === 'STAFF') {
        navigate('/officer', { replace: true });
      } else if (roleToUse === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        setLockoutSeconds(60);
        setErrorMsg('Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 60 giây.');
      } else {
        setErrorMsg('Mã số sinh viên hoặc mật khẩu không chính xác.');
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(studentCodeOrEmail, password, selectedRole);
  };

  const handleMicrosoftLogin = () => {
    // Quick Microsoft SSO simulation
    executeLogin('sv1.cntt@sv.dut.udn.vn', 'Student@123', 'STUDENT');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2776d5] via-[#4a94ea] to-[#9ac8fa] flex items-center justify-center p-4 sm:p-6 font-sans">
      
      {/* DUT Style Center Card */}
      <div className="bg-white rounded-[26px] shadow-2xl shadow-blue-950/25 max-w-[820px] w-full p-5 sm:p-7 grid grid-cols-1 md:grid-cols-2 gap-7 items-center transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Column: Campus Image (Tòa nhà thông minh DUT) */}
        <div className="w-full h-full min-h-[340px] sm:min-h-[420px] rounded-2xl overflow-hidden shadow-inner relative bg-slate-100 flex items-center justify-center">
          <img
            src="/dut-building.webp"
            alt="Trường Đại học Bách Khoa - Đại học Đà Nẵng"
            className="w-full h-full object-cover rounded-2xl"
          />
        </div>

        {/* Right Column: Clean Login Form */}
        <div className="flex flex-col justify-center px-1 sm:px-2">
          
          {/* Header Typography with Logo */}
          <div className="flex items-center gap-3.5 mb-6">
            <img
              src="/dut-logo.png"
              alt="Logo Đại học Bách Khoa"
              className="w-12 h-12 object-contain rounded-xl p-1 bg-white border border-slate-200 shadow-xs shrink-0"
            />
            <div className="text-left space-y-0.5">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                Hệ thống Quản lý Điểm Rèn luyện
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Trường Đại học Bách Khoa – ĐH Đà Nẵng
              </p>
            </div>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
              {errorMsg}
              {lockoutSeconds > 0 && <span className="font-bold block mt-0.5">Khóa: {lockoutSeconds}s</span>}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            <div>
              <input
                type="text"
                value={studentCodeOrEmail}
                onChange={(e) => setStudentCodeOrEmail(e.target.value)}
                placeholder="Nhập MSSV"
                className="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium placeholder:text-slate-400 transition"
                required
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium placeholder:text-slate-400 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutSeconds > 0}
              className="w-full py-3 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 transition disabled:opacity-50 mt-1 cursor-pointer"
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Divider "Hoặc đăng nhập với" */}
          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative">
              <span className="bg-white px-3 text-[11px] text-slate-400 font-medium">
                Hoặc đăng nhập với
              </span>
            </div>
          </div>

          {/* Microsoft SSO Button */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            className="w-full py-2.5 px-4 bg-[#196ebc] hover:bg-[#145ea0] active:scale-[0.99] text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition cursor-pointer"
          >
            {/* Microsoft 4-quadrant logo */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            <span>Tài khoản Microsoft</span>
          </button>

          {/* Quick Role Fill for Pair Programming / Testing */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span>Đăng nhập nhanh (Test tài khoản):</span>
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { r: 'STUDENT' as Role, label: 'Sinh viên' },
                { r: 'STAFF' as Role, label: 'Cán bộ' },
                { r: 'ADMIN' as Role, label: 'Admin' },
              ].map((item) => (
                <button
                  key={item.r}
                  type="button"
                  onClick={() => handleRoleSelect(item.r)}
                  className={`py-1.5 px-2 text-[11px] rounded-lg border text-center transition font-medium cursor-pointer ${
                    selectedRole === item.r
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
