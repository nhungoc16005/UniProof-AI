import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { PageHeader } from '../../components/shared/PageHeader';
import { InsightPanel } from '../../components/shared/InsightPanel';
import { MessageSquare, Send, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const Appeals: React.FC = () => {
  const { activeTerm } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [canAppeal, setCanAppeal] = useState(false);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [appeals, payload] = await Promise.all([
        apiClient.getAppeals({ termId: activeTerm.id, pageSize: 100 }),
        apiClient.getMyAssessments(activeTerm.id),
      ]);
      setItems(appeals);
      setCanAppeal(!!payload.permissions?.canAppeal);
      setCriteria(
        payload.categories
          .flatMap((c) => c.criteria)
          .filter((c) => c.assessment?.officialScore != null)
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không tải được phúc khảo và kết quả công bố.');
    }
  };

  useEffect(() => {
    void load();
  }, [activeTerm.id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient.createAppeal({ criterionAssessmentId: selected, content: content.trim() });
      setContent('');
      setSelected('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không gửi được phúc khảo.');
    } finally {
      setBusy(false);
    }
  };

  const appealDeadlineFormatted = activeTerm.appealDeadline
    ? new Date(activeTerm.appealDeadline).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Chưa xác định';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phúc khảo kết quả rèn luyện"
        description={`${activeTerm.name} · Hạn phúc khảo: ${appealDeadlineFormatted}`}
        badge={
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              canAppeal
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-[#F3F4F6] text-[#6B6B6B] border border-[#E8E8EC]'
            }`}
          >
            {canAppeal ? 'Đang mở tiếp nhận' : 'Chưa đến hạn / Đã đóng'}
          </span>
        }
      />

      {error && (
        <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {canAppeal ? (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-[12px] border border-[#E8E8EC] bg-white p-5 shadow-xs"
        >
          <div className="border-b border-[#E8E8EC] pb-3">
            <h2 className="font-heading font-semibold text-base text-[#0A0A0A]">
              Tạo đơn khiếu nại / phúc khảo
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Chọn tiêu chí đã có điểm chính thức và nêu rõ căn cứ đối chiếu để Khoa xem xét mở lại đánh giá.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
              Tiêu chí đề nghị xem lại <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] p-2.5 text-sm font-medium text-[#0A0A0A] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
            >
              <option value="">Chọn tiêu chí đã công bố</option>
              {criteria.map((c) => (
                <option key={c.id} value={c.assessment.id}>
                  Mục {c.code}. {c.name} · Điểm công bố: {c.assessment.officialScore}/{c.maxScore} đ
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
              Giải trình chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-[6px] border border-[#E8E8EC] bg-[#FAFAFA] p-3 text-sm text-[#0A0A0A] placeholder-[#8A8A8E] focus:bg-white focus:border-[#1D6FC2] focus:outline-none transition-colors"
              placeholder="Nêu rõ lý do, nội dung cần xem lại và các minh chứng bổ sung liên quan…"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={busy || !selected || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1D6FC2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#175A9E] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Send className="h-4 w-4" />
              {busy ? 'Đang gửi…' : 'Gửi đơn phúc khảo'}
            </button>
          </div>
        </form>
      ) : (
        <InsightPanel
          type="info"
          title="Cổng phúc khảo hiện đang đóng"
        >
          Sinh viên chỉ có thể gửi đơn phúc khảo sau khi CTSV công bố kết quả tạm thời, trong thời hạn quy định và trước khi học kỳ chính thức chốt sổ.
        </InsightPanel>
      )}

      {/* History */}
      <div className="space-y-4">
        <h2 className="font-heading font-semibold text-base text-[#0A0A0A]">
          Lịch sử đơn phúc khảo ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="rounded-[12px] border border-[#E8E8EC] bg-white p-8 text-center text-sm text-[#6B6B6B]">
            <MessageSquare className="mx-auto h-8 w-8 text-[#8A8A8E] mb-2" />
            <p className="font-medium text-[#0A0A0A]">Chưa có đơn phúc khảo nào trong kỳ này</p>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Các đơn phúc khảo bạn gửi sẽ được lưu và cập nhật trạng thái tại đây
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <article
                key={a.id}
                className="rounded-[12px] border border-[#E8E8EC] bg-white p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#E8E8EC] pb-2.5">
                  <div>
                    <h3 className="font-heading font-semibold text-sm text-[#0A0A0A]">
                      {a.criterion ? `Mục ${a.criterion.code}. ${a.criterion.name}` : 'Đề nghị xem lại minh chứng'}
                    </h3>
                    {a.publishedScore !== undefined && a.publishedScore !== null && (
                      <p className="text-xs text-[#6B6B6B] mt-0.5">
                        Điểm công bố: <strong className="text-[#0A0A0A]">{a.publishedScore} đ</strong>
                      </p>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      a.status === 'ACCEPTED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : a.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {a.status === 'ACCEPTED' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Chấp thuận, đánh giá lại
                      </>
                    ) : a.status === 'REJECTED' ? (
                      <>
                        <XCircle className="h-3 w-3" />
                        Đã bác đơn
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Chờ Khoa xử lý
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-1">
                    Giải trình của bạn:
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-[#0A0A0A] bg-[#FAFAFA] rounded-[6px] p-2.5 border border-[#E8E8EC]">
                    {a.content}
                  </p>
                </div>

                {a.resolutionNote && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                      Phản hồi từ Cán bộ Khoa:
                    </p>
                    <p className="text-sm text-emerald-900 bg-emerald-50/50 rounded-[6px] p-2.5 border border-emerald-200">
                      {a.resolutionNote}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
