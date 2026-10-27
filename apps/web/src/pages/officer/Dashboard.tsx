import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { EvaluationBoard } from '../../components/EvaluationBoard';
export const OfficerDashboard: React.FC = () => {
 const { user } = useAuth();
 return <div className="space-y-5"><header><h1 className="text-xl font-bold">Tổng quan đánh giá rèn luyện</h1><p className="mt-1 text-sm text-slate-600">{user.fullName} · {user.faculty?.name || 'Khoa phụ trách'}</p></header><EvaluationBoard compact /></div>;
};
