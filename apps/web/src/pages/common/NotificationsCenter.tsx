import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { Notification } from '../../types';
import { Bell, Check, AlertTriangle, CheckCircle } from 'lucide-react';

export const NotificationsCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => { try { setLoading(true); setError(''); setNotifications(await apiClient.getNotifications()); } catch { setError('Không tải được thông báo từ máy chủ.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const handleMarkAllRead = async () => {
    await apiClient.markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filtered = notifications.filter((n) => (filter === 'UNREAD' ? !n.isRead : true));
  const openNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      try { await apiClient.markNotificationAsRead(notification.id); setNotifications(current => current.map(item => item.id === notification.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item)); } catch { setError('Không đánh dấu được thông báo. Vui lòng thử lại.'); return; }
    }
    if (notification.targetPath?.startsWith('/') && !notification.targetPath.startsWith('//')) navigate(notification.targetPath);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trung tâm thông báo</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cập nhật trạng thái duyệt hồ sơ, yêu cầu bổ sung giấy tờ và thông báo từ nhà trường.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Đánh dấu tất cả đã đọc</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setFilter('ALL')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            filter === 'ALL'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tất cả thông báo ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            filter === 'UNREAD'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Chưa đọc ({notifications.filter((n) => !n.isRead).length})
        </button>
      </div>

      {/* Notifications List */}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Thử lại</button></div>}
      {loading && <div role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải thông báo…</div>}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {!loading && !filtered.length && <div className="p-10 text-center text-sm text-slate-500">{filter === 'UNREAD' ? 'Bạn đã đọc tất cả thông báo.' : 'Chưa có thông báo.'}</div>}
        {!loading && filtered.map((n) => (
          <button type="button"
            key={n.id}
            onClick={() => void openNotification(n)}
            className={`p-4 hover:bg-slate-50 transition flex items-start gap-3.5 ${
              n.isRead ? 'opacity-70' : 'bg-sky-50/30'
            } w-full text-left`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                n.type === 'SUPPLEMENT_REQUIRED'
                  ? 'bg-amber-100 text-amber-700'
                  : n.type === 'EVIDENCE_REVIEWED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {n.type === 'SUPPLEMENT_REQUIRED' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : n.type === 'EVIDENCE_REVIEWED' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-900">{n.title}</h4>
                <span className="text-[11px] text-slate-400">
                  {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <p className="text-xs text-slate-600">{n.content}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
