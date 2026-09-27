import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Notification } from '../../types';
import { Bell, Check, Clock, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

export const NotificationsCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    apiClient.getNotifications().then(setNotifications);
  }, []);

  const handleMarkAllRead = async () => {
    await apiClient.markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filtered = notifications.filter((n) => (filter === 'UNREAD' ? !n.isRead : true));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trung tâm Thông báo (C05)</h1>
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {filtered.map((n) => (
          <div
            key={n.id}
            className={`p-4 hover:bg-slate-50 transition flex items-start gap-3.5 ${
              n.isRead ? 'opacity-70' : 'bg-sky-50/30'
            }`}
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
          </div>
        ))}
      </div>
    </div>
  );
};
