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
  ArrowRight,
  FileSpreadsheet,
  Download,
  Edit3,
  Trash2,
  FileText,
  Sparkles,
  Award,
  Eye,
  ExternalLink,
  Clock,
  Lock,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  Layers,
  BarChart3,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '../../lib/apiClient';
import { Evidence, User, Class, Criterion } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { calculateStudentConductScore } from '../../lib/ruleEngine';

export const StudentLookup: React.FC = () => {
  const { user, activeTerm } = useAuth();

  // Mode: 'CLASSES_OVERVIEW' (Danh sách Card theo Lớp) | 'CLASS_ROSTER' (Bảng điểm 1 Lớp) | 'STUDENT_DETAIL' (Phiếu 16 tiêu chí của SV)
  const [viewMode, setViewMode] = useState<'CLASSES_OVERVIEW' | 'CLASS_ROSTER' | 'STUDENT_DETAIL'>('CLASSES_OVERVIEW');

  // Classes & Selected Class State
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classData, setClassData] = useState<any>(null);
  const [isLoadingClass, setIsLoadingClass] = useState(false);

  // Class Cards Overview State (Summaries of each class)
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>('ALL');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [classSummariesMap, setClassSummariesMap] = useState<Record<string, any>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

  // Search & Filter inside Class
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRankFilter, setSelectedRankFilter] = useState<string>('ALL');

  // Single Student Lookup State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [singleStudent, setSingleStudent] = useState<User | null>(null);
  const [singleEvidences, setSingleEvidences] = useState<Evidence[]>([]);
  const [singleScoreData, setSingleScoreData] = useState<any>(null);
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);

  // Criteria & Student Detail Sub-tabs
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [studentDetailTab, setStudentDetailTab] = useState<'EVALUATION_SHEET' | 'EVIDENCES_LIST'>('EVALUATION_SHEET');
  const [selectedDetailCategory, setSelectedDetailCategory] = useState<string>('ALL');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [evidenceFilterStatus, setEvidenceFilterStatus] = useState<string>('ALL');
  const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null);

  // Modals State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit Student State
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editClassId, setEditClassId] = useState('');

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      setIsSubmittingNew(true);
      await apiClient.updateUser(editingStudent.id, {
        fullName: editFullName.trim(),
        email: editEmail.trim(),
        studentCode: editCode.trim(),
        classId: editClassId,
      });
      setShowEditStudentModal(false);
      loadClassScores(selectedClassId);
      alert('Đã cập nhật sinh viên thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật sinh viên.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!window.confirm(`Bạn có chắc muốn xóa sinh viên "${student.fullName}" (${student.studentCode}) khỏi hệ thống không?`)) return;
    try {
      await apiClient.deleteUser(student.id);
      loadClassScores(selectedClassId);
      alert('Đã xóa sinh viên thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa sinh viên này.');
    }
  };

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

  // Load criteria list for 16-criteria evaluation sheet
  useEffect(() => {
    apiClient.getCriteria()
      .then(setCriteria)
      .catch((err) => console.error('Lỗi tải danh mục tiêu chí', err));
  }, []);

  const categories = [
    { key: 'KHUNG_I', roman: 'I', name: 'Ý thức tham gia học tập', max: 20 },
    { key: 'KHUNG_II', roman: 'II', name: 'Ý thức chấp hành nội quy, quy chế, quy định', max: 25 },
    { key: 'KHUNG_III', roman: 'III', name: 'Ý thức tham gia các hoạt động chính trị, xã hội, phong trào', max: 20 },
    { key: 'KHUNG_IV', roman: 'IV', name: 'Ý thức công dân trong quan hệ cộng đồng', max: 25 },
    { key: 'KHUNG_V', roman: 'V', name: 'Ý thức và kết quả khi tham gia công tác cán bộ lớp, đoàn thể', max: 10 },
  ];

  // Rule engine score calculation for selected student
  const singleScoreCalc = useMemo(() => {
    return calculateStudentConductScore(singleEvidences);
  }, [singleEvidences]);

  const singleRating = useMemo(() => {
    const score = singleScoreCalc.totalOfficialScore;
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (score >= 80) return { label: 'Tốt', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (score >= 65) return { label: 'Khá', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 50) return { label: 'Trung bình', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Yếu', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }, [singleScoreCalc.totalOfficialScore]);

  const getEvidencesForCriterion = (c: Criterion) => {
    return singleEvidences.filter((e) => {
      if (e.criterionId === c.id || e.criterion?.id === c.id || e.criterion?.code === c.code) return true;
      if (e.aiSuggestions?.some((s) => s.criterionId === c.id || s.criterion?.code === c.code)) return true;
      if (e.reviews?.some((r) => r.criterionId === c.id || r.criterion?.code === c.code)) return true;
      return false;
    });
  };

  const filteredCriteriaForDetail = useMemo(() => {
    return criteria.filter((c) => {
      if (selectedDetailCategory !== 'ALL' && c.category !== selectedDetailCategory) return false;
      if (detailSearchQuery) {
        const q = detailSearchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesSub = c.subRules?.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesSub) return false;
      }
      return true;
    });
  }, [criteria, selectedDetailCategory, detailSearchQuery]);

  const filteredEvidencesList = useMemo(() => {
    return singleEvidences.filter((e) => {
      if (evidenceFilterStatus !== 'ALL' && e.status !== evidenceFilterStatus) return false;
      return true;
    });
  }, [singleEvidences, evidenceFilterStatus]);

  // Load summaries for all classes to display on cards
  useEffect(() => {
    if (classes.length > 0 && activeTerm?.id) {
      setIsLoadingSummaries(true);
      Promise.allSettled(
        classes.map((c) => apiClient.getClassScores(c.id, activeTerm.id))
      ).then((results) => {
        const map: Record<string, any> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            map[classes[idx].id] = res.value.summary;
          }
        });
        setClassSummariesMap(map);
      }).finally(() => {
        setIsLoadingSummaries(false);
      });
    }
  }, [classes, activeTerm?.id]);

  // Available cohorts list (e.g., K20, K21, K22, K23)
  const availableCohorts = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => { if (c.cohort) set.add(c.cohort); });
    return Array.from(set).sort();
  }, [classes]);

  // Filtered classes for Card Grid
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (selectedCohortFilter !== 'ALL' && c.cohort !== selectedCohortFilter) return false;
      if (classSearchTerm.trim()) {
        const q = classSearchTerm.toLowerCase().trim();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = (c.name || '').toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [classes, selectedCohortFilter, classSearchTerm]);

  // Overall Faculty Metrics calculated across all loaded class summaries
  const facultyOverviewMetrics = useMemo(() => {
    let totalStudents = 0;
    let totalSubmitted = 0;
    let sumScore = 0;
    let countedScores = 0;
    let totalExcellent = 0;
    let totalGood = 0;
    let totalPending = 0;

    classes.forEach(c => {
      const res = classSummariesMap[c.id];
      const s = res?.summary;
      const count = s?.totalStudents ?? ((c as any)._count?.students || 0);
      totalStudents += count;
      const submitted = s?.evaluatedCount ?? (res?.submittedStudents || 0);
      totalSubmitted += submitted;

      if (s?.avgScore && s.avgScore > 0) {
        sumScore += s.avgScore * count;
        countedScores += count;
      }
      if (s) {
        totalExcellent += s.excellentCount || 0;
        totalGood += s.goodCount || 0;
      }
      if (res?.students) {
        totalPending += res.students.reduce((acc: number, st: any) => acc + (st.pendingCount || 0), 0);
      } else if (res?.pendingCount) {
        totalPending += res.pendingCount;
      }
    });

    const totalNotSubmitted = Math.max(0, totalStudents - totalSubmitted);
    const submissionRate = totalStudents > 0 ? Math.round((totalSubmitted / totalStudents) * 100) : 0;
    const avgFacultyScore = countedScores > 0 ? (sumScore / countedScores).toFixed(1) : '—';

    return {
      totalClasses: classes.length,
      totalStudents,
      totalSubmitted,
      totalNotSubmitted,
      submissionRate,
      avgFacultyScore,
      totalExcellent,
      totalGood,
      totalPending,
    };
  }, [classes, classSummariesMap]);

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setViewMode('CLASS_ROSTER');
  };

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
      if (selectedRankFilter === 'SUBMITTED') {
        if (s.classification === 'Chưa nộp' && s.submittedCount === 0) return false;
      } else if (selectedRankFilter === 'NOT_SUBMITTED') {
        if (s.classification !== 'Chưa nộp' && s.submittedCount > 0) return false;
      } else if (selectedRankFilter !== 'ALL' && s.classification !== selectedRankFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchCode = s.studentCode.toLowerCase().includes(q);
        const matchEmail = (s.email || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchEmail) return false;
      }
      return true;
    });
  }, [classData, selectedRankFilter, searchTerm]);

  // Xuất Bảng điểm Lớp ra file Excel (.xlsx) chuẩn ĐHBK
  const handleExportExcel = () => {
    if (!classData?.students || classData.students.length === 0) {
      alert('Không có dữ liệu sinh viên trong lớp để xuất.');
      return;
    }

    const rows = filteredStudents.map((st: any, idx: number) => ({
      'STT': idx + 1,
      'Mã sinh viên': st.studentCode || '—',
      'Họ và tên': st.fullName,
      'Email': st.email,
      'Điểm rèn luyện': st.score ?? 0,
      'Xếp loại': st.classification || 'CHƯA ĐÁNH GIÁ',
      'Số minh chứng đã nộp': st.evidenceCount ?? 0,
      'Hồ sơ đã duyệt': st.approvedCount ?? 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');
    const fileName = `BangDiem_RenLuyen_${classData?.class?.code || 'Lop'}_${activeTerm?.code || 'Term'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Xuất Báo cáo Tổng hợp toàn bộ các Lớp của Khoa ra file Excel (.xlsx)
  const handleExportFacultyExcel = () => {
    if (!classes || classes.length === 0) {
      alert('Không có dữ liệu lớp học để xuất báo cáo.');
      return;
    }

    const rows = classes.map((c, idx) => {
      const s = classSummariesMap[c.id];
      const count = s?.totalStudents ?? ((c as any)._count?.students || 0);
      const submitted = s?.submittedStudents ?? 0;
      const unsubmitted = Math.max(0, count - submitted);
      return {
        'STT': idx + 1,
        'Mã lớp': c.code,
        'Tên lớp': c.name || c.code,
        'Khóa': c.cohort || '—',
        'Sĩ số': count,
        'Đã nộp': submitted,
        'Chưa nộp': unsubmitted,
        'Điểm trung bình': s?.avgScore ? s.avgScore.toFixed(1) : '—',
        'Xuất sắc (>=90)': s?.excellentCount ?? 0,
        'Tốt (80-89)': s?.goodCount ?? 0,
        'Chờ thẩm định': s?.pendingCount ?? 0,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TongHopKhoa');
    const fileName = `BangDiem_TongHop_Khoa_${activeTerm?.code || 'HK'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

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
            <span>Ban Chủ nhiệm Khoa · Quản lý Điểm Rèn Luyện theo Lớp</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {viewMode === 'CLASSES_OVERVIEW' 
              ? 'Danh Mục Lớp Sinh Hoạt & Điểm Rèn Luyện' 
              : viewMode === 'CLASS_ROSTER'
              ? `Bảng Điểm Rèn Luyện Lớp ${classData?.class?.code || ''}`
              : `Phiếu Đánh Giá Rèn Luyện · ${singleStudent?.fullName || ''}`}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'CLASSES_OVERVIEW'
              ? `Theo dõi toàn diện các lớp sinh hoạt thuộc Khoa, phân bố điểm rèn luyện và tiến độ thẩm định trong ${activeTerm?.name || 'học kỳ hiện tại'}.`
              : viewMode === 'CLASS_ROSTER'
              ? `Khóa ${classData?.class?.cohort || ''} · ${classData?.class?.name || ''} · ${activeTerm?.name || ''}`
              : `Xem chi tiết tự đánh giá 16 tiêu chí, minh chứng đính kèm và kết quả thẩm định của sinh viên.`}
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
          ) : viewMode === 'CLASS_ROSTER' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('CLASSES_OVERVIEW')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Danh sách các Lớp</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                title="Xuất bảng điểm lớp ra định dạng Excel .xlsx"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In bảng điểm</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportFacultyExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition whitespace-nowrap cursor-pointer shrink-0"
                title="Xuất bảng điểm tổng hợp tất cả các lớp của Khoa ra file Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất bảng điểm toàn Khoa (.xlsx)</span>
              </button>

              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-xs transition whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm sinh viên</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 0: DANH SÁCH CARD THEO LỚP (CLASSES OVERVIEW) */}
      {/* ========================================================================= */}
      {viewMode === 'CLASSES_OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Faculty Overall KPI Summary Cards (Executive Modern Design) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Quy mô Khoa */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Quy mô sinh hoạt
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                    {facultyOverviewMetrics.totalClasses}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">lớp</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sĩ số: <strong className="text-slate-700">{facultyOverviewMetrics.totalStudents} sinh viên</strong>
                </p>
              </div>
            </div>

            {/* KPI 2: Tiến độ nộp minh chứng */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tiến độ nộp phiếu
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1d6fc2] border border-blue-200/50">
                  {facultyOverviewMetrics.submissionRate}%
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                    {facultyOverviewMetrics.totalSubmitted}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ {facultyOverviewMetrics.totalStudents} đã nộp</span>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      style={{ width: `${facultyOverviewMetrics.submissionRate}%` }}
                      className="h-full bg-[#1d6fc2] rounded-full transition-all duration-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {facultyOverviewMetrics.totalNotSubmitted > 0 
                      ? `Còn ${facultyOverviewMetrics.totalNotSubmitted} SV chưa nộp` 
                      : 'Đã hoàn tất nộp 100%'}
                  </p>
                </div>
              </div>
            </div>

            {/* KPI 3: Điểm TB toàn Khoa */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Điểm TB toàn Khoa
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  {facultyOverviewMetrics.avgFacultyScore !== '—' ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
                        {facultyOverviewMetrics.avgFacultyScore}
                      </span>
                      <span className="text-xs text-slate-400 font-normal">/ 100đ</span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-slate-400">
                      Chưa có điểm
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {facultyOverviewMetrics.avgFacultyScore !== '—' 
                    ? 'Điểm tích lũy trung bình các lớp' 
                    : `Học kỳ ${activeTerm?.name || ''}`}
                </p>
              </div>
            </div>

            {/* KPI 4: Chờ thẩm định */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Chờ thẩm định
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    facultyOverviewMetrics.totalPending > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {facultyOverviewMetrics.totalPending}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">hồ sơ</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {facultyOverviewMetrics.totalPending > 0 
                    ? 'Cần cán bộ kiểm tra đối soát' 
                    : 'Đã hoàn tất duyệt toàn bộ'}
                </p>
              </div>
            </div>

          </div>

          {/* Cohort Filter & Class Search Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Cohort Segmented Pills */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-auto gap-1">
              <button
                onClick={() => setSelectedCohortFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCohortFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả khóa
              </button>
              {availableCohorts.map((coh) => (
                <button
                  key={coh}
                  onClick={() => setSelectedCohortFilter(coh)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCohortFilter === coh
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khóa {coh}
                </button>
              ))}
            </div>

            {/* Class Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm mã hoặc tên lớp..."
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400"
              />
            </div>

          </div>

          {/* Class Cards Grid */}
          {filteredClasses.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-400 text-xs">
              Không tìm thấy lớp sinh hoạt nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClasses.map((c) => {
                const summary = classSummariesMap[c.id];
                const studentCount = summary?.totalStudents ?? ((c as any)._count?.students || 0);
                const notSubCount = summary?.notSubmittedCount ?? (studentCount > 0 ? studentCount : 0);
                const submittedCount = Math.max(0, studentCount - notSubCount);
                const submissionRate = studentCount > 0 ? Math.round((submittedCount / studentCount) * 100) : 0;
                const avgScore = summary?.avgScore ? Number(summary.avgScore) : 0;
                const pendingCount = summary?.pendingCount || 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClass(c.id)}
                    className="group bg-white border border-slate-200/90 hover:border-[#1d6fc2] hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    {/* Top Row: Class Identity & Cohort Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1d6fc2] flex items-center justify-center shrink-0 border border-blue-200/60 font-black text-sm group-hover:scale-105 transition-transform">
                          <GraduationCap className="w-5 h-5 text-[#1d6fc2]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-900 group-hover:text-[#1d6fc2] transition-colors tracking-tight truncate">
                            {c.code}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {c.name || `Lớp sinh hoạt ${c.code}`}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                        Khóa {c.cohort || 'K21'}
                      </span>
                    </div>

                    {/* Middle: 2 Core Metrics (Điểm TB + Số lượng đã nộp) */}
                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
                      
                      {/* Metric 1: Điểm rèn luyện TB */}
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                          Điểm TB Lớp
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-slate-900 font-mono tracking-tight">
                            {avgScore > 0 ? avgScore.toFixed(1) : '—'}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">/ 100</span>
                        </div>
                      </div>

                      {/* Metric 2: Số lượng đã nộp */}
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                          Đã nộp minh chứng
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-[#1d6fc2] font-mono tracking-tight">
                            {submittedCount}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">/ {studentCount} SV</span>
                        </div>
                      </div>

                    </div>

                    {/* Progress Bar & Submission / Pending Status */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        {notSubCount > 0 ? (
                          <span className="font-semibold text-amber-700">
                            Còn {notSubCount} sinh viên chưa nộp
                          </span>
                        ) : studentCount > 0 ? (
                          <span className="font-semibold text-emerald-700">
                            100% sinh viên đã nộp
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa có sinh viên</span>
                        )}

                        {pendingCount > 0 ? (
                          <span className="font-bold text-amber-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{pendingCount} chờ duyệt</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">
                            {submissionRate}% hoàn thành
                          </span>
                        )}
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${submissionRate}%` }}
                          className={`h-full transition-all duration-500 ${
                            submissionRate === 100 ? 'bg-emerald-500' : 'bg-[#1d6fc2]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Bottom: Action Row */}
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Sỹ số: <strong className="text-slate-700">{studentCount} SV</strong>
                      </span>

                      <div className="inline-flex items-center gap-1 font-bold text-xs text-[#1d6fc2] group-hover:text-[#175ea5] group-hover:translate-x-0.5 transition-all">
                        <span>Vào bảng điểm</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: BẢNG ĐIỂM RÈN LUYỆN THEO LỚP (CLASS ROSTER) */}
      {/* ========================================================================= */}
      {viewMode === 'CLASS_ROSTER' && (
        <div className="space-y-6">
          
          {/* 1. Class Context & Quick Switcher */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lớp sinh hoạt:
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

            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Khoa: <strong className="text-slate-800">{classData?.class?.faculty?.name || 'Khoa Công nghệ Thông tin'}</strong></span>
              <span className="text-slate-300">·</span>
              <span>Học kỳ: <strong className="text-blue-700">{activeTerm?.name}</strong></span>
            </div>
          </div>

          {/* 2. Structured Metric Cards (3 Balanced Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: Tiến độ Nộp hồ sơ */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Tiến độ nộp phiếu</span>
                  <span className="text-xs font-bold text-[#1d6fc2]">{classData?.summary?.totalStudents ? Math.round(((classData?.summary?.evaluatedCount || 0) / classData?.summary?.totalStudents) * 100) : 0}%</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {classData?.summary?.evaluatedCount || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ {classData?.summary?.totalStudents || 0} sinh viên đã nộp</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    style={{ width: `${classData?.summary?.totalStudents ? Math.round(((classData?.summary?.evaluatedCount || 0) / classData?.summary?.totalStudents) * 100) : 0}%` }}
                    className="h-full bg-[#1d6fc2] rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Còn lại: <strong className="text-amber-700">{classData?.summary?.notSubmittedCount || 0} chưa nộp</strong></span>
                  <span className="text-slate-400">Sĩ số: {classData?.summary?.totalStudents || 0} SV</span>
                </div>
              </div>
            </div>

            {/* Card 2: Điểm trung bình & Trạng thái duyệt */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Điểm TB toàn lớp</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#1d6fc2] border border-blue-200/50">
                    {classData?.summary?.avgScore && classData.summary.avgScore >= 80 ? 'Loại Tốt' : classData?.summary?.avgScore && classData.summary.avgScore >= 65 ? 'Loại Khá' : classData?.summary?.avgScore && classData.summary.avgScore > 0 ? 'Trung bình' : 'Chưa có điểm'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-[#1d6fc2] font-mono">
                    {classData?.summary?.avgScore && classData.summary.avgScore > 0 ? `${classData.summary.avgScore} đ` : '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">/ 100đ</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Chờ thẩm định:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                  {classData?.students?.reduce((acc: number, s: any) => acc + (s.pendingCount || 0), 0) || 0} hồ sơ
                </span>
              </div>
            </div>

            {/* Card 3: Cơ cấu phân bổ xếp loại */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Cơ cấu xếp loại rèn luyện
                </span>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200/60">
                    <span className="text-[10px] text-purple-700 font-bold block">X.Sắc</span>
                    <span className="text-base font-black text-purple-800 font-mono mt-0.5 block">{classData?.summary?.excellentCount || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200/60">
                    <span className="text-[10px] text-[#1d6fc2] font-bold block">Tốt</span>
                    <span className="text-base font-black text-blue-900 font-mono mt-0.5 block">{classData?.summary?.goodCount || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60">
                    <span className="text-[10px] text-emerald-700 font-bold block">Khá</span>
                    <span className="text-base font-black text-emerald-800 font-mono mt-0.5 block">{classData?.summary?.fairCount || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200/60">
                    <span className="text-[10px] text-amber-700 font-bold block">T.Bình</span>
                    <span className="text-base font-black text-amber-800 font-mono mt-0.5 block">{classData?.summary?.averageCount || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200/60">
                    <span className="text-[10px] text-rose-700 font-bold block">Yếu</span>
                    <span className="text-base font-black text-rose-800 font-mono mt-0.5 block">{classData?.summary?.weakCount || 0}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                Theo quy chuẩn đánh giá ĐHBK Đà Nẵng
              </div>
            </div>

          </div>

          {/* 3. Search & Filter Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Segmented Filter Pills */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-auto gap-1">
              {[
                { id: 'ALL', label: `Tất cả (${classData?.summary?.totalStudents || 0})` },
                { id: 'SUBMITTED', label: `Đã nộp (${classData?.summary?.evaluatedCount || 0})` },
                { id: 'NOT_SUBMITTED', label: `Chưa nộp (${classData?.summary?.notSubmittedCount || 0})` },
                { id: 'Xuất sắc', label: 'Xuất sắc' },
                { id: 'Tốt', label: 'Tốt' },
                { id: 'Khá', label: 'Khá' },
                { id: 'Trung bình', label: 'Trung bình' },
                { id: 'Yếu', label: 'Yếu' },
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

            {/* In-Class Search with padding pl-9 to prevent icon overlap */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm theo MSSV hoặc họ tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>

          </div>

          {/* 4. Class Score Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="font-bold text-slate-800">
                Danh sách Sinh viên Lớp {classData?.class?.code} ({filteredStudents.length} sinh viên)
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Cập nhật theo kỳ: <strong className="text-slate-700">{activeTerm?.name}</strong>
              </span>
            </div>

            {isLoadingClass ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Đang nạp bảng điểm lớp...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Không có sinh viên nào trong lớp phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4 min-w-[110px]">MSSV</th>
                      <th className="py-3 px-4 min-w-[180px]">Họ và tên</th>
                      <th className="py-3 px-4 text-center min-w-[150px]">Tiến độ nộp minh chứng</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Chờ thẩm định</th>
                      <th className="py-3 px-4 text-center min-w-[120px]">Điểm rèn luyện</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Xếp loại</th>
                      <th className="py-3 px-4 text-right min-w-[130px]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s: any, idx: number) => {
                      const isNotSubmitted = s.classification === 'Chưa nộp' && s.submittedCount === 0;

                      // Rank badge color
                      let rankBadgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
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
                            {isNotSubmitted ? (
                              <span className="text-slate-400 font-medium italic text-[11px]">
                                Chưa nộp phiếu
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60" title="Đã duyệt">
                                  {s.approvedCount} duyệt
                                </span>
                                {s.pendingCount > 0 && (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60" title="Chờ duyệt">
                                    {s.pendingCount} chờ
                                  </span>
                                )}
                                {s.supplementCount > 0 && (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60" title="Cần bổ sung">
                                    {s.supplementCount} bổ sung
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center font-bold text-amber-700">
                            {s.pendingScore > 0 ? `+${s.pendingScore} đ` : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isNotSubmitted ? (
                              <span className="text-slate-400 font-medium text-xs">—</span>
                            ) : (
                              <span className="font-black text-slate-900 text-sm px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80">
                                {s.officialScore} đ
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rankBadgeClass}`}>
                              {s.classification}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => loadSingleStudent(s.studentCode)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#1d6fc2] hover:bg-blue-50 hover:text-[#175ea5] rounded-xl transition cursor-pointer border border-blue-200/60 hover:border-blue-300"
                              title="Xem chi tiết phiếu tự đánh giá 16 tiêu chí"
                            >
                              <span>Phiếu đánh giá</span>
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
      {/* VIEW 2: TRA CỨU HỒ SƠ ĐÁNH GIÁ & MINH CHỨNG SINH VIÊN (STUDENT DETAIL) */}
      {/* ========================================================================= */}
      {viewMode === 'STUDENT_DETAIL' && singleStudent && (
        <div className="space-y-6">
          
          {/* 1. Student Profile & Conduct Score Summary Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
            
            {/* Top row: Identity & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1d6fc2] flex items-center justify-center font-bold text-lg border border-blue-200/60 shadow-xs">
                  {singleStudent.fullName?.slice(0, 2).toUpperCase() || 'SV'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      {singleStudent.fullName}
                    </h2>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                      {singleStudent.studentCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {singleStudent.email} · Lớp: <strong className="text-slate-800">{singleStudent.class?.code || singleStudent.class?.name || 'Chưa phân lớp'}</strong> · Khóa {singleStudent.class?.cohort || 'K21'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('CLASS_ROSTER')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Trở về danh sách lớp</span>
                </button>
              </div>
            </div>

            {/* Bottom row: 3 Conduct Score KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 1: Điểm tự khai báo / AI đề xuất */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Điểm tự đánh giá / AI
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-blue-100/60 text-[#1d6fc2] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-[#1d6fc2] font-mono">
                    {singleScoreCalc.totalAiScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/ 100 điểm</span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#1d6fc2] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, singleScoreCalc.totalAiScore))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Tổng hợp từ hồ sơ sinh viên tự nộp & AI đề xuất
                </p>
              </div>

              {/* Card 2: Điểm Cán bộ đã duyệt chính thức */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/70 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Điểm duyệt chính thức
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-700 font-mono">
                    {singleScoreCalc.totalOfficialScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-emerald-600/70 font-bold">/ 100 điểm</span>
                </div>
                <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, singleScoreCalc.totalOfficialScore))}%` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-700/80 font-medium">
                  Điểm có giá trị pháp lý học kỳ {activeTerm?.name}
                </p>
              </div>

              {/* Card 3: Xếp loại học kỳ */}
              <div className="p-4 bg-purple-50/40 border border-purple-200/70 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                    Xếp loại rèn luyện
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="pt-0.5">
                  <span className={`inline-flex px-3 py-1 rounded-xl text-sm font-black border ${singleRating.color}`}>
                    {singleRating.label}
                  </span>
                </div>
                <p className="text-[10px] text-purple-700/80 font-medium pt-1">
                  Đánh giá theo Quy chế Đào tạo & Công tác sinh viên ĐHBK
                </p>
              </div>

            </div>
          </div>

          {/* 2. Sub-Tabs: Phiếu 16 tiêu chí vs Toàn bộ danh sách minh chứng */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setStudentDetailTab('EVALUATION_SHEET')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                studentDetailTab === 'EVALUATION_SHEET'
                  ? 'bg-[#1d6fc2] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Phiếu tự đánh giá điểm rèn luyện (16 tiêu chí)</span>
            </button>

            <button
              onClick={() => setStudentDetailTab('EVIDENCES_LIST')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                studentDetailTab === 'EVIDENCES_LIST'
                  ? 'bg-[#1d6fc2] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Tất cả hồ sơ minh chứng ({singleEvidences.length})</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: PHIẾU TỰ ĐÁNH GIÁ 16 TIÊU CHÍ */}
          {/* ========================================================================= */}
          {studentDetailTab === 'EVALUATION_SHEET' && (
            <div className="space-y-4">
              
              {/* Filter 5 Khung + Search Box */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailCategory('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedDetailCategory === 'ALL'
                        ? 'bg-[#1d6fc2] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả 5 khung
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedDetailCategory(cat.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        selectedDetailCategory === cat.key
                          ? 'bg-[#1d6fc2] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Khung {cat.roman} ({cat.max}đ)
                    </button>
                  ))}
                </div>

                <div className="w-full sm:w-72">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo nội dung tiêu chí..."
                      value={detailSearchQuery}
                      onChange={(e) => setDetailSearchQuery(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 16 Criteria Detailed Evaluation Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs min-w-[980px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-3 w-14 text-center border-r border-slate-200">Mục</th>
                        <th className="py-3.5 px-4 min-w-[380px] border-r border-slate-200">
                          Nội dung tiêu chí & Minh chứng sinh viên đã nộp
                        </th>
                        <th className="py-3.5 px-3 w-24 text-center border-r border-slate-200">Trần điểm</th>
                        <th className="py-3.5 px-4 w-32 text-center border-r border-slate-200 bg-blue-50/70">
                          AI / Tự chấm
                        </th>
                        <th className="py-3.5 px-4 w-32 text-center border-r border-slate-200 bg-emerald-50/70">
                          Cán bộ duyệt
                        </th>
                        <th className="py-3.5 px-3 w-36 text-center">Thẩm định</th>
                      </tr>
                    </thead>

                    <tbody>
                      {categories.map((cat, idx) => {
                        const catCriteria = filteredCriteriaForDetail.filter((c) => c.category === cat.key);
                        if (catCriteria.length === 0 && selectedDetailCategory !== 'ALL' && selectedDetailCategory !== cat.key) {
                          return null;
                        }
                        const catSummary = singleScoreCalc.categorySummaries[idx];

                        return (
                          <React.Fragment key={cat.key}>
                            {/* Master Category Row */}
                            <tr className="bg-[#fef9e7] border-y border-amber-200 font-bold text-slate-900 text-xs">
                              <td className="py-3 px-3 text-center border-r border-amber-200 font-black">
                                {cat.roman}
                              </td>
                              <td className="py-3 px-4 border-r border-amber-200" colSpan={1}>
                                {cat.name} <span className="font-normal text-slate-600">(Khung đánh giá: 0 đến {cat.max} điểm)</span>
                              </td>
                              <td className="py-3 px-3 text-center border-r border-amber-200 font-black text-amber-900">
                                {cat.max}đ
                              </td>
                              <td className="py-3 px-4 text-center border-r border-amber-200 font-black text-blue-900 bg-blue-100/50">
                                {catSummary ? catSummary.aiScore : 0} / {cat.max}đ
                              </td>
                              <td className="py-3 px-4 text-center border-r border-amber-200 font-black text-emerald-900 bg-emerald-100/50">
                                {catSummary ? catSummary.officialScore : 0} / {cat.max}đ
                              </td>
                              <td className="py-3 px-3 text-center text-slate-400 font-normal text-[11px]">
                                Theo quy chế
                              </td>
                            </tr>

                            {/* Sub Criteria Rows */}
                            {catCriteria.map((c) => {
                              const prog = singleScoreCalc.allCriteria.find((p) => p.code === c.code);
                              const aiScore = prog?.aiSuggestedScore ?? (c.maxScore ? Math.min(c.maxScore, 5) : 0);
                              const offScore = prog?.officialScore ?? 0;
                              const criterionEvidences = getEvidencesForCriterion(c);

                              return (
                                <tr key={c.id} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                                  {/* Code */}
                                  <td className="py-4 px-3 text-center font-bold text-slate-700 border-r border-slate-100 align-top">
                                    {c.code}
                                  </td>

                                  {/* Name & Evidence List */}
                                  <td className="py-4 px-4 border-r border-slate-100 space-y-3 align-top">
                                    <div>
                                      <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                                      {c.description && (
                                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          {c.description}
                                        </div>
                                      )}
                                    </div>

                                    {/* Evidences attached to this criterion */}
                                    <div className="space-y-2 pt-1">
                                      {criterionEvidences.length === 0 ? (
                                        <div className="text-[11px] text-slate-400 italic">
                                          Sinh viên chưa nộp minh chứng cho mục này.
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5">
                                          {criterionEvidences.map((ev) => {
                                            let stClass = 'bg-amber-50 text-amber-700 border-amber-200';
                                            let stText = 'Chờ thẩm định';
                                            if (ev.status === 'APPROVED') {
                                              stClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                              stText = 'Đã duyệt';
                                            } else if (ev.status === 'REJECTED') {
                                              stClass = 'bg-rose-50 text-rose-700 border-rose-200';
                                              stText = 'Từ chối';
                                            } else if (ev.status === 'NEEDS_SUPPLEMENT') {
                                              stClass = 'bg-orange-50 text-orange-700 border-orange-200';
                                              stText = 'Cần bổ sung';
                                            }

                                            return (
                                              <div
                                                key={ev.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 gap-2 hover:bg-slate-100/70 transition"
                                              >
                                                <div className="space-y-0.5">
                                                  <div className="font-bold text-slate-800 text-xs">
                                                    {ev.declaredActivityName}
                                                  </div>
                                                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                    <span>Nộp: {new Date(ev.submittedAt).toLocaleDateString('vi-VN')}</span>
                                                    <span>·</span>
                                                    <span>{ev.evidenceType}</span>
                                                    <span>·</span>
                                                    <span className={`px-1.5 py-0.2 rounded border font-bold text-[10px] ${stClass}`}>
                                                      {stText}
                                                    </span>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => setPreviewEvidence(ev)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                                    title="Xem nhanh tệp minh chứng"
                                                  >
                                                    <Eye className="w-3 h-3 text-slate-500" />
                                                    <span>Xem ảnh/tệp</span>
                                                  </button>

                                                  <Link
                                                    to={`/officer/review/${ev.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1d6fc2] hover:bg-[#175ea5] text-white text-[11px] font-bold rounded-lg shadow-xs transition"
                                                  >
                                                    <span>Thẩm định</span>
                                                    <ChevronRight className="w-3 h-3" />
                                                  </Link>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Max score */}
                                  <td className="py-4 px-3 text-center font-bold text-slate-700 border-r border-slate-100 align-top">
                                    {c.maxScore}đ
                                  </td>

                                  {/* AI / Self score */}
                                  <td className="py-4 px-4 text-center border-r border-slate-100 align-top bg-blue-50/20">
                                    <span className="font-mono font-bold text-[#1d6fc2] text-sm">
                                      {aiScore.toFixed(1)}đ
                                    </span>
                                  </td>

                                  {/* Official score */}
                                  <td className="py-4 px-4 text-center border-r border-slate-100 align-top bg-emerald-50/20">
                                    <span className="font-mono font-bold text-emerald-700 text-sm">
                                      {offScore.toFixed(1)}đ
                                    </span>
                                  </td>

                                  {/* Actions */}
                                  <td className="py-4 px-3 text-center align-top">
                                    {criterionEvidences.length > 0 ? (
                                      <Link
                                        to={`/officer/review/${criterionEvidences[0].id}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-[#1d6fc2] text-slate-700 font-bold text-xs rounded-xl transition"
                                      >
                                        <span>Đối soát</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </Link>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">Không có MC</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TẤT CẢ DANH SÁCH MINH CHỨNG CỦA SINH VIÊN */}
          {/* ========================================================================= */}
          {studentDetailTab === 'EVIDENCES_LIST' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              
              {/* Header with status filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Danh sách hồ sơ minh chứng đã nộp ({filteredEvidencesList.length} / {singleEvidences.length})
                </h3>

                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'APPROVED', label: 'Đã duyệt' },
                    { id: 'NEEDS_HUMAN_REVIEW', label: 'Chờ duyệt' },
                    { id: 'NEEDS_SUPPLEMENT', label: 'Cần bổ sung' },
                    { id: 'REJECTED', label: 'Từ chối' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setEvidenceFilterStatus(st.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        evidenceFilterStatus === st.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEvidencesList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Không tìm thấy hồ sơ minh chứng phù hợp trong mục này.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {filteredEvidencesList.map((e) => {
                    let stBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                    let stText = 'Chờ thẩm định';
                    if (e.status === 'APPROVED') {
                      stBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      stText = 'Đã duyệt';
                    } else if (e.status === 'REJECTED') {
                      stBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                      stText = 'Từ chối';
                    } else if (e.status === 'NEEDS_SUPPLEMENT') {
                      stBadge = 'bg-orange-50 text-orange-700 border-orange-200';
                      stText = 'Cần bổ sung';
                    }

                    return (
                      <div key={e.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/80 px-3 rounded-xl transition gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {e.declaredActivityName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stBadge}`}>
                              {stText}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>Mục: <strong>{e.criterion?.code || e.criterionId || 'Chưa gán'}</strong></span>
                            <span>·</span>
                            <span>Hình thức: {e.evidenceType}</span>
                            <span>·</span>
                            <span>Ngày nộp: {new Date(e.submittedAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewEvidence(e)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Xem ảnh/tệp</span>
                          </button>

                          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                            {e.reviews?.[0]?.finalScore || e.aiSuggestions?.[0]?.suggestedScore || 0} đ
                          </span>

                          <Link
                            to={`/officer/review/${e.id}`}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-lg transition shadow-xs"
                          >
                            <span>Thẩm định</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM NHANH ẢNH/FILE MINH CHỨNG */}
      {/* ========================================================================= */}
      {previewEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chi tiết Tệp Minh chứng</h3>
                <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                  {previewEvidence.declaredActivityName}
                </p>
              </div>
              <button
                onClick={() => setPreviewEvidence(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Image Preview Container */}
              <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center min-h-[260px] p-2">
                {previewEvidence.files && previewEvidence.files.length > 0 ? (
                  <img
                    src={previewEvidence.files[0].fileUrl}
                    alt={previewEvidence.declaredActivityName}
                    className="max-h-[380px] w-auto object-contain rounded-lg shadow-xs"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400 text-xs">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <span>Không tìm thấy bản xem trước của tệp đính kèm.</span>
                  </div>
                )}
              </div>

              {/* Metadata details */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-slate-400 block font-medium">Hoạt động khai báo</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">{previewEvidence.declaredActivityName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Hình thức / Vai trò</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {previewEvidence.evidenceType} · {previewEvidence.declaredRole || 'Người tham gia'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Thời gian tham gia / Nộp</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {new Date(previewEvidence.submittedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Điểm AI đề xuất</span>
                  <span className="text-blue-700 font-bold mt-0.5 block">
                    {previewEvidence.aiSuggestions?.[0]?.suggestedScore ?? 0} điểm
                  </span>
                </div>
              </div>

            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewEvidence(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
              <Link
                to={`/officer/review/${previewEvidence.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                <span>Mở trang Thẩm định</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

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

      {/* MODAL SỬA THÔNG TIN SINH VIÊN */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Sửa thông tin Sinh viên</h3>
              <button
                onClick={() => setShowEditStudentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditStudentSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">MSSV</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Email trường cấp</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Chuyển sang Lớp sinh hoạt khác</label>
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.cohort}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isSubmittingNew ? 'Đang lưu...' : 'Lưu thay đổi'}
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
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel (.xlsx)</span>
                </button>

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
