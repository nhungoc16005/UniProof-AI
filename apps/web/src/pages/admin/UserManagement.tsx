import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Search, Plus, KeyRound, Lock, Unlock } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Lỗi tải danh sách người dùng', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
    if (searchTerm) {
      const matchName = u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEmail = u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCode = u.studentCode?.includes(searchTerm);
      if (!matchName && !matchEmail && !matchCode) return false;
    }
    return true;
  });

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await apiClient.updateUser(id, { isActive: !currentActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: !currentActive } : u))
      );
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái người dùng', err);
      alert('Không thể cập nhật trạng thái tài khoản.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Người dùng & Phân quyền (A02)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tài khoản trường cấp, vai trò (Role) và phạm vi phụ trách của Cán bộ theo Khoa.
          </p>
        </div>

        <button
          onClick={() => alert('Thêm người dùng mới')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm người dùng</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên, email hoặc MSSV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="STUDENT">Sinh viên (STUDENT)</option>
            <option value="STAFF">Cán bộ Khoa (STAFF)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Đang tải danh sách người dùng...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">Không tìm thấy tài khoản nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Họ và tên</th>
                  <th className="py-3.5 px-4">Email trường cấp</th>
                  <th className="py-3.5 px-4">MSSV / Mã Cán bộ</th>
                  <th className="py-3.5 px-4">Vai trò (Role)</th>
                  <th className="py-3.5 px-4">Đơn vị / Khoa</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{u.fullName}</td>
                    <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{u.studentCode || 'STAFF'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'STAFF'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {u.faculty?.name || (u.role === 'STAFF' ? 'Khoa CNTT (Phụ trách duyệt)' : 'Khoa CNTT')}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Đang kích hoạt</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>Đã khóa</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        className={`p-1.5 rounded transition ${
                          u.isActive
                            ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => alert(`Đã gửi email khôi phục mật khẩu tới ${u.email}`)}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded transition"
                        title="Reset mật khẩu"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
