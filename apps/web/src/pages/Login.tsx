import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setErrorMsg('');
    setIsLoading(true);

    const result = await login(loginEmail.trim(), loginPass);
    setIsLoading(false);

    if (result.success) {
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } else {
      setErrorMsg(result.error || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(email, password);
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
          
          {/* Header Typography */}
          <div className="text-center sm:text-left space-y-1 mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-snug">
              Hệ thống Quản lý Điểm Rèn luyện
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Vui lòng đăng nhập để truy cập Hệ thống
            </p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email trường"
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
              disabled={isLoading}
              className="w-full py-3 bg-[#1d6fc2] hover:bg-[#175ea5] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 transition disabled:opacity-50 mt-1 cursor-pointer"
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-right">
            <div className="text-[11px] text-slate-400">
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
