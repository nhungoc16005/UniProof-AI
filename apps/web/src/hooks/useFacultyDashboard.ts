import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import type { EvaluationData, EvaluationRow } from '../components/EvaluationBoard';
import { errorMessage } from '../components/EvaluationBoard';
import { validateFacultyRows, FacultyKpi, FacultyReport } from '../lib/facultyAnalytics';

type Resource<T> = { key: string; data?: T; error?: string; loading: boolean };
export function useFacultyDashboard(termId: string, userId: string) {
  const key = userId + ':' + termId;
  const currentKey = useRef(key); currentKey.current = key;
  const generation = useRef({ workflow: 0, kpi: 0, report: 0 });
  const [workflow, setWorkflow] = useState<Resource<EvaluationData>>({ key, loading: true });
  const [rows, setRows] = useState<Resource<EvaluationRow[]>>({ key, loading: true });
  const [kpi, setKpi] = useState<Resource<FacultyKpi>>({ key, loading: true });
  const [report, setReport] = useState<Resource<FacultyReport>>({ key, loading: true });
  const refreshWorkflow = async () => {
    if (!termId) return;
    const version = ++generation.current.workflow;
    const valid = () => currentKey.current === key && generation.current.workflow === version;
    setWorkflow({ key, loading: true }); setRows({ key, loading: true });
    let first: EvaluationData;
    try {
      first = await apiClient.getEvaluationWorkflow(termId, { page: 1, pageSize: 100 });
      if (!valid()) return;
      if (first.term.id !== termId) throw new Error('Dữ liệu không thuộc kỳ đang chọn.');
      setWorkflow({ key, data: first, loading: false });
    } catch (err) {
      if (valid()) { setWorkflow({ key, error: errorMessage(err), loading: false }); setRows({ key, error: 'Không tải được danh sách phiếu để tổng hợp.', loading: false }); }
      return;
    }
    try {
      const all: EvaluationRow[] = [...first.items];
      const totalPages = Math.ceil(first.total / 100);
      // Bound concurrency; never request an export to populate a dashboard.
      for (let page = 2; page <= totalPages; page += 4) {
        const results: EvaluationData[] = await Promise.all(Array.from({ length: Math.min(4, totalPages - page + 1) }, (_, i) => apiClient.getEvaluationWorkflow(termId, { page: page + i, pageSize: 100 })));
        if (!valid()) return;
        for (const result of results) {
          if (result.term.id !== termId || result.total !== first.total) throw new Error('Danh sách thay đổi trong lúc tổng hợp. Hãy tải lại thống kê.');
          all.push(...result.items);
        }
      }
      validateFacultyRows(all, first);
      if (valid()) setRows({ key, data: all, loading: false });
    } catch (err) { if (valid()) setRows({ key, error: errorMessage(err), loading: false }); }
  };
  const refreshKpi = async () => {
    if (!termId) return;
    const version = ++generation.current.kpi;
    setKpi({ key, loading: true });
    try { const data = await apiClient.getKpiSummary(termId); if (currentKey.current === key && generation.current.kpi === version) setKpi({ key, data, loading: false }); }
    catch (err) { if (currentKey.current === key && generation.current.kpi === version) setKpi({ key, error: errorMessage(err), loading: false }); }
  };
  const refreshReport = async () => {
    if (!termId) return;
    const version = ++generation.current.report;
    setReport({ key, loading: true });
    try { const data = await apiClient.getResultReport(termId); if (currentKey.current === key && generation.current.report === version) setReport({ key, data, loading: false }); }
    catch (err) { if (currentKey.current === key && generation.current.report === version) setReport({ key, error: errorMessage(err), loading: false }); }
  };
  const refresh = () => Promise.allSettled([refreshWorkflow(), refreshKpi(), refreshReport()]);
  useEffect(() => {
    void refresh();
    return () => { generation.current.workflow++; generation.current.kpi++; generation.current.report++; };
  }, [key]);
  const current = <T,>(resource: Resource<T>): Resource<T> => resource.key === key ? resource : { key, loading: Boolean(termId) };
  return { workflow: current(workflow), rows: current(rows), kpi: current(kpi), report: current(report), refresh, refreshWorkflow, refreshKpi, refreshReport };
}
