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
  RefreshCw, 
  X, 
  Check, 
  Edit3,
  UserCheck,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  FolderTree,
  ArrowLeft,
  Trash2,
  Layers,
  School,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';


export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View Mode: 'HIERARCHY' (Cây Card phân cấp Khoa -> Lớp -> SV) hoặc 'FLAT' (Bảng tìm kiếm toàn trường)
  const [viewMode, setViewMode] = useState<'HIERARCHY' | 'FLAT'>('HIERARCHY');

  // Drilldown Hierarchy States
  const [drillLevel, setDrillLevel] = useState<'FACULTIES' | 'CLASSES' | 'STUDENTS'>('FACULTIES');
  const [currentFaculty, setCurrentFaculty] = useState<Faculty | null>(null);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);

  // Flat Search & Filters State
  const [selectedFaculty, setSelectedFaculty] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Faculty Modal State
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [facultyFormCode, setFacultyFormCode] = useState('');
  const [facultyFormName, setFacultyFormName] = useState('');

  // Class Modal State
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [classFormCode, setClassFormCode] = useState('');
  const [classFormName, setClassFormName] = useState('');
  const [classFormCohort, setClassFormCohort] = useState('K21');
  const [classFormFacultyId, setClassFormFacultyId] = useState('');

  // Form State for Create User
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('STUDENT');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newClassId, setNewClassId] = useState('');

  // Bulk Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [parsedStudents, setParsedStudents] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ total: number; importedCount: number; updatedCount: number; errorCount: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Tải file Excel mẫu chuẩn ĐHBK Đà Nẵng
  const handleDownloadTemplate = () => {
    const headers = ['Mã sinh viên', 'Họ và tên', 'Email', 'Mã lớp', 'Mã khoa', 'Vai trò'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_SinhVien');
    XLSX.writeFile(wb, 'Mau_Import_SinhVien_EduPoint.xlsx');
  };

  // Đọc file Excel tải lên
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json<any>(ws);

        if (!rawRows || rawRows.length === 0) {
          setImportError('File không có dữ liệu');
          setParsedStudents([]);
          return;
        }

        // Chuẩn hóa tên cột
        const normalized = rawRows.map((row) => {
          const studentCode = row['Mã sinh viên'] || row['MSSV'] || row['studentCode'] || row['MaSV'] || '';
          const fullName = row['Họ và tên'] || row['Họ tên'] || row['fullName'] || row['HoTen'] || '';
          const email = row['Email'] || row['email'] || '';
          const classCode = row['Mã lớp'] || row['Lớp'] || row['classCode'] || row['Lop'] || '';
          const facultyCode = row['Mã khoa'] || row['Khoa'] || row['facultyCode'] || '';
          const role = (row['Vai trò'] || row['role'] || 'STUDENT').toUpperCase();

          return {
            studentCode: studentCode ? String(studentCode).trim() : undefined,
            fullName: String(fullName).trim(),
            email: String(email).trim().toLowerCase(),
            classCode: classCode ? String(classCode).trim() : undefined,
            facultyCode: facultyCode ? String(facultyCode).trim() : undefined,
            role: role === 'STAFF' ? 'STAFF' : 'STUDENT',
          };
        }).filter(item => item.fullName && item.email);

        if (normalized.length === 0) {
          setImportError('Không tìm thấy dòng dữ liệu hợp lệ (Cần có Họ tên và Email)');
          setParsedStudents([]);
          return;
        }

        setParsedStudents(normalized);
      } catch (err: any) {
        console.error('Lỗi phân tích file Excel', err);
        setImportError('Không thể đọc file Excel. Vui lòng kiểm tra định dạng.');
        setParsedStudents([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Xác nhận lưu vào hệ thống
  const handleConfirmImport = async () => {
    if (parsedStudents.length === 0) return;
    try {
      setIsImporting(true);
      setImportError('');
      const res = await apiClient.bulkImportUsers(parsedStudents);
      setImportResult(res);
      await loadMasterData();
    } catch (err: any) {
      console.error('Lỗi import', err);
      setImportError(err.response?.data?.message || err.message || 'Lỗi khi gửi yêu cầu import');
    } finally {
      setIsImporting(false);
    }
  };


  // Load initial master data
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

  // When selected faculty changes in flat mode, reset class selection if incompatible
  const handleFacultyFilterChange = (facId: string) => {
    setSelectedFaculty(facId);
    if (facId !== 'ALL') {
      const classBelongs = classes.find(c => c.id === selectedClass && c.facultyId === facId);
      if (!classBelongs) {
        setSelectedClass('ALL');
      }
    }
  };

  // Available classes in filter
  const availableClassesInFilter = useMemo(() => {
    if (selectedFaculty === 'ALL') return classes;
    return classes.filter(c => c.facultyId === selectedFaculty);
  }, [classes, selectedFaculty]);

  // Filtered Users for Flat Table
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;

      if (selectedFaculty !== 'ALL') {
        const staffFacMatch = u.facultyId === selectedFaculty;
        const studentFacMatch = u.class?.facultyId === selectedFaculty || u.class?.faculty?.id === selectedFaculty;
        if (!staffFacMatch && !studentFacMatch) return false;
      }

      if (selectedClass !== 'ALL' && u.classId !== selectedClass) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = u.fullName.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchCode = u.studentCode ? u.studentCode.toLowerCase().includes(q) : false;
        const matchClassName = u.class?.code ? u.class.code.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchCode && !matchClassName) return false;
      }

      return true;
    });
  }, [users, selectedRole, selectedFaculty, selectedClass, searchTerm]);

  // Overall Statistics KPI
  const stats = useMemo(() => {
    const total = users.length;
    const students = users.filter(u => u.role === 'STUDENT').length;
    const staff = users.filter(u => u.role === 'STAFF').length;
    const admins = users.filter(u => u.role === 'ADMIN').length;
    const active = users.filter(u => u.isActive).length;
    const locked = total - active;
    return { total, students, staff, admins, active, locked };
  }, [users]);

  // Faculty-specific statistics
  const getFacultyStats = (facultyId: string) => {
    const facClasses = classes.filter(c => c.facultyId === facultyId);
    const classIds = facClasses.map(c => c.id);
    const facStudents = users.filter(u => u.role === 'STUDENT' && u.classId && classIds.includes(u.classId));
    const facStaff = users.filter(u => u.role === 'STAFF' && u.facultyId === facultyId);
    return {
      classCount: facClasses.length,
      studentCount: facStudents.length,
      staffCount: facStaff.length,
    };
  };

  // Class-specific statistics
  const getClassStats = (classId: string) => {
    const classStudents = users.filter(u => u.role === 'STUDENT' && u.classId === classId);
    const activeCount = classStudents.filter(u => u.isActive).length;
    return {
      studentCount: classStudents.length,
      activeCount,
      lockedCount: classStudents.length - activeCount,
    };
  };

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

  // Delete User
  const handleDeleteUser = async (userToDelete: User) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khóa tài khoản "${userToDelete.fullName}" (${userToDelete.email})?\nLưu ý: Tài khoản sẽ bị khóa; lịch sử đánh giá được giữ lại.`)) {
      return;
    }
    try {
      await apiClient.updateUser(userToDelete.id, { isActive: false });
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      alert('Đã khóa tài khoản và giữ nguyên lịch sử.');
    } catch (err: any) {
      console.error('Lỗi xóa người dùng', err);
      alert(err.response?.data?.message || 'Không thể xóa người dùng này.');
    }
  };

  // Drilldown Navigation Handlers
  const handleEnterFaculty = (fac: Faculty) => {
    setCurrentFaculty(fac);
    setDrillLevel('CLASSES');
  };

  const handleEnterClass = (cls: Class) => {
    setCurrentClass(cls);
    setDrillLevel('STUDENTS');
  };

  const handleBackToFaculties = () => {
    setCurrentClass(null);
    setCurrentFaculty(null);
    setDrillLevel('FACULTIES');
  };

  const handleBackToClasses = () => {
    setCurrentClass(null);
    setDrillLevel('CLASSES');
  };

  // Open Create User Modal (prefill class/faculty if inside drilldown)
  const handleOpenCreateUserModal = (prefilledRole?: Role, prefilledFacultyId?: string, prefilledClassId?: string) => {
    setNewFullName('');
    setNewEmail('');
    setNewRole(prefilledRole || 'STUDENT');
    setNewStudentCode('');
    setNewFacultyId(prefilledFacultyId || currentFaculty?.id || faculties[0]?.id || '');
    setNewClassId(prefilledClassId || currentClass?.id || classes[0]?.id || '');
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
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Không thể tạo người dùng.';
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
        email: editingUser.email.trim().toLowerCase(),
        isActive: editingUser.isActive,
      };

      if (editingUser.role === 'STUDENT') {
        payload.studentCode = editingUser.studentCode?.trim();
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
            email: editingUser.email,
            studentCode: editingUser.studentCode,
            classId: editingUser.classId,
            facultyId: editingUser.facultyId,
            isActive: editingUser.isActive,
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

  // Faculty CRUD Handlers
  const handleOpenCreateFaculty = () => {
    setEditingFaculty(null);
    setFacultyFormCode('');
    setFacultyFormName('');
    setShowFacultyModal(true);
  };

  const handleOpenEditFaculty = (fac: Faculty) => {
    setEditingFaculty(fac);
    setFacultyFormCode(fac.code);
    setFacultyFormName(fac.name);
    setShowFacultyModal(true);
  };

  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyFormCode.trim() || !facultyFormName.trim()) {
      alert('Vui lòng nhập đầy đủ Mã Khoa và Tên Khoa.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingFaculty) {
        const updated = await apiClient.updateFaculty(editingFaculty.id, {
          code: facultyFormCode.trim().toUpperCase(),
          name: facultyFormName.trim(),
        });
        setFaculties(prev => prev.map(f => f.id === editingFaculty.id ? { ...f, ...updated } : f));
        if (currentFaculty?.id === editingFaculty.id) {
          setCurrentFaculty(prev => prev ? { ...prev, ...updated } : null);
        }
        alert('Đã cập nhật Khoa thành công.');
      } else {
        const created = await apiClient.createFaculty({
          code: facultyFormCode.trim().toUpperCase(),
          name: facultyFormName.trim(),
        });
        setFaculties(prev => [...prev, created]);
        alert(`Đã thêm Khoa: ${created.name}`);
      }
      setShowFacultyModal(false);
    } catch (err: any) {
      console.error('Lỗi lưu Khoa', err);
      alert(err.response?.data?.message || 'Không thể lưu thông tin Khoa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFaculty = async (fac: Faculty) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khóa Khoa "${fac.name}" (${fac.code})?\nLưu ý: Chỉ xóa được khi Khoa không còn Lớp và Cán bộ.`)) {
      return;
    }
    try {
      await apiClient.deleteFaculty(fac.id);
      setFaculties(prev => prev.filter(f => f.id !== fac.id));
      alert('Đã xóa Khoa thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa Khoa này.');
    }
  };

  // Class CRUD Handlers
  const handleOpenCreateClass = (facId?: string) => {
    setEditingClass(null);
    setClassFormCode('');
    setClassFormName('');
    setClassFormCohort('K21');
    setClassFormFacultyId(facId || currentFaculty?.id || faculties[0]?.id || '');
    setShowClassModal(true);
  };

  const handleOpenEditClass = (cls: Class) => {
    setEditingClass(cls);
    setClassFormCode(cls.code);
    setClassFormName(cls.name || '');
    setClassFormCohort(cls.cohort);
    setClassFormFacultyId(cls.facultyId);
    setShowClassModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classFormCode.trim() || !classFormFacultyId) {
      alert('Vui lòng nhập Mã Lớp và chọn Khoa trực thuộc.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingClass) {
        const updated = await apiClient.updateClass(editingClass.id, {
          code: classFormCode.trim().toUpperCase(),
          name: classFormName.trim() || classFormCode.trim().toUpperCase(),
          cohort: classFormCohort.trim(),
          facultyId: classFormFacultyId,
        });
        setClasses(prev => prev.map(c => c.id === editingClass.id ? { ...c, ...updated } : c));
        if (currentClass?.id === editingClass.id) {
          setCurrentClass(prev => prev ? { ...prev, ...updated } : null);
        }
        alert('Đã cập nhật Lớp sinh hoạt thành công.');
      } else {
        const created = await apiClient.createClass({
          code: classFormCode.trim().toUpperCase(),
          name: classFormName.trim() || classFormCode.trim().toUpperCase(),
          cohort: classFormCohort.trim(),
          facultyId: classFormFacultyId,
        });
        setClasses(prev => [...prev, created]);
        alert(`Đã thêm Lớp sinh hoạt: ${created.code}`);
      }
      setShowClassModal(false);
    } catch (err: any) {
      console.error('Lỗi lưu Lớp', err);
      alert(err.response?.data?.message || 'Không thể lưu thông tin Lớp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Lớp "${cls.code}"?\nLưu ý: Chỉ xóa được khi Lớp không còn sinh viên.`)) {
      return;
    }
    try {
      await apiClient.deleteClass(cls.id);
      setClasses(prev => prev.filter(c => c.id !== cls.id));
      alert('Đã xóa Lớp sinh hoạt thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa Lớp này.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1d6fc2] mb-1.5 border border-blue-200/50">
            <School className="w-3.5 h-3.5" />
            <span>Phòng Công tác Sinh viên</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Tài khoản & đơn vị
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cơ cấu tổ chức trường cấp: Khoa $\rightarrow$ Lớp sinh hoạt $\rightarrow$ Sinh viên & Cán bộ phụ trách.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle Pill */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('HIERARCHY')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'HIERARCHY'
                  ? 'bg-white text-[#1d6fc2] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Khám phá theo cây thư mục Card"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Dạng Card Phân cấp</span>
            </button>

            <button
              onClick={() => setViewMode('FLAT')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'FLAT'
                  ? 'bg-white text-[#1d6fc2] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tra cứu danh sách bảng phẳng"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tra cứu Toàn trường</span>
            </button>
          </div>

          <button
            onClick={loadMasterData}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setParsedStudents([]);
              setImportFileName('');
              setImportResult(null);
              setImportError('');
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
            title="Import danh sách người dùng từ file Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel / CSV</span>
          </button>

          <button
            onClick={() => handleOpenCreateUserModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
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
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{stats.active} hoạt động</span>
            <span className="text-slate-300">·</span>
            <span>{stats.locked} bị khóa</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Khoa / Đơn vị</span>
            <Building2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-700">{faculties.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cơ cấu đào tạo cấp Trường
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lớp sinh hoạt</span>
            <GraduationCap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{classes.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats.students} Sinh viên đang theo học
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cán bộ & Admin</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700">{stats.staff + stats.admins}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats.staff} Cán bộ Khoa · {stats.admins} Quản trị viên
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VIEW MODE: HIERARCHICAL DRILL-DOWN CARD VIEW (MẶC ĐỊNH THEO YÊU CẦU) */}
      {/* ========================================================================= */}
      {viewMode === 'HIERARCHY' && (
        <div className="space-y-4">
          
          {/* Breadcrumb Navigation Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-slate-600">
              <button
                onClick={handleBackToFaculties}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  drillLevel === 'FACULTIES'
                    ? 'bg-blue-50 text-[#1d6fc2] font-black'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                <span>Trường Đại học Bách Khoa ({faculties.length} Khoa)</span>
              </button>

              {currentFaculty && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={handleBackToClasses}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      drillLevel === 'CLASSES'
                        ? 'bg-blue-50 text-[#1d6fc2] font-black'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Khoa: {currentFaculty.name} ({currentFaculty.code})</span>
                  </button>
                </>
              )}

              {currentClass && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-black border border-emerald-200/80">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lớp: {currentClass.code} · {currentClass.cohort}</span>
                  </span>
                </>
              )}
            </div>

            {/* Back Button */}
            {drillLevel !== 'FACULTIES' && (
              <button
                onClick={drillLevel === 'STUDENTS' ? handleBackToClasses : handleBackToFaculties}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại cấp trước</span>
              </button>
            )}
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* LEVEL 1: GRID THẺ CÁC KHOA (FACULTIES) */}
          {/* ----------------------------------------------------------------------- */}
          {drillLevel === 'FACULTIES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">Danh mục các Khoa Đào tạo</h2>
                  <p className="text-xs text-slate-500">
                    Nhấp vào từng Khoa để khám phá các Lớp sinh hoạt và danh sách sinh viên bên trong.
                  </p>
                </div>

                <button
                  onClick={handleOpenCreateFaculty}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Khoa mới</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {faculties.map((fac) => {
                  const facStat = getFacultyStats(fac.id);
                  return (
                    <div
                      key={fac.id}
                      className="group bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-blue-400/80 transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Card: Code Badge & Actions */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-[#1d6fc2] font-black text-xs font-mono border border-blue-200/60">
                            {fac.code}
                          </span>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditFaculty(fac); }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Sửa thông tin Khoa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteFaculty(fac); }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa Khoa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-[#1d6fc2] transition leading-snug">
                          {fac.name}
                        </h3>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
                          <div>
                            <div className="text-base font-black text-slate-900">{facStat.classCount}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Lớp</div>
                          </div>
                          <div className="border-x border-slate-200/80">
                            <div className="text-base font-black text-emerald-700">{facStat.studentCount}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Sinh viên</div>
                          </div>
                          <div>
                            <div className="text-base font-black text-purple-700">{facStat.staffCount}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Cán bộ</div>
                          </div>
                        </div>
                      </div>

                      {/* Drill down action button */}
                      <button
                        onClick={() => handleEnterFaculty(fac)}
                        className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-[#1d6fc2] text-slate-700 hover:text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
                      >
                        <span>Vào xem các Lớp sinh hoạt ({facStat.classCount})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* LEVEL 2: GRID THẺ CÁC LỚP THUỘC KHOA (CLASSES) */}
          {/* ----------------------------------------------------------------------- */}
          {drillLevel === 'CLASSES' && currentFaculty && (
            <div className="space-y-4">
              
              {/* Faculty Info Card */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-blue-200 text-xs font-bold mb-1">
                    <Building2 className="w-4 h-4" />
                    <span>Khoa: {currentFaculty.code}</span>
                  </div>
                  <h2 className="text-xl font-black text-white">{currentFaculty.name}</h2>
                  <p className="text-xs text-blue-100/80 mt-1">
                    Cán bộ phụ trách:{' '}
                    {users.filter(u => u.role === 'STAFF' && u.facultyId === currentFaculty.id).map(u => u.fullName).join(', ') || 'Chưa phân công cán bộ'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenCreateClass(currentFaculty.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-900 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Lớp vào Khoa này</span>
                  </button>

                  <button
                    onClick={() => handleOpenCreateUserModal('STAFF', currentFaculty.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700/80 hover:bg-blue-700 text-white font-bold text-xs rounded-xl border border-blue-500/50 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gán Cán bộ</span>
                  </button>
                </div>
              </div>

              {/* Classes List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.filter(c => c.facultyId === currentFaculty.id).map((cls) => {
                  const classStat = getClassStats(cls.id);
                  return (
                    <div
                      key={cls.id}
                      className="group bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-emerald-400/80 transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs font-mono border border-emerald-200/60">
                            {cls.code}
                          </span>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditClass(cls); }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Sửa thông tin Lớp"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa Lớp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition">
                          {cls.name || cls.code}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Khóa đào tạo: <strong className="text-slate-600">{cls.cohort}</strong></p>

                        {/* Sỹ số */}
                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">Sỹ số sinh viên:</span>
                          <span className="text-sm font-black text-slate-900">{classStat.studentCount} SV</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleEnterClass(cls)}
                        className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
                      >
                        <span>Vào xem danh sách Sinh viên</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {classes.filter(c => c.facultyId === currentFaculty.id).length === 0 && (
                  <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Khoa này hiện chưa có Lớp sinh hoạt nào.</p>
                    <button
                      onClick={() => handleOpenCreateClass(currentFaculty.id)}
                      className="px-3.5 py-1.5 bg-[#1d6fc2] text-white text-xs font-bold rounded-xl"
                    >
                      Tạo Lớp đầu tiên
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* LEVEL 3: DANH SÁCH SINH VIÊN TRONG LỚP (STUDENTS) */}
          {/* ----------------------------------------------------------------------- */}
          {drillLevel === 'STUDENTS' && currentClass && (
            <div className="space-y-4">
              
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-bold mb-1">
                    <GraduationCap className="w-4 h-4" />
                    <span>Lớp: {currentClass.code} · Khóa {currentClass.cohort}</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{currentClass.name || currentClass.code}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khoa: {currentFaculty?.name} · Sỹ số: {users.filter(u => u.role === 'STUDENT' && u.classId === currentClass.id).length} sinh viên
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenCreateUserModal('STUDENT', currentFaculty?.id, currentClass.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Sinh viên vào Lớp này</span>
                  </button>
                </div>
              </div>

              {/* Table of students in this class */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3.5 px-4 w-12 text-center">STT</th>
                        <th className="py-3.5 px-4">MSSV</th>
                        <th className="py-3.5 px-4">Họ và tên</th>
                        <th className="py-3.5 px-4">Email trường cấp</th>
                        <th className="py-3.5 px-4 text-center">Trạng thái</th>
                        <th className="py-3.5 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users
                        .filter(u => u.role === 'STUDENT' && u.classId === currentClass.id)
                        .map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.studentCode || '—'}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{s.fullName}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{s.email}</td>
                            <td className="py-3.5 px-4 text-center">
                              {s.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Hoạt động</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>Bị khóa</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => setEditingUser(s)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Sửa thông tin"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleActive(s.id, s.isActive)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    s.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'
                                  }`}
                                  title={s.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                >
                                  {s.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(s)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Xóa sinh viên"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {users.filter(u => u.role === 'STUDENT' && u.classId === currentClass.id).length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Lớp này chưa có sinh viên nào. Bấm nút "Thêm Sinh viên vào Lớp này" ở trên để ghi danh.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VIEW MODE: FLAT TABLE SEARCH (TRA CỨU TOÀN TRƯỜNG CHUẨN PIXEL-PERFECT) */}
      {/* ========================================================================= */}
      {viewMode === 'FLAT' && (
        <div className="space-y-4">
          
          {/* Search & Filter Console - Căn chỉnh chính xác không bị lệch icon */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 sm:p-5 space-y-4">
            
            {/* Top Search Bar */}
            <div className="relative group">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[#1d6fc2]" />
              <input
                type="text"
                placeholder="Tìm kiếm nhanh theo Họ và tên, Email, MSSV hoặc Mã lớp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200/90 rounded-xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:border-[#1d6fc2] focus:ring-4 focus:ring-blue-500/10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              
              {/* Role Segmented Buttons */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl max-w-full gap-1 border border-slate-200/60 overflow-x-auto">
                {[
                  { id: 'ALL', label: 'Tất cả', count: stats.total },
                  { id: 'STUDENT', label: 'Sinh viên', count: stats.students, icon: GraduationCap },
                  { id: 'STAFF', label: 'Cán bộ Khoa', count: stats.staff, icon: Building2 },
                  { id: 'ADMIN', label: 'Quản trị viên', count: stats.admins, icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = selectedRole === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedRole(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#1d6fc2]' : 'text-slate-400'}`} />}
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-blue-50 text-[#1d6fc2]' : 'bg-slate-200/70 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dropdowns Khoa & Lớp chuẩn đẹp (pl-10 pr-8 không đè chữ) */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                
                {/* Faculty Selector */}
                <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                  <Building2 className="w-3.5 h-3.5 text-[#1d6fc2] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedFaculty}
                    onChange={(e) => handleFacultyFilterChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none transition"
                  >
                    <option value="ALL">Khoa: Tất cả ({faculties.length})</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Class Selector */}
                <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none transition"
                  >
                    <option value="ALL">Lớp: Tất cả ({availableClassesInFilter.length})</option>
                    {availableClassesInFilter.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.cohort}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

              </div>

            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">Người dùng</th>
                    <th className="py-3.5 px-4">Vai trò</th>
                    <th className="py-3.5 px-4">Khoa / Đơn vị</th>
                    <th className="py-3.5 px-4">Lớp sinh hoạt</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const facultyName = u.faculty?.name || u.class?.faculty?.name || 'Toàn trường';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{u.fullName}</div>
                          <div className="font-mono text-slate-400 text-[11px]">{u.email}</div>
                          {u.studentCode && (
                            <div className="text-[10px] text-blue-600 font-mono mt-0.5">MSSV: {u.studentCode}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.role === 'STUDENT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              <GraduationCap className="w-3 h-3 text-emerald-600" />
                              <span>Sinh viên</span>
                            </span>
                          )}
                          {u.role === 'STAFF' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/60">
                              <Building2 className="w-3 h-3 text-sky-600" />
                              <span>Cán bộ Khoa</span>
                            </span>
                          )}
                          {u.role === 'ADMIN' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60">
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span>Quản trị viên</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {facultyName}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.class ? (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 text-[11px]">
                              {u.class.code}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Hoạt động</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Bị khóa</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Sửa thông tin"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(u.id, u.isActive)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                u.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'
                              }`}
                              title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                            >
                              {u.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL TẠO TÀI KHOẢN NGƯỜI DÙNG */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Thêm tài khoản người dùng mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'STUDENT', label: 'Sinh viên' },
                    { id: 'STAFF', label: 'Cán bộ Khoa' },
                    { id: 'ADMIN', label: 'Quản trị viên' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setNewRole(r.id as Role)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        newRole === r.id
                          ? 'bg-blue-50 border-[#1d6fc2] text-[#1d6fc2]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn An"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email trường cấp</label>
                <input
                  type="email"
                  required
                  placeholder="VD: an.nv@dut.udn.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              {newRole === 'STUDENT' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã số sinh viên (MSSV)</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 102210099"
                      value={newStudentCode}
                      onChange={(e) => setNewStudentCode(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Lớp sinh hoạt</label>
                    <select
                      value={newClassId}
                      onChange={(e) => setNewClassId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.cohort} ({c.faculty?.name || 'Khoa'})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {newRole === 'STAFF' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khoa / Đơn vị phụ trách</label>
                  <select
                    value={newFacultyId}
                    onChange={(e) => setNewFacultyId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL SỬA TÀI KHOẢN NGƯỜI DÙNG */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Cập nhật thông tin tài khoản</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              {editingUser.role === 'STUDENT' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã số sinh viên (MSSV)</label>
                    <input
                      type="text"
                      value={editingUser.studentCode || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, studentCode: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Chuyển Lớp sinh hoạt</label>
                    <select
                      value={editingUser.classId || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, classId: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.cohort} ({c.faculty?.name || 'Khoa'})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editingUser.role === 'STAFF' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chuyển Khoa phụ trách</label>
                  <select
                    value={editingUser.facultyId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, facultyId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: true })}
                      className="text-[#1d6fc2]"
                    />
                    <span>Hoạt động</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
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

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL THÊM / SỬA KHOA */}
      {/* ========================================================================= */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingFaculty ? 'Sửa thông tin Khoa' : 'Thêm Khoa / Đơn vị mới'}
              </h3>
              <button
                onClick={() => setShowFacultyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFaculty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Khoa (Viết tắt)</label>
                <input
                  type="text"
                  required
                  placeholder="VD: CNTT, DDT, KT, CK..."
                  value={facultyFormCode}
                  onChange={(e) => setFacultyFormCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Khoa đầy đủ</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Khoa Công nghệ Thông tin"
                  value={facultyFormName}
                  onChange={(e) => setFacultyFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFacultyModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Khoa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL THÊM / SỬA LỚP */}
      {/* ========================================================================= */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingClass ? 'Sửa thông tin Lớp sinh hoạt' : 'Thêm Lớp sinh hoạt mới'}
              </h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Lớp (Duy nhất)</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 21TCLC_DT1, 20T2, 22KT1..."
                  value={classFormCode}
                  onChange={(e) => setClassFormCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Lớp (Mô tả)</label>
                <input
                  type="text"
                  placeholder="VD: Lớp Chất lượng cao Đề án Tin học K21"
                  value={classFormName}
                  onChange={(e) => setClassFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khóa học</label>
                <input
                  type="text"
                  required
                  placeholder="VD: K21, K22, K23..."
                  value={classFormCohort}
                  onChange={(e) => setClassFormCohort(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khoa trực thuộc</label>
                <select
                  value={classFormFacultyId}
                  onChange={(e) => setClassFormFacultyId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1d6fc2]"
                >
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Import Người dùng từ Excel / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">Import Người dùng / Sinh viên hàng loạt</h3>
                  <p className="text-[11px] text-slate-500">Đọc trực tiếp từ file Excel (.xlsx, .xls) hoặc CSV</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Bước 1: Tải mẫu */}
              <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs text-blue-900">
                  <span className="font-bold block">Chưa có file mẫu chuẩn của Trường?</span>
                  <span className="text-[11px] text-blue-700">Tải file mẫu có sẵn cấu trúc cột MSSV, Họ tên, Email, Mã lớp, Mã khoa.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file mẫu .xlsx</span>
                </button>
              </div>

              {/* Bước 2: Upload File */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chọn file danh sách sinh viên (.xlsx, .xls, .csv)
                </label>
                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition group">
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mb-2 transition" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                    {importFileName ? importFileName : 'Nhấn để chọn file hoặc kéo thả vào đây'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Hỗ trợ Excel và CSV</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Lỗi nếu có */}
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Kết quả import thành công */}
              {importResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-900">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã xử lý xong dữ liệu import!</span>
                  </div>
                  <div>• Tổng số dòng: <strong>{importResult.total}</strong></div>
                  <div>• Thêm mới thành công: <strong className="text-emerald-700">{importResult.importedCount}</strong> tài khoản</div>
                  <div>• Cập nhật thông tin: <strong className="text-blue-700">{importResult.updatedCount}</strong> tài khoản</div>
                  {importResult.errorCount > 0 && (
                    <div className="text-amber-700 pt-1">
                      <div>• Bỏ qua / lỗi: <strong>{importResult.errorCount}</strong> dòng:</div>
                      <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto text-[11px]">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Bước 3: Xem trước dữ liệu (Preview) */}
              {parsedStudents.length > 0 && !importResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Xem trước ({parsedStudents.length} sinh viên nhận diện)
                    </span>
                    <span className="text-[11px] text-slate-400">Hiển thị tối đa 5 dòng đầu</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="p-2">MSSV</th>
                          <th className="p-2">Họ và tên</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Lớp</th>
                          <th className="p-2">Khoa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedStudents.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-slate-700">{row.studentCode || '—'}</td>
                            <td className="p-2 font-bold text-slate-800">{row.fullName}</td>
                            <td className="p-2 text-slate-500">{row.email}</td>
                            <td className="p-2 text-slate-600">{row.classCode || '—'}</td>
                            <td className="p-2 text-slate-600">{row.facultyCode || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                {importResult ? 'Đóng' : 'Hủy'}
              </button>
              {parsedStudents.length > 0 && !importResult && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isImporting ? 'Đang lưu vào hệ thống...' : `Xác nhận Import (${parsedStudents.length} SV)`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
