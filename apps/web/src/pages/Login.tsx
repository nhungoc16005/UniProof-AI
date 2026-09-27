import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Role } from '../types';

export const Login: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('an.nguyen@dut.udn.vn');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
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
      setEmail('an.nguyen@dut.udn.vn');
      setPassword('123456');
    } else if (role === 'STAFF') {
      setEmail('mai.tran@dut.udn.vn');
      setPassword('123456');
    } else {
      setEmail('nam.le@dut.udn.vn');
      setPassword('123456');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMsg('');
    setIsLoading(true);

    const result = await login(email, password, selectedRole);
    setIsLoading(false);

    if (result.success) {
      setFailedAttempts(0);
      // Chuyển hướng theo role hoặc đường dẫn đang chờ
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (selectedRole === 'STAFF') {
        navigate('/officer', { replace: true });
      } else if (selectedRole === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        setLockoutSeconds(60);
        setErrorMsg('Bạn đã nhập sai quá 5 lần. Tài khoản tạm thời bị khóa trong 60 giây vì lý do an toàn.');
      } else {
        // Thông báo chung không lộ sự tồn tại của tài khoản (Nguyên tắc C01)
        setErrorMsg(`Thông tin tài khoản hoặc mật khẩu không chính xác. (Lần thử ${newAttempts}/5)`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Side: Brand Philosophy */}
        <div className="bg-gradient-to-br from-sky-700 via-sky-800 to-indigo-900 text-white p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 shadow-inner">
              <GraduationCap className="w-7 h-7 text-sky-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">EduPoint</h1>
            <p className="text-sky-200 text-xs leading-relaxed mb-6">
              Hệ thống tự động hóa thẩm định và tính điểm rèn luyện minh bạch theo quy chế của trường Đại học.
            </p>

            <div className="space-y-3.5 pt-5 border-t border-sky-600/40 text-xs text-sky-100">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span><strong>AI hỗ trợ, Cán bộ quyết định:</strong> Đề xuất điểm rèn luyện công khai, minh bạch và có căn cứ trích dẫn rõ ràng.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span><strong>Đối chiếu OCR thông minh:</strong> Tự động phát hiện thông tin trên giấy chứng nhận và đối chiếu danh sách điểm danh nội bộ.</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-sky-300/70 pt-6">
            © 2026 EduPoint System · Trường Đại học Bách Khoa
          </div>
        </div>

        {/* Right Side: Login Form (C01) */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Đăng nhập tài khoản (C01)</h2>
            <p className="text-xs text-slate-500 mt-1">Sử dụng tài khoản email trường cấp (@dut.udn.vn)</p>
          </div>

          {/* Error / Lockout Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-start gap-2">
              {lockoutSeconds > 0 ? (
                <Clock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span>{errorMsg}</span>
                {lockoutSeconds > 0 && (
                  <strong className="block mt-1 text-rose-900">Vui lòng thử lại sau: {lockoutSeconds}s</strong>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Quick Role Fill Buttons */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chọn vai trò đăng nhập thử nghiệm:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { r: 'STUDENT' as Role, label: 'Sinh viên' },
                  { r: 'STAFF' as Role, label: 'Cán bộ Khoa' },
                  { r: 'ADMIN' as Role, label: 'Quản trị viên' },
                ].map((item) => (
                  <button
                    key={item.r}
                    type="button"
                    onClick={() => handleRoleSelect(item.r)}
                    className={`py-2 px-2 text-xs rounded-lg border font-medium transition text-center ${
                      selectedRole === item.r
                        ? 'bg-sky-50 border-sky-600 text-sky-700 ring-2 ring-sky-200 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tài khoản hoặc Email trường cấp
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nhập email @dut.udn.vn"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Mật khẩu</label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-sky-600 hover:underline font-semibold"
                >
                  Quên mật khẩu? (C02)
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutSeconds > 0}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
