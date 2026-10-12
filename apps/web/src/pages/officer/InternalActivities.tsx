import React, { useState, useEffect } from 'react';
import { Activity } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Plus, Upload, Calendar, MapPin, CheckCircle, ShieldCheck, Send, Building, Globe, Edit3, Trash2, X } from 'lucide-react';

export const InternalActivities: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Edit Activity State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLoc, setEditLoc] = useState('');

  // Partners data (O05)
  const [partners, setPartners] = useState([
    {
      id: 'p-01',
      name: 'Thành đoàn Đà Nẵng & Hội LHTN Việt Nam TP. Đà Nẵng',
      contactEmail: 'thanhdoan@danang.gov.vn',
      verifiedCount: 145,
      trustLevel: 'Level 2 (Xác nhận qua email/portal chính thức)',
      status: 'VERIFIED',
    },
    {
      id: 'p-02',
      name: 'Chi hội An toàn Thông tin phía Nam (VNISA)',
      contactEmail: 'contact@vnisa.org.vn',
      verifiedCount: 42,
      trustLevel: 'Level 3 (Website sự kiện & danh sách công khai)',
      status: 'VERIFIED',
    },
    {
      id: 'p-03',
      name: 'Google Developer Student Clubs (GDSC Vietnam)',
      contactEmail: 'gdsc.vietnam@google.com',
      verifiedCount: 88,
      trustLevel: 'Level 2 (Portal chứng nhận điện tử QR)',
      status: 'VERIFIED',
    },
  ]);

  // New Activity form
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('Khoa Công nghệ Thông tin');
  const [newDate, setNewDate] = useState('2026-10-15');
  const [newLoc, setNewLoc] = useState('Hội trường E');

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getActivities({ type: 'INTERNAL' });
      setActivities(data);
    } catch (err) {
      console.error('Không thể tải danh sách hoạt động', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.createActivity({
        name: newName,
        type: 'INTERNAL',
        organizer: newOrg,
        startDate: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
        location: newLoc,
      });
      setActivities([created, ...activities]);
      setShowAddModal(false);
      setNewName('');
    } catch (err) {
      console.error('Lỗi tạo hoạt động', err);
      alert('Không thể tạo hoạt động. Vui lòng thử lại.');
    }
  };

  const handleUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    try {
      const updated = await apiClient.updateActivity(editingActivity.id, {
        name: editName,
        organizer: editOrg,
        startDate: editDate ? new Date(editDate).toISOString() : undefined,
        location: editLoc,
      });
      setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...a, ...updated } : a));
      setShowEditModal(false);
      alert('Đã cập nhật hoạt động thành công.');
    } catch (err) {
      console.error('Lỗi cập nhật hoạt động', err);
      alert('Không thể cập nhật hoạt động.');
    }
  };

  const handleDeleteActivity = async (act: Activity) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hoạt động "${act.name}"?`)) return;
    try {
      await apiClient.deleteActivity(act.id);
      setActivities(prev => prev.filter(a => a.id !== act.id));
      alert('Đã xóa hoạt động.');
    } catch (err) {
      console.error('Lỗi xóa hoạt động', err);
      alert('Không thể xóa hoạt động này.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Hoạt động & Điểm danh (O05 - O06)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trung tâm đối chiếu dữ liệu hoạt động nội bộ trường (I3) và nguồn đối tác ngoài trường (I4).
          </p>
        </div>

        {activeTab === 'internal' ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm hoạt động mới</span>
          </button>
        ) : (
          <button
            onClick={() => alert('Thêm đơn vị đối tác tổ chức mới')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm đơn vị đối tác</span>
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('internal')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'internal'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Hoạt động nội bộ & Điểm danh (O06)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {activities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('external')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'external'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Nguồn ngoài trường & Đơn vị đối tác (O05)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {partners.length}
          </span>
        </button>
      </div>

      {activeTab === 'internal' ? (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Đang tải danh sách hoạt động...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Chưa có hoạt động nội bộ nào trong hệ thống. Bấm nút trên để tạo hoạt động mới.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.map((act) => (
                <div key={act.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        Nội bộ trường
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingActivity(act);
                            setEditName(act.name);
                            setEditOrg(act.organizer);
                            setEditLoc(act.location || '');
                            setEditDate(act.startDate ? new Date(act.startDate).toISOString().slice(0, 10) : '');
                            setShowEditModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Sửa hoạt động"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(act)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa hoạt động"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-2">{act.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Đơn vị: {act.organizer}</p>

                    <div className="flex items-center gap-4 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {act.startDate ? new Date(act.startDate).toLocaleDateString('vi-VN') : '10/2026'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {act.location || 'Bách Khoa'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Điểm danh đồng bộ</span>
                    </span>

                    <button
                      onClick={() => {
                        setSelectedActivity(act);
                        setShowImportModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-lg transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Excel</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Tab External Partners (O05) */
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">
              Danh sách đơn vị tổ chức bên ngoài được tin cậy
            </span>
            <span className="text-slate-500 text-[11px]">
              Tự động đối chiếu minh chứng ngoại khóa qua email/portal hoặc link xác nhận C07
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Tên đơn vị tổ chức</th>
                  <th className="py-3.5 px-4">Email đầu mối liên hệ</th>
                  <th className="py-3.5 px-4">Mức xác minh mặc định</th>
                  <th className="py-3.5 px-4">Số hồ sơ đã xác nhận</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {p.id}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {p.contactEmail}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{p.trustLevel}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {p.verifiedCount} hồ sơ
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => alert(`Đã tạo link xác nhận một lần C07 gửi tới ${p.contactEmail}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition"
                        title="Gửi link xác nhận trực tuyến cho đơn vị"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi link C07</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add Activity */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Thêm hoạt động nội bộ mới</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên hoạt động</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Hội thảo Khởi nghiệp Đổi mới sáng tạo 2026"
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Đơn vị chủ trì</label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ngày diễn ra</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Địa điểm</label>
                  <input
                    type="text"
                    value={newLoc}
                    onChange={(e) => setNewLoc(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded"
                >
                  Tạo hoạt động
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      {showImportModal && selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Import danh sách điểm danh Excel</h3>
              <button onClick={() => setShowImportModal(false)}>✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Hoạt động: <strong>{selectedActivity.name}</strong>
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center text-xs text-slate-500">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span>Chọn file .xlsx hoặc .csv chứa cột MSSV, Họ tên và Vai trò</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Đã đồng bộ danh sách điểm danh vào hệ thống đối chiếu I3!');
                  setShowImportModal(false);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs"
              >
                Tải lên và đồng bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa hoạt động */}
      {showEditModal && editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Chỉnh sửa hoạt động</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateActivity} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên hoạt động</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Đơn vị chủ trì / Tổ chức</label>
                <input
                  type="text"
                  required
                  value={editOrg}
                  onChange={(e) => setEditOrg(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ngày diễn ra</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Địa điểm</label>
                  <input
                    type="text"
                    value={editLoc}
                    onChange={(e) => setEditLoc(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1d6fc2] hover:bg-[#175ea5] text-white font-bold rounded-xl"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
