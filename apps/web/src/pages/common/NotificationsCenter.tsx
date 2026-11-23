import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { NotificationOutletContext } from '../../hooks/useNotificationFeed';
import type { Notification } from '../../types';
import { Bell, Check, AlertTriangle, CheckCircle } from 'lucide-react';

export const NotificationsCenter: React.FC = () => {
  const { items: notifications, unreadCount, loading, error: loadError, reload, markRead, markAllRead } =
    useOutletContext<NotificationOutletContext>();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();

  const handleMarkAllRead = async () => {
    setActionError('');
    try {
      await markAllRead();
    } catch {
      setActionError('Không thể đánh dấu tất cả thông báo. Vui lòng thử lại.');
    }
  };

  const filtered = notifications.filter((n) => (filter === 'UNREAD' ? !n.isRead : true));
  const openNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      setActionError('');
      try {
        await markRead(notification.id);
      } catch {
        setActionError('Không đánh dấu được thông báo. Vui lòng thử lại.');
        return;
      }
    }
    if (notification.targetPath?.startsWith('/') && !notification.targetPath.startsWith('//')) navigate(notification.targetPath);
  };
  const emptyMessage = filter === 'ALL' ? 'Chưa có thông báo.' :
    unreadCount === 0 ? 'Bạn đã đọc tất cả thông báo.' :
      'Còn thông báo chưa đọc ngoài 50 mục gần nhất.';

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
          disabled={loading || !unreadCount}
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
          Gần đây ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            filter === 'UNREAD'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}<button type="button" onClick={() => void reload()} className="ml-2 font-semibold underline">Thử lại</button></div>}
      {actionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{actionError}</div>}
      {loading && <div role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải thông báo…</div>}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {!loading && !loadError && !filtered.length && <div className="p-10 text-center text-sm text-slate-500">{emptyMessage}</div>}
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
