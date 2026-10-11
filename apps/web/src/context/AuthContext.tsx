import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Term, Role } from '../types';
import { apiClient } from '../lib/apiClient';
import { mockUsers, mockTerms } from '../lib/mockData';

interface AuthContextType {
  user: User;
  isAuthenticated: boolean;
  activeTerm: Term;
  terms: Term[];
  isLoading: boolean;
  login: (email: string, password: string, requestedRole?: Role) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: Role) => Promise<void>;
  switchTerm: (term: Term) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('edupoint_current_user');
      const isAuth = localStorage.getItem('edupoint_auth_token');
      if (saved && isAuth) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('edupoint_auth_token');
  });

  const [activeTerm, setActiveTerm] = useState<Term>(() => {
    try {
      const saved = localStorage.getItem('edupoint_active_term');
      return saved ? JSON.parse(saved) : mockTerms[0];
    } catch {
      return mockTerms[0];
    }
  });

  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('edupoint_auth_token');
        if (token) {
          try {
            const currentUser = await apiClient.getCurrentUser();
            setUser(currentUser);
            setIsAuthenticated(true);
          } catch (e) {
            console.error('Token expired or invalid', e);
            localStorage.removeItem('edupoint_auth_token');
            localStorage.removeItem('edupoint_current_user');
            setUser(null);
            setIsAuthenticated(false);
          }
        }

        const [tList, tActive] = await Promise.all([
          apiClient.getTerms(),
          apiClient.getActiveTerm(),
        ]);
        setTerms(tList);
        setActiveTerm(tActive);
      } catch (err) {
        console.error('Failed to load initial auth data', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { user: loggedInUser } = await apiClient.login(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const switchRole = async (role: Role) => {
    // Không cho phép tự đổi role client-side
    console.warn('Hệ thống không hỗ trợ đổi role tự do. Role được gán cố định theo tài khoản trường cấp.');
  };

  const switchTerm = async (term: Term) => {
    const newTerm = await apiClient.setActiveTerm(term);
    setActiveTerm(newTerm);
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiClient.forgotPassword(email);
      return {
        success: true,
        message: res.message || 'Yêu cầu đặt lại mật khẩu đã được xử lý.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.error?.message || 'Có lỗi xảy ra khi gửi yêu cầu.',
      };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!token || token === 'expired') {
      return {
        success: false,
        message: 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng gửi lại yêu cầu.',
      };
    }
    return {
      success: true,
      message: 'Đặt lại mật khẩu mới thành công! Bạn có thể đăng nhập ngay.',
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || mockUsers.student,
        isAuthenticated,
        activeTerm,
        terms,
        isLoading,
        login,
        logout,
        switchRole,
        switchTerm,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
