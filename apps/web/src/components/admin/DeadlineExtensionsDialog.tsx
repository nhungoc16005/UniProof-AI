import { AlertCircle, ChevronLeft, ChevronRight, Clock, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { DeadlineExtensionRow, DeadlineExtensionTargetItem, Term } from '../../types';

export const DeadlineExtensionsDialog: React.FC<{ term: Term; onClose: () => void }> = ({ term, onClose }) => {
  const [targetType, setTargetType] = useState<'STUDENT' | 'CLASS'>('STUDENT');
  const [targetId, setTargetId] = useState('');
  const [selectedTargetLabel, setSelectedTargetLabel] = useState('');
  const [type, setType] = useState<'SUBMISSION' | 'REVIEW' | 'APPEAL'>('SUBMISSION');
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');

  // Targets state (roster-scoped from AssessmentHandoff)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [targetItems, setTargetItems] = useState<DeadlineExtensionTargetItem[]>([]);
  const [totalTargets, setTotalTargets] = useState(0);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Extensions history
  const [rows, setRows] = useState<DeadlineExtensionRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const activeTargetRequestId = useRef(0);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load targets when termId, targetType, debouncedQuery, or page changes
  useEffect(() => {
    const requestId = ++activeTargetRequestId.current;
    setLoadingTargets(true);

    apiClient
      .getDeadlineExtensionTargets({
        termId: term.id,
        targetType,
        q: debouncedQuery || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        if (requestId !== activeTargetRequestId.current) return;
        setTargetItems(res.items || []);
        setTotalTargets(res.total || 0);
      })
      .catch(() => {
        if (requestId !== activeTargetRequestId.current) return;
        setError('Không tải được danh sách đối tượng trong kỳ.');
      })
      .finally(() => {
        if (requestId === activeTargetRequestId.current) {
          setLoadingTargets(false);
        }
      });
  }, [term.id, targetType, debouncedQuery, page, pageSize]);

  // Load history list
  const loadExtensions = async () => {
    try {
      const extensions = await apiClient.getDeadlineExtensions(term.id);
      setRows(extensions);
    } catch {
      setError('Không tải được lịch sử gia hạn.');
    }
  };

  useEffect(() => {
    void loadExtensions();
  }, [term.id]);

  const handleTargetTypeChange = (newType: 'STUDENT' | 'CLASS') => {
    setTargetType(newType);
    setTargetId('');
    setSelectedTargetLabel('');
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetId) {
      setError('Vui lòng chọn đối tượng được gia hạn.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await apiClient.createDeadlineExtension({
        termId: term.id,
        targetType,
        targetId,
        type,
        deadline: new Date(deadline).toISOString(),
        reason,
      });
      setTargetId('');
      setSelectedTargetLabel('');
      setReason('');
      setDeadline('');
      await loadExtensions();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Không tạo được gia hạn.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      setError('');
      await apiClient.revokeDeadlineExtension(id);
      await loadExtensions();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Không thu hồi được gia hạn.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalTargets / pageSize));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-6"
      >
        <header className="flex items-start justify-between border-b pb-4">
          <div>
            <h2 id="dialog-title" className="text-lg font-bold text-slate-900">
              Ngoại lệ thời hạn (Gia hạn)
            </h2>
            <p className="text-sm text-slate-600">
              {term.name} · Phạm vi áp dụng theo Roster kỳ · Ưu tiên Sinh viên → Lớp → Hạn chung
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={create} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-900 text-sm">Thêm ngoại lệ mới</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="target-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Phạm vi gia hạn
              </label>
              <select
                id="target-type-select"
                value={targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="STUDENT">Một sinh viên (theo Roster kỳ)</option>
                <option value="CLASS">Một lớp sinh hoạt (thuộc Roster kỳ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="extension-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Loại hạn
              </label>
              <select
                id="extension-type-select"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="SUBMISSION">Nộp phiếu tự đánh giá (SUBMISSION)</option>
                <option value="REVIEW">Chấm & sửa đánh giá (REVIEW)</option>
                <option value="APPEAL">Thời hạn phúc khảo (APPEAL)</option>
              </select>
            </div>
          </div>

          {/* Target Selector with search & pagination */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="search-target-input" className="text-xs font-semibold text-slate-700">
                Chọn {targetType === 'STUDENT' ? 'sinh viên' : 'lớp'} ({totalTargets} đối tượng trong kỳ):
              </label>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="search-target-input"
                  type="text"
                  placeholder={targetType === 'STUDENT' ? 'Tìm theo MSSV hoặc họ tên…' : 'Tìm theo mã hoặc tên lớp…'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {selectedTargetLabel && (
              <div className="flex items-center justify-between rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                <span>
                  Đã chọn: <strong>{selectedTargetLabel}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetId('');
                    setSelectedTargetLabel('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto rounded border border-slate-100 divide-y divide-slate-100">
              {loadingTargets ? (
                <p className="p-3 text-center text-xs text-slate-400">Đang tải danh sách đối tượng…</p>
              ) : targetItems.length === 0 ? (
                <p className="p-3 text-center text-xs text-slate-400">Không tìm thấy đối tượng nào trong kỳ này.</p>
              ) : (
                targetItems.map((item) => {
                  const isSelected = targetId === item.id;
                  const label = `${item.code} · ${item.name}${item.className ? ` (${item.className})` : ''}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTargetId(item.id);
                        setSelectedTargetLabel(label);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-100 font-semibold text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      <span>
                        <span className="font-mono font-medium">{item.code}</span> — {item.name}
                        {item.className && <span className="text-slate-400 text-[11px] ml-1">({item.className})</span>}
                      </span>
                      {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                    </button>
                  );
                })
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                <span>
                  Trang {page} / {totalPages} (tổng {totalTargets})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1 || loadingTargets}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loadingTargets}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Trang sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="extension-deadline-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Thời hạn mới
              </label>
              <input
                id="extension-deadline-input"
                required
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="extension-reason-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do gia hạn
              </label>
              <textarea
                id="extension-reason-input"
                required
                minLength={3}
                rows={2}
                placeholder="Nhập lý do gia hạn (tối thiểu 3 ký tự)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="text-right">
            <button
              type="submit"
              disabled={busy || !targetId || !deadline || !reason}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              {busy ? 'Đang lưu…' : 'Tạo gia hạn'}
            </button>
          </div>
        </form>

        <div>
          <h3 className="mb-3 font-semibold text-slate-900 text-sm">Lịch sử gia hạn trong kỳ ({rows.length})</h3>
          {!rows.length ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Chưa có ngoại lệ nào được tạo cho kỳ này.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-sm transition-colors ${row.revokedAt ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900">
                        {row.targetType === 'STUDENT' ? 'Sinh viên' : 'Lớp'} · {row.type}
                      </strong>
                      {row.revokedAt && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          Đã thu hồi
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs">
                      Hạn mới: <strong>{new Date(row.deadline).toLocaleString('vi-VN')}</strong> · {row.reason}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Tạo bởi: {row.createdBy?.fullName || 'Hệ thống'}
                      {row.revokedAt && ` · Thu hồi lúc: ${new Date(row.revokedAt).toLocaleString('vi-VN')}`}
                    </p>
                  </div>
                  {!row.revokedAt && (
                    <button
                      type="button"
                      onClick={() => void revoke(row.id)}
                      className="rounded px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      Thu hồi
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
