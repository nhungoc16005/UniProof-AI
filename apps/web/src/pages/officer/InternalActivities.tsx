import React, { useState, useEffect, useMemo } from 'react';
import { Activity } from '../../types';
import { apiClient } from '../../lib/apiClient';
import {
  Plus,
  Upload,
  Calendar,
  MapPin,
  CheckCircle,
  Building,
  Globe,
  Edit3,
  Trash2,
  X,
  Users,
  Search,
  UserCheck,
  UserX,
  FileSpreadsheet,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface ParticipantItem {
  id: string;
  activityId: string;
  studentId: string;
  formRole: string | null;
  source: string | null;
  createdAt: string;
  student: {
    id: string;
    fullName: string;
    studentCode: string;
    email: string;
    class?: { code: string };
  };
}

export const InternalActivities: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Activity Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Activity Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLoc, setEditLoc] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Attendance Manager Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');

  // Single Add Attendance
  const [singleStudentCode, setSingleStudentCode] = useState('');
  const [singleRole, setSingleRole] = useState('THAM_GIA_CHINH');
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  // Batch Add Attendance
  const [batchCodesText, setBatchCodesText] = useState('');
  const [batchRole, setBatchRole] = useState('THAM_GIA_CHINH');
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    totalInput: number;
    addedCount: number;
    alreadyInListCount: number;
    notFoundCount: number;
    notFoundCodes?: string[];
  } | null>(null);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getActivities({ type: activeTab });
      setActivities(data);
    } catch (err) {
      console.error('Không thể tải danh sách hoạt động', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [activeTab]);

  const loadParticipants = async (actId: string) => {
    try {
      setIsLoadingParticipants(true);
      const data = await apiClient.getActivityParticipants(actId);
      setParticipants(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách điểm danh', err);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const openAttendanceManager = (act: Activity) => {
    setSelectedActivity(act);
    setParticipants([]);
    setBatchResult(null);
    setSingleStudentCode('');
    setBatchCodesText('');
    setAttendanceSearch('');
    setShowAttendanceModal(true);
    loadParticipants(act.id);
  };

  // Create Activity Handler
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newOrg.trim()) {
      alert('Vui lòng nhập đầy đủ Tên hoạt động và Đơn vị tổ chức');
      return;
    }

    try {
      setIsCreating(true);
      const created = await apiClient.createActivity({
        name: newName.trim(),
        type: newType,
        organizer: newOrg.trim(),
        startDate: newDate ? new Date(newDate).toISOString() : undefined,
        location: newLoc.trim() || undefined,
        description: newDesc.trim() || undefined,
      });

      if (created.type === activeTab) {
        setActivities((prev) => [created, ...prev]);
      }
      setShowAddModal(false);
      setNewName('');
      setNewOrg('');
      setNewDate('');
      setNewLoc('');
      setNewDesc('');
      alert('Đã tạo hoạt động thành công.');
    } catch (err: any) {
      console.error('Lỗi tạo hoạt động', err);
      alert(err.response?.data?.message || 'Không thể tạo hoạt động. Vui lòng thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

  // Update Activity Handler
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    try {
      setIsUpdating(true);
      const updated = await apiClient.updateActivity(editingActivity.id, {
        name: editName.trim(),
        organizer: editOrg.trim(),
        startDate: editDate ? new Date(editDate).toISOString() : undefined,
        location: editLoc.trim() || undefined,
        description: editDesc.trim() || undefined,
      });

      setActivities((prev) =>
        prev.map((a) => (a.id === editingActivity.id ? { ...a, ...updated } : a))
      );
      setShowEditModal(false);
      alert('Đã cập nhật hoạt động thành công.');
    } catch (err: any) {
      console.error('Lỗi cập nhật hoạt động', err);
      alert(err.response?.data?.message || 'Không thể cập nhật hoạt động.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Activity Handler
  const handleDeleteActivity = async (act: Activity) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hoạt động "${act.name}"? Dữ liệu điểm danh liên quan sẽ được xóa an toàn.`)) {
      return;
    }
    try {
      await apiClient.deleteActivity(act.id);
      setActivities((prev) => prev.filter((a) => a.id !== act.id));
      alert('Đã xóa hoạt động.');
    } catch (err: any) {
      console.error('Lỗi xóa hoạt động', err);
      alert(err.response?.data?.message || 'Không thể xóa hoạt động này.');
    }
  };

  // Add Single Attendance Handler
  const handleAddSingleAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity || !singleStudentCode.trim()) return;

    try {
      setIsAddingSingle(true);
      await apiClient.addActivityAttendance(selectedActivity.id, {
        studentCode: singleStudentCode.trim(),
        role: singleRole,
      });

      setSingleStudentCode('');
      await loadParticipants(selectedActivity.id);
      // Update participant count in activity card
      setActivities((prev) =>
        prev.map((a) =>
          a.id === selectedActivity.id
            ? { ...a, _count: { ...a._count, participants: (a._count?.participants || 0) + 1, evidences: a._count?.evidences || 0 } }
            : a
        )
      );
      alert('Đã ghi nhận điểm danh sinh viên thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể ghi nhận điểm danh. Vui lòng kiểm tra lại MSSV.');
    } finally {
      setIsAddingSingle(false);
    }
  };

  // Batch Add Attendance Handler
  const handleBatchAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    const codes = batchCodesText
      .split(/[\n,;\s]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      alert('Vui lòng dán hoặc nhập ít nhất 1 MSSV.');
      return;
    }

    try {
      setIsBatchAdding(true);
      const res = await apiClient.batchAddActivityParticipants(selectedActivity.id, {
        studentCodes: codes,
        formRole: batchRole,
      });

      setBatchResult(res);
      setBatchCodesText('');
      await loadParticipants(selectedActivity.id);
      // Reload activity count
      setActivities((prev) =>
        prev.map((a) =>
          a.id === selectedActivity.id
            ? {
                ...a,
                _count: {
                  ...a._count,
                  participants: (a._count?.participants || 0) + (res.addedCount || 0),
                  evidences: a._count?.evidences || 0,
                },
              }
            : a
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi import danh sách điểm danh.');
    } finally {
      setIsBatchAdding(false);
    }
  };

  // Delete Participant Handler
  const handleDeleteParticipant = async (participantId: string, studentName: string) => {
    if (!selectedActivity) return;
    if (!window.confirm(`Xóa sinh viên "${studentName}" khỏi danh sách điểm danh hoạt động này?`)) return;

    try {
      await apiClient.deleteActivityParticipant(selectedActivity.id, participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      setActivities((prev) =>
        prev.map((a) =>
          a.id === selectedActivity.id
            ? {
                ...a,
                _count: {
                  ...a._count,
                  participants: Math.max(0, (a._count?.participants || 1) - 1),
                  evidences: a._count?.evidences || 0,
                },
              }
            : a
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa điểm danh sinh viên này.');
    }
  };

  // Filtered activities by search query
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.organizer.toLowerCase().includes(q) ||
        (a.location && a.location.toLowerCase().includes(q))
    );
  }, [activities, searchQuery]);

  // Filtered participants in modal
  const filteredParticipants = useMemo(() => {
    if (!attendanceSearch.trim()) return participants;
    const q = attendanceSearch.toLowerCase();
    return participants.filter(
      (p) =>
        p.student.fullName.toLowerCase().includes(q) ||
        p.student.studentCode.toLowerCase().includes(q) ||
        (p.student.class?.code && p.student.class.code.toLowerCase().includes(q))
    );
  }, [participants, attendanceSearch]);

  const totalParticipantsAcross = useMemo(() => {
    return activities.reduce((sum, a) => sum + (a._count?.participants || 0), 0);
  }, [activities]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Hoạt động & Điểm danh</h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm đối chiếu dữ liệu hoạt động nội bộ và nguồn đối tác ngoài trường trên cơ sở dữ liệu thật.
          </p>
        </div>

        <button
          onClick={() => {
            setNewType(activeTab);
            setNewName('');
            setNewOrg(activeTab === 'INTERNAL' ? 'Đoàn Thanh niên - Hội Sinh viên' : '');
            setNewDate('');
            setNewLoc('');
            setNewDesc('');
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>{activeTab === 'INTERNAL' ? 'Tạo hoạt động nội bộ' : 'Thêm hoạt động ngoài trường'}</span>
        </button>
      </div>

      {/* 2. Top Metric Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {activeTab === 'INTERNAL' ? 'Hoạt động nội bộ đang mở' : 'Hoạt động ngoài trường'}
          </div>
          <div className="text-2xl font-black text-slate-900">{activities.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lưu trữ trên Real Database</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Tổng lượt sinh viên đã điểm danh
          </div>
          <div className="text-2xl font-black text-emerald-600">{totalParticipantsAcross}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tự động đối chiếu Fast-Track (L1/L2)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Loại hình phân loại
          </div>
          <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
            {activeTab === 'INTERNAL' ? (
              <>
                <Building className="w-4 h-4 text-blue-600" />
                <span>Nội bộ ĐHBK Đà Nẵng</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-indigo-600" />
                <span>Ngoại khóa & Đối tác ngoài trường</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cán bộ kiểm soát trực tiếp</div>
        </div>
      </div>

      {/* 3. Tab Switcher & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('INTERNAL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'INTERNAL'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Hoạt động nội bộ</span>
          </button>

          <button
            onClick={() => setActiveTab('EXTERNAL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'EXTERNAL'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Nguồn ngoài trường & Đơn vị đối tác</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoạt động, đơn vị..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* 4. Activity Cards Grid */}
      {isLoading ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-medium">Đang tải danh sách hoạt động từ cơ sở dữ liệu...</span>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-3">
          <p className="text-xs text-slate-500 font-medium">
            {searchQuery
              ? 'Không tìm thấy hoạt động nào phù hợp với từ khóa tìm kiếm.'
              : activeTab === 'INTERNAL'
              ? 'Chưa có hoạt động nội bộ nào trong hệ thống.'
              : 'Chưa có hoạt động ngoài trường nào được ghi nhận.'}
          </p>
          <button
            onClick={() => {
              setNewType(activeTab);
              setNewName('');
              setNewOrg(activeTab === 'INTERNAL' ? 'Đoàn Thanh niên - Hội Sinh viên' : '');
              setNewDate('');
              setNewLoc('');
              setNewDesc('');
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-100 transition"
          >
            Thêm hoạt động đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredActivities.map((act) => {
            const participantCount = act._count?.participants || 0;
            const evidenceCount = act._count?.evidences || 0;

            return (
              <div
                key={act.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        act.type === 'INTERNAL'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {act.type === 'INTERNAL' ? 'Nội bộ trường' : 'Ngoại khóa / Đối tác'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingActivity(act);
                          setEditName(act.name);
                          setEditOrg(act.organizer);
                          setEditLoc(act.location || '');
                          setEditDesc(act.description || '');
                          setEditDate(act.startDate ? new Date(act.startDate).toISOString().slice(0, 10) : '');
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Chỉnh sửa hoạt động"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(act)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa hoạt động"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2.5 leading-snug">{act.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Đơn vị chủ trì: <strong className="text-slate-700 font-semibold">{act.organizer}</strong></p>

                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{act.startDate ? new Date(act.startDate).toLocaleDateString('vi-VN') : 'Chưa định ngày'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{act.location || 'Khuôn viên trường'}</span>
                    </span>
                  </div>

                  {act.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-lg">
                      {act.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{participantCount} sinh viên</span>
                    </span>
                    {evidenceCount > 0 && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        {evidenceCount} minh chứng nộp
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openAttendanceManager(act)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Điểm danh & Danh sách</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modal: Quản lý Điểm danh & Danh sách tham gia (Real DB) */}
      {showAttendanceModal && selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {selectedActivity.type === 'INTERNAL' ? 'Điểm danh nội bộ' : 'Minh chứng đối tác'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedActivity.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đơn vị: {selectedActivity.organizer} · Tổng điểm danh: <strong className="text-emerald-700">{participants.length} sinh viên</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Batch Import Accordion / Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Import điểm danh hàng loạt bằng danh sách MSSV</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Đối chiếu trực tiếp Real Database</span>
                </div>

                <form onSubmit={handleBatchAddAttendance} className="space-y-3">
                  <div>
                    <textarea
                      rows={3}
                      value={batchCodesText}
                      onChange={(e) => setBatchCodesText(e.target.value)}
                      placeholder="Dán danh sách MSSV (phân cách bằng dấu phẩy, khoảng trắng hoặc xuống dòng). VD: 102210001, 102210002..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-slate-600 font-medium">Vai trò tham gia:</label>
                      <select
                        value={batchRole}
                        onChange={(e) => setBatchRole(e.target.value)}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      >
                        <option value="THAM_GIA_CHINH">Tham gia chính</option>
                        <option value="BAN_TO_CHUC">Ban tổ chức</option>
                        <option value="CO_VU">Cổ vũ / Tham quan</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isBatchAdding}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isBatchAdding ? 'Đang kiểm tra & nạp...' : 'Ghi nhận hàng loạt'}</span>
                    </button>
                  </div>
                </form>

                {/* Batch Result Report */}
                {batchResult && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-[11px] space-y-1">
                    <div className="font-bold text-slate-800">Kết quả xử lý điểm danh:</div>
                    <div className="text-emerald-700 font-semibold">
                      Đã ghi nhận mới: {batchResult.addedCount}/{batchResult.totalInput} sinh viên
                    </div>
                    {batchResult.alreadyInListCount > 0 && (
                      <div className="text-amber-700">
                        Đã có sẵn trong danh sách: {batchResult.alreadyInListCount} sinh viên
                      </div>
                    )}
                    {batchResult.notFoundCount > 0 && (
                      <div className="text-rose-600">
                        Không tìm thấy trong cơ sở dữ liệu: {batchResult.notFoundCount} MSSV ({batchResult.notFoundCodes?.join(', ')})
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Single Add Form */}
              <form onSubmit={handleAddSingleAttendance} className="flex flex-col sm:flex-row items-center gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <span className="font-bold text-slate-800 whitespace-nowrap text-xs">Thêm nhanh 1 SV:</span>
                <input
                  type="text"
                  value={singleStudentCode}
                  onChange={(e) => setSingleStudentCode(e.target.value)}
                  placeholder="Nhập MSSV (VD: 102210001)"
                  className="w-full sm:w-48 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <select
                  value={singleRole}
                  onChange={(e) => setSingleRole(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="THAM_GIA_CHINH">Tham gia chính</option>
                  <option value="BAN_TO_CHUC">Ban tổ chức</option>
                  <option value="CO_VU">Cổ vũ / Tham quan</option>
                </select>
                <button
                  type="submit"
                  disabled={isAddingSingle}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition whitespace-nowrap"
                >
                  {isAddingSingle ? 'Đang thêm...' : 'Ghi nhận'}
                </button>
              </form>

              {/* Participants Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">
                    Danh sách đã điểm danh ({participants.length})
                  </span>
                  <div className="relative w-60">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      placeholder="Tìm trong danh sách..."
                      className="w-full pl-7 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {isLoadingParticipants ? (
                    <div className="p-8 text-center text-slate-400">Đang tải danh sách...</div>
                  ) : filteredParticipants.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      {participants.length === 0
                        ? 'Chưa có sinh viên nào trong danh sách điểm danh của hoạt động này.'
                        : 'Không có sinh viên nào khớp với bộ lọc tìm kiếm.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">MSSV</th>
                            <th className="py-2.5 px-3">Họ và tên</th>
                            <th className="py-2.5 px-3">Lớp</th>
                            <th className="py-2.5 px-3">Vai trò</th>
                            <th className="py-2.5 px-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredParticipants.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {p.student.studentCode}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {p.student.fullName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {p.student.class?.code || '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {p.formRole || 'Tham gia chính'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteParticipant(p.id, p.student.fullName)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                  title="Xóa điểm danh"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Thêm hoạt động mới (Real DB) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {newType === 'INTERNAL' ? 'Tạo hoạt động nội bộ mới' : 'Thêm hoạt động ngoài trường / đối tác'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại hình hoạt động</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('INTERNAL')}
                    className={`py-2 px-3 rounded-lg font-bold border transition text-center ${
                      newType === 'INTERNAL'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Nội bộ trường
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('EXTERNAL')}
                    className={`py-2 px-3 rounded-lg font-bold border transition text-center ${
                      newType === 'EXTERNAL'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Ngoại khóa / Đối tác
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên hoạt động</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Ngày hội Hiến máu Nhân đạo 2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Đơn vị chủ trì / Tổ chức</label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="VD: Thành đoàn Đà Nẵng / Khoa CNTT"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày diễn ra</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Địa điểm</label>
                  <input
                    type="text"
                    value={newLoc}
                    onChange={(e) => setNewLoc(e.target.value)}
                    placeholder="VD: Hội trường khu F"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả / Ghi chú</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mục đích hoạt động hoặc tiêu chí cộng điểm..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {isCreating ? 'Đang tạo...' : 'Tạo hoạt động'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Sửa hoạt động (Real DB) */}
      {showEditModal && editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Chỉnh sửa hoạt động</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên hoạt động</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Đơn vị chủ trì / Tổ chức</label>
                <input
                  type="text"
                  required
                  value={editOrg}
                  onChange={(e) => setEditOrg(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày diễn ra</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Địa điểm</label>
                  <input
                    type="text"
                    value={editLoc}
                    onChange={(e) => setEditLoc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả / Ghi chú</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
