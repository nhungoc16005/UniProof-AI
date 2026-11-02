import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import type { EvaluationData, EvaluationRow } from '../components/EvaluationBoard';
import { errorMessage } from '../components/EvaluationBoard';
import { validateFacultyRows } from '../lib/facultyAnalytics';
import type { Appeal, Evidence } from '../types';

type Resource<T> = { key: string; data?: T; error?: string; loading: boolean };

async function loadAllWorkflow(termId: string) {
  const first: EvaluationData = await apiClient.getEvaluationWorkflow(termId, { page: 1, pageSize: 100 });
  if (first.term.id !== termId) throw new Error('Dữ liệu không thuộc kỳ đang chọn.');
  const rows = [...first.items];
  const totalPages = Math.ceil(first.total / 100);
  for (let page = 2; page <= totalPages; page += 4) {
    const pages: EvaluationData[] = await Promise.all(
      Array.from({ length: Math.min(4, totalPages - page + 1) }, (_, index) =>
        apiClient.getEvaluationWorkflow(termId, { page: page + index, pageSize: 100 }),
      ),
    );
    pages.forEach(result => {
      if (result.term.id !== termId || result.total !== first.total) {
        throw new Error('Danh sách thay đổi trong lúc tổng hợp. Hãy tải lại.');
      }
      rows.push(...result.items);
    });
  }
  validateFacultyRows(rows, first);
  return { workflow: first, rows };
}

async function loadAllHumanReview(termId: string) {
  const pageSize = 100;
  const first = await apiClient.getReviewQueuePage({ termId, status: 'NEEDS_HUMAN_REVIEW', page: 1, pageSize });
  const items: Evidence[] = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / pageSize); page += 4) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(4, Math.ceil(first.total / pageSize) - page + 1) }, (_, index) =>
        apiClient.getReviewQueuePage({ termId, status: 'NEEDS_HUMAN_REVIEW', page: page + index, pageSize }),
      ),
    );
    pages.forEach(result => {
      if (result.total !== first.total) throw new Error('Hàng đợi minh chứng thay đổi trong lúc tổng hợp. Hãy tải lại.');
      items.push(...result.items);
    });
  }
  if (items.length !== first.total || new Set(items.map(item => item.id)).size !== first.total) throw new Error('Không tải đủ hàng đợi minh chứng. Hãy tải lại.');
  return { items, total: first.total };
}

async function loadAllPendingAppeals(termId: string) {
  const pageSize = 100;
  const first = await apiClient.getAppealsPage({ termId, status: 'PENDING', page: 1, pageSize });
  const items: Appeal[] = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / pageSize); page += 4) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(4, Math.ceil(first.total / pageSize) - page + 1) }, (_, index) =>
        apiClient.getAppealsPage({ termId, status: 'PENDING', page: page + index, pageSize }),
      ),
    );
    pages.forEach(result => {
      if (result.total !== first.total) throw new Error('Danh sách phúc khảo thay đổi trong lúc tổng hợp. Hãy tải lại.');
      items.push(...result.items);
    });
  }
  if (items.length !== first.total || new Set(items.map(item => item.id)).size !== first.total) throw new Error('Không tải đủ danh sách phúc khảo. Hãy tải lại.');
  return { items, total: first.total };
}

export function useFacultyEvaluationWorkspace(termId: string, userId: string) {
  const key = `${userId}:${termId}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const generation = useRef(0);
  const [workflow, setWorkflow] = useState<Resource<EvaluationData>>({ key, loading: Boolean(termId) });
  const [rows, setRows] = useState<Resource<EvaluationRow[]>>({ key, loading: Boolean(termId) });
  const [evidences, setEvidences] = useState<Resource<{ items: Evidence[]; total: number }>>({ key, loading: Boolean(termId) });
  const [appeals, setAppeals] = useState<Resource<{ items: Appeal[]; total: number }>>({ key, loading: Boolean(termId) });

  const refresh = useCallback(async () => {
    if (!termId) return;
    const version = ++generation.current;
    const valid = () => currentKey.current === key && generation.current === version;
    setWorkflow({ key, loading: true });
    setRows({ key, loading: true });
    setEvidences({ key, loading: true });
    setAppeals({ key, loading: true });

    const workflowRequest = loadAllWorkflow(termId)
      .then(result => {
        if (!valid()) return;
        setWorkflow({ key, data: result.workflow, loading: false });
        setRows({ key, data: result.rows, loading: false });
      })
      .catch(error => {
        if (!valid()) return;
        const message = errorMessage(error);
        setWorkflow({ key, error: message, loading: false });
        setRows({ key, error: message, loading: false });
      });
    const evidenceRequest = loadAllHumanReview(termId)
      .then(data => { if (valid()) setEvidences({ key, data, loading: false }); })
      .catch(error => { if (valid()) setEvidences({ key, error: errorMessage(error), loading: false }); });
    const appealRequest = loadAllPendingAppeals(termId)
      .then(data => { if (valid()) setAppeals({ key, data, loading: false }); })
      .catch(error => { if (valid()) setAppeals({ key, error: errorMessage(error), loading: false }); });
    await Promise.allSettled([workflowRequest, evidenceRequest, appealRequest]);
  }, [key, termId]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const current = <T,>(resource: Resource<T>): Resource<T> =>
    resource.key === key ? resource : { key, loading: Boolean(termId) };

  return {
    workflow: current(workflow),
    rows: current(rows),
    evidences: current(evidences),
    appeals: current(appeals),
    refresh,
  };
}
