import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { Criterion, RubricPayload } from '../../types';

export const RegulationRAG: React.FC = () => {
  const { activeTerm } = useAuth();
  const [rubric, setRubric] = useState<RubricPayload | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeTerm?.id) return;
    setLoading(true);
    setError('');
    apiClient.getRubric(activeTerm.id)
      .then(setRubric)
      .catch(() => setError('Không tải được nội dung quy chế từ Backend.'))
      .finally(() => setLoading(false));
  }, [activeTerm?.id]);

  const matches = useMemo(() => {
    const query = question.trim().toLocaleLowerCase('vi');
    if (!query) return [];
    const terms = query.split(/\s+/).filter((term) => term.length > 1);
    return (rubric?.criteria || []).map((criterion: Criterion) => {
      const text = `${criterion.code} ${criterion.name} ${criterion.description}`.toLocaleLowerCase('vi');
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { criterion, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [question, rubric]);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><BookOpen className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-bold text-slate-900">Tra cứu tiêu chí rèn luyện</h1><p className="mt-1 text-sm text-slate-600">Kết quả được trích từ phiên bản rubric của {activeTerm?.name || 'kỳ đang chọn'}.</p></div>
      </header>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Tìm theo nội dung, ví dụ: hoạt động tình nguyện, học phí, họp lớp…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </label>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {loading ? <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">Đang tải quy chế từ Backend…</p> : !rubric?.rubricVersion ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Kỳ này chưa có rubric đã ban hành. Hệ thống chưa có nội dung để tra cứu.</p>
      ) : !question.trim() ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nhập từ khóa để tìm trong {rubric.criteria.length} tiêu chí của phiên bản {rubric.rubricVersion.version}.</p>
      ) : matches.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Không tìm thấy đoạn phù hợp trong rubric của kỳ này. Hãy thử từ khóa khác hoặc hỏi Phòng Công tác sinh viên.</p>
      ) : (
        <section className="space-y-3" aria-live="polite">
          {matches.map(({ criterion }) => (
            <article key={criterion.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold text-slate-900">Mục {criterion.code}. {criterion.name}</h2><span className="text-sm font-semibold text-blue-700">Tối đa {criterion.maxScore} điểm</span></div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{criterion.description}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};
