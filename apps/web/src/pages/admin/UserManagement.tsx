import React, { useState, useEffect, useMemo } from 'react';
import { User, Faculty, Class, Role } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { 
  Search, 
  Plus, 
  KeyRound, 
  Lock, 
  Unlock, 
  Building2, 
  GraduationCap, 
  Users, 
  ShieldCheck, 
  Filter, 
  RefreshCw, 
  X, 
  Check, 
  Edit3,
  UserCheck
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [selectedFaculty, setSelectedFaculty] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State for Create User
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('STUDENT');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newClassId, setNewClassId] = useState('');

  // Load all initial master data
  const loadMasterData = async () => {
    try {
      setIsLoading(true);
      const [uList, fList, cList] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getFaculties(),
        apiClient.getClasses(),
      ]);
      setUsers(uList);
      setFaculties(fList);
      setClasses(cList);
    } catch (err) {
      console.error('Lỗi tải dữ liệu người dùng và cơ cấu trường', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // When selected faculty changes, reset class selection if it doesn't belong to the faculty
  const handleFacultyFilterChange = (facId: string) => {
    setSelectedFaculty(facId);
    if (facId !== 'ALL') {
      const classBelongs = classes.find(c => c.id === selectedClass && c.facultyId === facId);
      if (!classBelongs) {
        setSelectedClass('ALL');
      }
    }
  };

  // Available classes in filter based on selected faculty
  const availableClassesInFilter = useMemo(() => {
    if (selectedFaculty === 'ALL') return classes;
    return classes.filter(c => c.facultyId === selectedFaculty);
  }, [classes, selectedFaculty]);

  // Available classes in modal based on modal's selected faculty
  const availableClassesInModal = useMemo(() => {
    if (!newFacultyId) return classes;
    return classes.filter(c => c.facultyId === newFacultyId);
  }, [classes, newFacultyId]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Role Filter
      if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;

      // 2. Faculty Filter (Handles both Staff via u.facultyId and Students via u.class.facultyId)
      if (selectedFaculty !== 'ALL') {
        const staffFacMatch = u.facultyId === selectedFaculty;
        const studentFacMatch = u.class?.facultyId === selectedFaculty || u.class?.faculty?.id === selectedFaculty;
        if (!staffFacMatch && !studentFacMatch) return false;
      }

      // 3. Class Filter
      if (selectedClass !== 'ALL' && u.classId !== selectedClass) return false;

      // 4. Search Filter (Name, Email, Student Code)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = u.fullName.toLowerCase().includes(query);
        const matchEmail = u.email.toLowerCase().includes(query);
        const matchCode = u.studentCode?.toLowerCase().includes(query);
        const matchClass = u.class?.code?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchCode && !matchClass) return false;
      }

      return true;
    });
  }, [users, selectedRole, selectedFaculty, selectedClass, searchTerm]);

  // Statistics KPI
  const stats = useMemo(() => {
    const total = users.length;
    const students = users.filter(u => u.role === 'STUDENT').length;
    const staff = users.filter(u => u.role === 'STAFF').length;
    const admins = users.filter(u => u.role === 'ADMIN').length;
    const active = users.filter(u => u.isActive).length;
    const locked = total - active;
    return { total, students, staff, admins, active, locked };
  }, [users]);

  // Toggle user active status
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

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedFaculty('ALL');
    setSelectedClass('ALL');
    setSelectedRole('ALL');
    setSearchTerm('');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setNewFullName('');
    setNewEmail('');
    setNewRole('STUDENT');
    setNewStudentCode('');
    setNewFacultyId(faculties[0]?.id || '');
    setNewClassId(classes[0]?.id || '');
    setModalError('');
    setShowCreateModal(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!newFullName.trim() || !newEmail.trim()) {
      setModalError('Vui lòng nhập đầy đủ Họ và tên và Email.');
      return;
    }

    if (newRole === 'STUDENT') {
      if (!newStudentCode.trim()) {
        setModalError('Sinh viên bắt buộc phải có Mã số sinh viên (MSSV).');
        return;
      }
      if (!newClassId) {
        setModalError('Sinh viên bắt buộc phải được gán vào một Lớp sinh hoạt.');
        return;
      }
    }

    if (newRole === 'STAFF' && !newFacultyId) {
      setModalError('Cán bộ Khoa bắt buộc phải được gán vào Khoa phụ trách.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
      };

      if (newRole === 'STUDENT') {
        payload.studentCode = newStudentCode.trim();
        payload.classId = newClassId;
      } else if (newRole === 'STAFF') {
        payload.facultyId = newFacultyId;
      }

      const created = await apiClient.createUser(payload);
      
      // Enrich with local class/faculty object if needed
      const enrichedUser: User = {
        ...created,
        class: classes.find(c => c.id === payload.classId),
        faculty: faculties.find(f => f.id === payload.facultyId),
      };

      setUsers(prev => [enrichedUser, ...prev]);
      setShowCreateModal(false);
      alert(`Đã tạo thành công tài khoản: ${enrichedUser.fullName} (${enrichedUser.email})`);
    } catch (err: any) {
      console.error('Lỗi tạo người dùng', err);
      const msg = err.response?.data?.error?.message || err.message || 'Không thể tạo người dùng. Vui lòng kiểm tra lại email/MSSV.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmitting(true);
      const payload: any = {
        fullName: editingUser.fullName.trim(),
        isActive: editingUser.isActive,
      };

      if (editingUser.role === 'STUDENT') {
        payload.classId = editingUser.classId;
      } else if (editingUser.role === 'STAFF') {
        payload.facultyId = editingUser.facultyId;
      }

      await apiClient.updateUser(editingUser.id, payload);

      setUsers(prev => prev.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            fullName: editingUser.fullName,
            classId: editingUser.classId,
            facultyId: editingUser.facultyId,
            class: classes.find(c => c.id === editingUser.classId),
            faculty: faculties.find(f => f.id === editingUser.facultyId),
          };
        }
        return u;
      }));

      setEditingUser(null);
      alert('Đã cập nhật thông tin tài khoản thành công!');
    } catch (err: any) {
      console.error('Lỗi cập nhật người dùng', err);
      alert('Không thể cập nhật người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFilterActive = selectedFaculty !== 'ALL' || selectedClass !== 'ALL' || selectedRole !== 'ALL' || searchTerm.trim() !== '';

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1d6fc2] mb-1.5 border border-blue-200/50">
            <Building2 className="w-3 h-3" />
            <span>Phòng Công tác Sinh viên · Quản trị Hệ thống (A02)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Quản trị Người dùng theo Khoa & Lớp
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân bổ cơ cấu trường cấp: Sinh viên theo Lớp sinh hoạt, Cán bộ theo Khoa phụ trách xét duyệt.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMasterData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tổng tài khoản</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats.active} hoạt động · {stats.locked} bị khóa
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sinh viên</span>
            <GraduationCap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.students}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Thuộc {classes.length} Lớp sinh hoạt
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cán bộ Khoa</span>
            <Building2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-700">{stats.staff}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Trên {faculties.length} Khoa / Đơn vị
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quản trị viên</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700">{stats.admins}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cấp Trường (Phòng CTSV)
          </div>
        </div>
      </div>

      {/* 3. Cascading Smart Filters Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-[#1d6fc2]" />
            <span>Bộ lọc Phân tầng Cơ cấu Tổ chức</span>
          </div>

          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#1d6fc2] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Faculty Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              1. Khoa / Viện phụ trách
            </label>
            <select
              value={selectedFaculty}
              onChange={(e) => handleFacultyFilterChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Tất cả các Khoa ({faculties.length})</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector (Dependent on Faculty) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              2. Lớp sinh hoạt
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Tất cả các Lớp ({availableClassesInFilter.length})</option>
              {availableClassesInFilter.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.cohort} ({c.name})
                </option>
              ))}
            </select>
          </div>

          {/* Role Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              3. Vai trò (Role)
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="STUDENT">Sinh viên (STUDENT)</option>
              <option value="STAFF">Cán bộ Khoa (STAFF)</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              4. Tìm kiếm nhanh
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Họ tên, email, MSSV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 4. Users Data Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="font-bold text-slate-800">
            Danh sách Người dùng ({filteredUsers.length} kết quả)
          </div>
          {isFilterActive && (
            <span className="text-[11px] text-slate-500 font-medium">
              Đang áp dụng bộ lọc tùy chỉnh
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Đang tải danh sách người dùng từ hệ thống...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-medium text-slate-600">Không tìm thấy tài khoản nào khớp với bộ lọc.</p>
            {isFilterActive && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1d6fc2] font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Xóa bộ lọc để xem toàn bộ
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Họ và tên</th>
                  <th className="py-3.5 px-4">MSSV / Mã Cán bộ</th>
                  <th className="py-3.5 px-4">Vai trò (Role)</th>
                  <th className="py-3.5 px-4">Khoa / Đơn vị</th>
                  <th className="py-3.5 px-4">Lớp sinh hoạt</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  // Resolve Faculty display name
                  const facultyName = u.faculty?.name || u.class?.faculty?.name || (u.role === 'ADMIN' ? 'Cấp Trường (P.CTSV)' : 'Chưa phân Khoa');
                  const facultyCode = u.faculty?.code || u.class?.faculty?.code;

                  // Resolve Class display name
                  const classDisplay = u.class ? `${u.class.code} (${u.class.cohort})` : u.role === 'STAFF' ? 'Phụ trách toàn Khoa' : 'Cấp Trường';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            u.role === 'ADMIN' 
                              ? 'bg-purple-100 text-purple-700' 
                              : u.role === 'STAFF' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {u.fullName.split(' ').pop()?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-snug">{u.fullName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Student Code / Staff Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {u.studentCode ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {u.studentCode}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-sans">
                            {u.role === 'STAFF' ? 'CÁN BỘ' : 'ADMIN'}
                          </span>
                        )}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : u.role === 'STAFF'
                              ? 'bg-blue-50 text-[#1d6fc2] border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {u.role === 'ADMIN' ? 'Quản trị viên' : u.role === 'STAFF' ? 'Cán bộ Khoa' : 'Sinh viên'}
                        </span>
                      </td>

                      {/* Faculty */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 leading-tight">
                          {facultyName}
                        </div>
                        {facultyCode && (
                          <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                            [{facultyCode}]
                          </span>
                        )}
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-4">
                        {u.class ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                            <GraduationCap className="w-3 h-3 text-emerald-600" />
                            <span>{classDisplay}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">
                            {classDisplay}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>Đã khóa</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Chỉnh sửa thông tin / Lớp"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            u.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          {u.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => alert(`Đã gửi email khôi phục mật khẩu tạm thời tới ${u.email}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                          title="Đặt lại mật khẩu"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL TẠO TÀI KHOẢN MỚI */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Thêm Người dùng & Phân cấp</h3>
                <p className="text-[11px] text-slate-500">Tạo tài khoản trường cấp gắn theo Lớp và Khoa</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                  {modalError}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Vai trò người dùng</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['STUDENT', 'STAFF', 'ADMIN'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        newRole === r
                          ? 'bg-[#1d6fc2] text-white border-[#1d6fc2] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'STUDENT' ? 'Sinh viên' : r === 'STAFF' ? 'Cán bộ Khoa' : 'Quản trị viên'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Họ và tên</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Email trường cấp</label>
                <input
                  type="email"
                  required
                  placeholder={newRole === 'STUDENT' ? 'vd: 102210003@sv.dut.udn.vn' : 'vd: cb.cntt@dut.udn.vn'}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Specific fields for Student */}
              {newRole === 'STUDENT' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Mã số sinh viên (MSSV)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 102210003"
                      value={newStudentCode}
                      onChange={(e) => setNewStudentCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Khoa</label>
                      <select
                        value={newFacultyId}
                        onChange={(e) => {
                          setNewFacultyId(e.target.value);
                          // Auto select first class of this faculty
                          const firstClass = classes.find(c => c.facultyId === e.target.value);
                          if (firstClass) setNewClassId(firstClass.id);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {faculties.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Lớp sinh hoạt</label>
                      <select
                        value={newClassId}
                        onChange={(e) => setNewClassId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {availableClassesInModal.map((c) => (
                          <option key={c.id} value={c.id}>{c.code} · {c.cohort}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Specific fields for Staff */}
              {newRole === 'STAFF' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Khoa phụ trách xét duyệt</label>
                  <select
                    value={newFacultyId}
                    onChange={(e) => setNewFacultyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-[#1d6fc2] space-y-0.5">
                <span className="font-bold block">Chính sách mật khẩu mặc định:</span>
                <span>Tài khoản mới sẽ có mật khẩu mặc định là <code>{newRole === 'STUDENT' ? 'Student@123' : newRole === 'STAFF' ? 'Officer@123' : 'Admin@123'}</code> và yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Lưu tài khoản'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL CHỈNH SỬA TÀI KHOẢN (EDIT MODAL) */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chỉnh sửa Tài khoản</h3>
                <p className="text-[11px] text-slate-500 font-mono">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {editingUser.role === 'STUDENT' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Chuyển Lớp sinh hoạt</label>
                  <select
                    value={editingUser.classId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, classId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.cohort} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingUser.role === 'STAFF' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Chuyển Khoa phụ trách</label>
                  <select
                    value={editingUser.facultyId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, facultyId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Trạng thái tài khoản</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: true })}
                      className="text-blue-600"
                    />
                    <span>Hoạt động</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={!editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: false })}
                      className="text-rose-600"
                    />
                    <span>Khóa tài khoản</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
