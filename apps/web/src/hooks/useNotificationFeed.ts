import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';

type NotificationFeed = Awaited<ReturnType<typeof apiClient.getNotifications>>;

const emptyFeed: NotificationFeed = { items: [], unreadCount: 0 };

export function useNotificationFeed(userId?: string, refreshKey?: string) {
  const [state, setState] = useState<{
    owner: string;
    feed: NotificationFeed;
    loading: boolean;
    error: string;
  }>();
  const owner = useRef(userId);
  const request = useRef(0);

  useLayoutEffect(() => {
    owner.current = userId;
    return () => {
      owner.current = undefined;
      request.current++;
    };
  }, [userId]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const id = ++request.current;
    setState(current => ({
      owner: userId,
      feed: current?.owner === userId ? current.feed : emptyFeed,
      loading: true,
      error: '',
    }));
    try {
      const feed = await apiClient.getNotifications();
      if (request.current === id) setState({ owner: userId, feed, loading: false, error: '' });
    } catch {
      if (request.current === id) {
        setState(current => current && { ...current, loading: false, error: 'Không tải được thông báo từ máy chủ.' });
      }
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload, refreshKey]);

  const updateFeed = (update: (feed: NotificationFeed) => NotificationFeed) => {
    if (!userId || owner.current !== userId) return;
    request.current++;
    setState(current => current?.owner === userId
      ? { ...current, feed: update(current.feed), loading: false }
      : current);
  };

  const markRead = async (id: string) => {
    await apiClient.markNotificationAsRead(id);
    updateFeed(feed => {
      if (!feed.items.some(item => item.id === id && !item.isRead)) return feed;
      const readAt = new Date().toISOString();
      return {
        items: feed.items.map(item => item.id === id ? { ...item, isRead: true, readAt } : item),
        unreadCount: Math.max(0, feed.unreadCount - 1),
      };
    });
  };

  const markAllRead = async () => {
    await apiClient.markAllNotificationsAsRead();
    updateFeed(feed => {
      const readAt = new Date().toISOString();
      return {
        items: feed.items.map(item => item.isRead ? item : { ...item, isRead: true, readAt }),
        unreadCount: 0,
      };
    });
  };

  const current = state?.owner === userId ? state : undefined;
  return {
    ...(current?.feed ?? emptyFeed),
    loading: current?.loading ?? Boolean(userId),
    error: current?.error ?? '',
    reload,
    markRead,
    markAllRead,
  };
}

export type NotificationOutletContext = ReturnType<typeof useNotificationFeed>;
