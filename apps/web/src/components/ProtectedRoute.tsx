import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-500">Đang kiểm tra quyền truy cập...</div>;
  }

  if (!isAuthenticated || !user) {
    // Chuyển về login và lưu lại đường dẫn đang dở theo spec C01
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Không đủ thẩm quyền -> Chuyển về dashboard tương ứng
    if (user.role === 'STAFF') return <Navigate to="/officer" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};
