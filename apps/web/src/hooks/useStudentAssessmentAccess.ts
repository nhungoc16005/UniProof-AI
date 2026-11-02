import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { RubricPayload } from '../types';

type Snapshot = { key: string; assessment: RubricPayload | null; verified: boolean; error: string };

// Refresh only server access/status. The page owns its unsaved scores and files.
export function useStudentAssessmentAccess(userId: string | undefined, termId: string) {
  const key = `${userId ?? ''}:${termId}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const version = useRef(0);
  const pending = useRef<{ key: string; promise: Promise<RubricPayload | null> } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [, setClock] = useState(0);

  const accept = useCallback((assessment: RubricPayload) => {
    if (activeKey.current !== key) return;
    version.current++;
    pending.current = null;
    setSnapshot({ key, assessment, verified: true, error: '' });
    setChecking(false);
  }, [key]);

  const refresh = useCallback((): Promise<RubricPayload | null> => {
    if (!userId || !termId) return Promise.resolve(null);
    if (pending.current?.key === key) return pending.current.promise;
    const requestVersion = ++version.current;
    setChecking(true);
    const promise = apiClient.getMyAssessments(termId).then(assessment => {
      if (activeKey.current !== key || version.current !== requestVersion) return null;
      setSnapshot({ key, assessment, verified: true, error: '' });
      return assessment;
    }).catch(error => {
      if (activeKey.current === key && version.current === requestVersion) {
        setSnapshot(previous => ({ key, assessment: previous?.key === key ? previous.assessment : null, verified: false, error: 'Không xác minh được quyền chỉnh sửa. Tạm chuyển sang chế độ xem; nội dung đang nhập được giữ nguyên.' }));
      }
      throw error;
    }).finally(() => {
      if (activeKey.current === key && version.current === requestVersion) {
        pending.current = null;
        setChecking(false);
      }
    });
    pending.current = { key, promise };
    return promise;
  }, [key, userId, termId]);

  useEffect(() => {
    let disposed = false;
    const refreshVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const inFlight = pending.current?.key === key ? pending.current.promise : null;
      if (inFlight) {
        // A focus/visibility event can follow a server-side change while an older
        // request is still returning. Read again after it, without cancelling
        // the page's initial data load or changing any draft values.
        void inFlight.catch(() => null).then(() => {
          if (!disposed && activeKey.current === key && document.visibilityState === 'visible') void refresh().catch(() => undefined);
        });
      } else void refresh().catch(() => undefined);
    };
    refreshVisible();
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const interval = window.setInterval(refreshVisible, 60_000);
    return () => {
      disposed = true;
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.clearInterval(interval);
      version.current++;
      pending.current = null;
    };
  }, [refresh]);

  const current = snapshot?.key === key ? snapshot : null;
  const assessment = current?.assessment ?? null;
  const isReturned = assessment?.submission?.status === 'RETURNED';
  const editDeadline = isReturned ? assessment?.term?.reviewDeadline : assessment?.term?.submissionDeadline;
  const deadlineTime = editDeadline ? new Date(editDeadline).getTime() : null;
  const deadlinePassed = deadlineTime !== null && Number.isFinite(deadlineTime) && Date.now() > deadlineTime;

  useEffect(() => {
    if (deadlineTime === null || !Number.isFinite(deadlineTime) || deadlineTime < Date.now()) return;
    const timer = window.setTimeout(() => {
      setClock(value => value + 1);
      void refresh().catch(() => undefined);
    }, Math.min(deadlineTime - Date.now() + 25, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [deadlineTime, refresh, assessment]);

  const canEdit = Boolean(current?.verified && assessment?.rubricVersion && assessment.permissions?.canEdit && !deadlinePassed);
  return { assessment, canEdit, isReturned, editDeadline, deadlinePassed, error: current?.error ?? '', checking, refresh, accept };
}
