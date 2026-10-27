import React from 'react';
import { Link } from 'react-router-dom';
import { EvaluationBoard } from '../../components/EvaluationBoard';
export const AdminDashboard: React.FC = () => <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold">Tổng quan đánh giá toàn trường</h1><p className="mt-1 text-sm text-slate-600">Phòng CTSV · Kiểm tra kết quả Khoa, công bố tạm và theo dõi phúc khảo trước khi chốt kỳ.</p></div><Link to="/admin/terms" className="rounded-lg border bg-white px-4 py-2 text-sm text-blue-700">Quản lý kỳ đánh giá</Link></header><EvaluationBoard admin /></div>;
