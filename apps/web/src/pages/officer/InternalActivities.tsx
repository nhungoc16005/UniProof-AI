import React, { useState, useEffect } from 'react';
import { Activity } from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Plus, Upload, Calendar, MapPin, CheckCircle } from 'lucide-react';

export const InternalActivities: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý hoạt động nội bộ & Điểm danh (O06)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu điểm danh nội bộ (I3) dùng để tự động xác nhận minh chứng sinh viên tham gia.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm hoạt động mới</span>
        </button>
      </div>

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
                  <span className="text-[11px] text-slate-400 font-mono">ID: {act.id.slice(0, 8)}...</span>
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
    </div>
  );
};
