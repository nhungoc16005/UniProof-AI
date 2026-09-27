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
      return mockUsers.student; // Khởi tạo mặc định
    } catch {
      return mockUsers.student;
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
        const [tList, tActive] = await Promise.all([
          apiClient.getTerms(),
          apiClient.getActiveTerm(),
        ]);
        setTerms(tList);
        setActiveTerm(tActive);

        // Khởi tạo token mẫu nếu chưa có
        if (!localStorage.getItem('edupoint_auth_token')) {
          localStorage.setItem('edupoint_auth_token', 'mock_jwt_access_token_v1');
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Failed to load initial auth data', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string, requestedRole?: Role): Promise<{ success: boolean; error?: string }> => {
    // Giả lập kiểm tra xác thực (AUTH-01)
    if (password.length < 4) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 4 ký tự.' };
    }

    let targetUser = mockUsers.student;
    const lowerEmail = email.toLowerCase();

    if (requestedRole === 'ADMIN' || lowerEmail.includes('admin') || lowerEmail.includes('nam.le')) {
      targetUser = mockUsers.admin;
    } else if (requestedRole === 'STAFF' || lowerEmail.includes('officer') || lowerEmail.includes('mai.tran') || lowerEmail.includes('canbo')) {
      targetUser = mockUsers.officer;
    } else {
      targetUser = {
        ...mockUsers.student,
        email: email || mockUsers.student.email,
      };
    }

    // Lưu phiên đăng nhập
    localStorage.setItem('edupoint_auth_token', `mock_token_${Date.now()}`);
    localStorage.setItem('edupoint_current_user', JSON.stringify(targetUser));
    setUser(targetUser);
    setIsAuthenticated(true);

    return { success: true };
  };

  const logout = () => {
    // Xóa toàn bộ token và phiên của người dùng cũ theo Definition of Done
    localStorage.removeItem('edupoint_auth_token');
    localStorage.removeItem('edupoint_current_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const switchRole = async (role: Role) => {
    const newUser = await apiClient.switchUserRole(role);
    setUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem('edupoint_auth_token', `mock_token_${Date.now()}`);
    localStorage.setItem('edupoint_current_user', JSON.stringify(newUser));
  };

  const switchTerm = async (term: Term) => {
    const newTerm = await apiClient.setActiveTerm(term);
    setActiveTerm(newTerm);
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    // Giả lập AUTH-06: Luôn thông báo thành công dù email có tồn tại hay không (chống User Enumeration)
    return {
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến hòm thư của bạn.',
    };
  };

  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    // Giả lập AUTH-07
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
