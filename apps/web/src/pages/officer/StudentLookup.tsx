import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  GraduationCap, 
  Building2, 
  Printer, 
  Plus, 
  Users, 
  ChevronRight, 
  Filter, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { Evidence, User, Class } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const StudentLookup: React.FC = () => {
  const { user, activeTerm } = useAuth();

  // Mode: 'CLASS_ROSTER' (Theo Lớp) | 'STUDENT_DETAIL' (Hồ sơ cá nhân)
  const [viewMode, setViewMode] = useState<'CLASS_ROSTER' | 'STUDENT_DETAIL'>('CLASS_ROSTER');

  // Classes & Selected Class State
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classData, setClassData] = useState<any>(null);
  const [isLoadingClass, setIsLoadingClass] = useState(false);

  // Search & Filter inside Class
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRankFilter, setSelectedRankFilter] = useState<string>('ALL');

  // Single Student Lookup State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [singleStudent, setSingleStudent] = useState<User | null>(null);
  const [singleEvidences, setSingleEvidences] = useState<Evidence[]>([]);
  const [singleScoreData, setSingleScoreData] = useState<any>(null);
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);

  // Modals State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [modalError, setModalError] = useState('');

  // 1. Initial Load: Get classes belonging to Officer's faculty
  useEffect(() => {
    const initClasses = async () => {
      try {
        const facId = user?.facultyId || undefined;
        const cls = await apiClient.getClasses(facId);
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh mục lớp', err);
      }
    };
    initClasses();
  }, [user?.facultyId]);

  // 2. Load Class Conduct Scores when selectedClassId or activeTerm changes
  const loadClassScores = async (classId: string) => {
    if (!classId) return;
    try {
      setIsLoadingClass(true);
      const res = await apiClient.getClassScores(classId, activeTerm?.id);
      setClassData(res);
    } catch (err) {
      console.error('Lỗi tải bảng điểm lớp', err);
    } finally {
      setIsLoadingClass(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      loadClassScores(selectedClassId);
    }
  }, [selectedClassId, activeTerm?.id]);

  // 3. Load Single Student Details
  const loadSingleStudent = async (studentIdOrCode: string) => {
    try {
      setIsLoadingSingle(true);
      const users = await apiClient.getUsers({ search: studentIdOrCode, role: 'STUDENT' });
      if (users.length > 0) {
        const found = users[0];
        setSingleStudent(found);
        const [evList, scoreData] = await Promise.all([
          apiClient.getEvidences({ studentId: found.id, termId: activeTerm?.id }),
          apiClient.getStudentScore(found.id, activeTerm?.id).catch(() => null),
        ]);
        setSingleEvidences(evList);
        setSingleScoreData(scoreData);
        setViewMode('STUDENT_DETAIL');
      } else {
        setSingleStudent(null);
        setSingleEvidences([]);
        setSingleScoreData(null);
      }
    } catch (err) {
      console.error('Lỗi tra cứu hồ sơ sinh viên', err);
    } finally {
      setIsLoadingSingle(false);
    }
  };

  // Filtered Students inside current class
  const filteredStudents = useMemo(() => {
    if (!classData?.students) return [];
    return classData.students.filter((s: any) => {
      if (selectedRankFilter !== 'ALL' && s.classification !== selectedRankFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchCode = s.studentCode.toLowerCase().includes(q);
        const matchEmail = s.email.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchEmail) return false;
      }
      return true;
    });
  }, [classData, selectedRankFilter, searchTerm]);

  // Handle Add Student to Class
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!newFullName.trim() || !newEmail.trim() || !newStudentCode.trim()) {
      setModalError('Vui lòng nhập đầy đủ Mã sinh viên, Họ tên và Email.');
      return;
    }

    try {
      setIsSubmittingNew(true);
      await apiClient.createUser({
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        studentCode: newStudentCode.trim(),
        role: 'STUDENT',
        classId: selectedClassId,
      });

      alert(`Đã thêm thành công sinh viên ${newFullName} vào lớp!`);
      setShowAddStudentModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewStudentCode('');
      // Reload class scores
      loadClassScores(selectedClassId);
    } catch (err: any) {
      console.error('Lỗi thêm sinh viên', err);
      const msg = err.response?.data?.error?.message || err.message || 'Không thể thêm sinh viên. Có thể MSSV hoặc Email đã tồn tại.';
      setModalError(msg);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Header Navigation & Mode Toggles */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1d6fc2] mb-1.5 border border-blue-200/50">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Ban Chủ nhiệm Khoa · Quản lý Điểm theo Lớp (O09)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Bảng Điểm Rèn Luyện Sinh Viên theo Lớp
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi tiến độ tích lũy điểm rèn luyện, xếp loại và truy vết minh chứng của từng lớp trong Khoa.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {viewMode === 'STUDENT_DETAIL' ? (
            <button
              onClick={() => setViewMode('CLASS_ROSTER')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Bảng điểm Lớp</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tiếp nhận sinh viên</span>
              </button>

              <button
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In / Xuất Bảng điểm</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: BẢNG ĐIỂM RÈN LUYỆN THEO LỚP (CLASS ROSTER) */}
      {/* ========================================================================= */}
      {viewMode === 'CLASS_ROSTER' && (
        <div className="space-y-6">
          
          {/* Class Picker & Class Summary Cards */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Chọn Lớp sinh hoạt:
                </span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.cohort} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs font-medium text-slate-500">
                Khoa: <strong className="text-slate-800">{classData?.class?.faculty?.name || 'Khoa Công nghệ Thông tin'}</strong> · {activeTerm?.name}
              </div>
            </div>

            {/* Metrics KPI of current Class */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sỹ số lớp</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{classData?.summary?.totalStudents || 0}</span>
                <span className="text-[10px] text-slate-500 font-medium">Sinh viên</span>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/50">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Điểm trung bình</span>
                <span className="text-xl font-black text-[#1d6fc2] mt-0.5 block">{classData?.summary?.avgScore || 0} đ</span>
                <span className="text-[10px] text-blue-600 font-medium">Toàn lớp</span>
              </div>

              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/50">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Xuất sắc</span>
                <span className="text-xl font-black text-purple-700 mt-0.5 block">{classData?.summary?.excellentCount || 0}</span>
                <span className="text-[10px] text-purple-600 font-medium">&ge; 90 điểm</span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/50">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Loại Tốt</span>
                <span className="text-xl font-black text-emerald-700 mt-0.5 block">{classData?.summary?.goodCount || 0}</span>
                <span className="text-[10px] text-emerald-600 font-medium">80 – 89 điểm</span>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/50">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Khá / TB</span>
                <span className="text-xl font-black text-amber-700 mt-0.5 block">
                  {(classData?.summary?.fairCount || 0) + (classData?.summary?.averageCount || 0)}
                </span>
                <span className="text-[10px] text-amber-600 font-medium">50 – 79 điểm</span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/50">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Yếu / Chưa nộp</span>
                <span className="text-xl font-black text-rose-700 mt-0.5 block">
                  {(classData?.summary?.weakCount || 0) + (classData?.summary?.notSubmittedCount || 0)}
                </span>
                <span className="text-[10px] text-rose-600 font-medium">&lt; 50 điểm</span>
              </div>
            </div>

          </div>

          {/* Search & Rank Filter Pills */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Rank Segmented Filter */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-auto gap-1">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'Xuất sắc', label: 'Xuất sắc' },
                { id: 'Tốt', label: 'Tốt' },
                { id: 'Khá', label: 'Khá' },
                { id: 'Trung bình', label: 'Trung bình' },
                { id: 'Yếu', label: 'Yếu' },
                { id: 'Chưa nộp', label: 'Chưa nộp' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setSelectedRankFilter(rf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedRankFilter === rf.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            {/* In-Class Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo MSSV hoặc tên sinh viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

          </div>

          {/* Class Score Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="font-bold text-slate-800">
                Danh sách Điểm Rèn Luyện Lớp ({filteredStudents.length} sinh viên)
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Học kỳ: <strong>{activeTerm?.name}</strong>
              </span>
            </div>

            {isLoadingClass ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Đang nạp bảng điểm lớp...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Không có sinh viên nào trong lớp phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4">MSSV</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4 text-center">Minh chứng đã nộp</th>
                      <th className="py-3 px-4 text-center">Điểm chờ duyệt</th>
                      <th className="py-3 px-4 text-center">Điểm chính thức</th>
                      <th className="py-3 px-4 text-center">Xếp loại</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s: any, idx: number) => {
                      // Rank badge color
                      let rankBadgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                      if (s.classification === 'Xuất sắc') rankBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                      else if (s.classification === 'Tốt') rankBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                      else if (s.classification === 'Khá') rankBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      else if (s.classification === 'Trung bình') rankBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      else if (s.classification === 'Yếu') rankBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                          
                          <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {s.studentCode}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 leading-snug">{s.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{s.email}</div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60" title="Đã duyệt">
                                {s.approvedCount} duyệt
                              </span>
                              {s.pendingCount > 0 && (
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60" title="Chờ duyệt">
                                  {s.pendingCount} chờ
                                </span>
                              )}
                              {s.supplementCount > 0 && (
                                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60" title="Cần bổ sung">
                                  {s.supplementCount} bổ sung
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-bold text-amber-700">
                            {s.pendingScore > 0 ? `+${s.pendingScore} đ` : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-center font-black text-slate-900 text-sm">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80">
                              {s.officialScore} đ
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rankBadgeClass}`}>
                              {s.classification}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => loadSingleStudent(s.studentCode)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#1d6fc2] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            >
                              <span>Hồ sơ minh chứng</span>
                              <ChevronRight className="w-3.5 h-3.5" />
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

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TRA CỨU HỒ SƠ MINH CHỨNG CÁ NHÂN (STUDENT DETAIL) */}
      {/* ========================================================================= */}
      {viewMode === 'STUDENT_DETAIL' && singleStudent && (
        <div className="space-y-6">
          
          {/* Student Overview Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Họ và tên sinh viên</span>
              <span className="text-slate-900 font-bold text-base mt-0.5 block">{singleStudent.fullName}</span>
              <span className="text-slate-500 font-mono text-[11px]">{singleStudent.email}</span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">MSSV / Lớp sinh hoạt</span>
              <span className="text-slate-900 font-bold text-sm mt-0.5 block font-mono">
                {singleStudent.studentCode} · {singleStudent.class?.code || singleStudent.class?.name || 'Lớp sinh hoạt'}
              </span>
              <span className="text-slate-500 text-[11px]">Khóa tuyển sinh: {singleStudent.class?.cohort || 'K21'}</span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Khoa / Đơn vị</span>
              <span className="text-slate-900 font-semibold text-sm mt-0.5 block">
                {singleStudent.faculty?.name || singleStudent.class?.faculty?.name || 'Khoa Công nghệ Thông tin'}
              </span>
            </div>

            <div className="sm:text-right">
              <span className="text-slate-400 block font-medium">Điểm rèn luyện kỳ này</span>
              <div className="text-2xl font-black text-emerald-700 mt-0.5">
                {singleScoreData?.officialScore ?? 0} đ
              </div>
              <span className="text-xs font-bold text-emerald-800">
                Xếp loại: {singleScoreData?.classification ?? 'Đang chấm'}
              </span>
            </div>
          </div>

          {/* Evidences list of this student */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Minh chứng sinh viên đã nộp trong kỳ ({singleEvidences.length})
              </h3>
            </div>

            {singleEvidences.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Sinh viên chưa nộp minh chứng nào trong học kỳ này.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {singleEvidences.map((e) => (
                  <div key={e.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl transition">
                    <div className="space-y-1">
                      <Link 
                        to={`/officer/review/${e.id}`}
                        className="font-bold text-slate-900 hover:text-[#1d6fc2] block transition text-sm"
                      >
                        {e.declaredActivityName}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Hình thức: {e.evidenceType}</span>
                        <span>·</span>
                        <span>Ngày nộp: {new Date(e.submittedAt).toLocaleDateString('vi-VN')}</span>
                        <span>·</span>
                        <span className={`font-bold ${
                          e.status === 'APPROVED' ? 'text-emerald-700' : e.status === 'REJECTED' ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          Trạng thái: {e.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {e.reviews?.[0]?.finalScore || e.aiSuggestions?.[0]?.suggestedScore || 0} đ
                      </span>
                      <Link
                        to={`/officer/review/${e.id}`}
                        className="px-3 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-lg transition"
                      >
                        Thẩm định
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL TIẾP NHẬN / THÊM SINH VIÊN VÀO LỚP */}
      {/* ========================================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tiếp nhận Sinh viên vào Lớp</h3>
                <p className="text-[11px] text-slate-500 font-bold text-[#1d6fc2]">
                  Lớp: {classes.find(c => c.id === selectedClassId)?.code}
                </p>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Mã số sinh viên (MSSV)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 102210005"
                  value={newStudentCode}
                  onChange={(e) => setNewStudentCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Họ và tên</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trần Văn Nam"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Email trường cấp</label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: 102210005@sv.dut.udn.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-[#1d6fc2]">
                Sinh viên được thêm sẽ được gán mật khẩu mặc định <code>Student@123</code> và có thể đăng nhập nộp minh chứng ngay.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  {isSubmittingNew ? 'Đang lưu...' : 'Lưu sinh viên'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL XUẤT / IN BẢNG ĐIỂM RÈN LUYỆN TỔNG HỢP CỦA LỚP */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bảng Tổng Hợp Kết Quả Điểm Rèn Luyện Lớp (Mẫu S09)</h3>
                <p className="text-[11px] text-slate-500">
                  Lớp: {classData?.class?.code} · {activeTerm?.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Xuất PDF</span>
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 text-slate-900 font-sans print:p-0">
              
              {/* Document Header */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-300">
                <div className="flex items-center gap-3">
                  <img
                    src="/dut-logo.png"
                    alt="Logo DUT"
                    className="w-14 h-14 object-contain shrink-0"
                  />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      ĐẠI HỌC ĐÀ NẴNG
                    </div>
                    <div className="text-sm font-extrabold uppercase text-slate-900">
                      TRƯỜNG ĐẠI HỌC BÁCH KHOA
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">
                      Khoa: {classData?.class?.faculty?.name}
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs space-y-0.5">
                  <div className="font-bold uppercase text-slate-800">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="font-semibold text-slate-600 text-[11px]">Độc lập – Tự do – Hạnh phúc</div>
                  <div className="text-[10px] text-slate-400 italic pt-1">Đà Nẵng, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
                </div>
              </div>

              {/* Document Title */}
              <div className="text-center space-y-1">
                <h2 className="text-base font-black uppercase text-slate-900 tracking-tight">
                  BẢNG TỔNG HỢP ĐIỂM ĐÁNH GIÁ RÈN LUYỆN SINH VIÊN
                </h2>
                <p className="text-xs text-slate-600">
                  Lớp sinh hoạt: <strong>{classData?.class?.code}</strong> · Khóa: <strong>{classData?.class?.cohort}</strong> · Học kỳ: <strong>{activeTerm?.name}</strong>
                </p>
              </div>

              {/* Printable Table */}
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="border border-slate-300 py-2 px-2 text-center w-10">STT</th>
                    <th className="border border-slate-300 py-2 px-3 w-28">MSSV</th>
                    <th className="border border-slate-300 py-2 px-3">Họ và tên</th>
                    <th className="border border-slate-300 py-2 px-3 text-center w-24">Số minh chứng</th>
                    <th className="border border-slate-300 py-2 px-3 text-center w-24">Điểm ĐRL</th>
                    <th className="border border-slate-300 py-2 px-3 text-center w-28">Xếp loại</th>
                    <th className="border border-slate-300 py-2 px-3 text-center w-24">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {classData?.students?.map((s: any, idx: number) => (
                    <tr key={s.id} className="border-b border-slate-300">
                      <td className="border border-slate-300 py-2 px-2 text-center font-medium">{idx + 1}</td>
                      <td className="border border-slate-300 py-2 px-3 font-mono font-bold">{s.studentCode}</td>
                      <td className="border border-slate-300 py-2 px-3 font-bold">{s.fullName}</td>
                      <td className="border border-slate-300 py-2 px-3 text-center">{s.submittedCount} hồ sơ</td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-black">{s.officialScore} đ</td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-bold">{s.classification}</td>
                      <td className="border border-slate-300 py-2 px-3 text-center text-[10px] text-slate-500">
                        {s.officialScore >= 90 ? 'Khen thưởng' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures Footer */}
              <div className="grid grid-cols-2 pt-6 text-center text-xs">
                <div className="space-y-16">
                  <div>
                    <div className="font-bold uppercase text-slate-800">CỐ VẤN HỌC TẬP / BAN CÁN SỰ LỚP</div>
                    <div className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                  </div>
                  <div className="font-bold text-slate-800">Lớp trưởng / Cố vấn</div>
                </div>

                <div className="space-y-16">
                  <div>
                    <div className="font-bold uppercase text-slate-800">TRƯỞNG KHOA / CÁN BỘ PHỤ TRÁCH</div>
                    <div className="text-[10px] text-slate-400 italic">(Ký và đóng dấu)</div>
                  </div>
                  <div className="font-bold text-slate-800">{user?.fullName || 'Nguyễn Văn Cán Bộ'}</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
