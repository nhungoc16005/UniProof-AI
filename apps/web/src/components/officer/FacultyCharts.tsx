import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { FacultyClassProgress, FacultyKpi, StateCounts, facultyStates, percentage } from '../../lib/facultyAnalytics';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D6FC2]';
const countFormat = (n: number) => n.toLocaleString('vi-VN');
const pct = (n: number, total: number) => percentage(n, total).toLocaleString('vi-VN') + '%';
export function facultyListHref(termId: string, state?: string, classId?: string) {
  const params = new URLSearchParams({ termId });
  if (state) params.set('state', state);
  if (classId) params.set('classId', classId);
  return '/officer/students?' + params.toString();
}

export function FacultyStateChart({ counts, total, termId }: { counts: StateCounts; total: number; termId: string }) {
  const id = useId();
  const maximum = Math.max(1, ...Object.values(counts));
  return <figure aria-labelledby={id} className="space-y-4" data-testid="faculty-state-chart">
    <figcaption id={id} className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold font-heading text-[#0A0A0A]">Tiến độ trạng thái phiếu</h2>
        <p className="mt-0.5 text-xs text-[#6B6B6B]">Phân bố {countFormat(total)} phiếu rèn luyện theo từng bước thẩm định.</p>
      </div>
      <Link className={'text-xs font-semibold text-[#1D6FC2] hover:underline ' + focus} to={facultyListHref(termId)}>
        Tất cả phiếu →
      </Link>
    </figcaption>
    {total === 0 ? <p className="py-6 text-center text-xs text-[#6B6B6B]">Chưa có phiếu để thống kê trong kỳ này.</p> : <>
      <div className="rounded-xl bg-gradient-to-r from-[#EFF6FF] via-[#F0F7FF] to-[#E0F2FE] border border-[#BFDBFE] px-4 py-2.5 text-xs text-[#1E3A8A] flex items-center justify-between shadow-2xs">
        <span className="font-medium flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-[#1D6FC2]" />
          Đã bàn giao CTSV (gồm đã công bố):
        </span>
        <strong className="text-sm font-extrabold text-[#1D6FC2] tabular-nums">
          {countFormat(counts.SENT + counts.PUBLISHED)}/{countFormat(total)} ({pct(counts.SENT + counts.PUBLISHED, total)})
        </strong>
      </div>
      <ul className="space-y-2">
        {facultyStates.map(state => <li key={state.key}>
          <Link to={facultyListHref(termId, state.key)} className={'block rounded-lg p-2 hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all ' + focus} aria-label={`${state.label}: ${counts[state.key]} phiếu, ${pct(counts[state.key], total)}. Xem danh sách.`}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: state.color }} />
                {state.label}
              </span>
              <span className="shrink-0 tabular-nums">
                <strong className="font-extrabold text-[#0F172A]">{countFormat(counts[state.key])}</strong>
                <span className="ml-1.5 text-[#64748B] font-medium">({pct(counts[state.key], total)})</span>
              </span>
            </div>
            <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-[#F1F5F9] border border-[#E2E8F0]/70 p-0.5">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${counts[state.key] / maximum * 100}%`, backgroundColor: state.color }} />
            </div>
          </Link>
        </li>)}
      </ul>
      <p className="text-[11px] text-[#64748B]">Chọn bất kỳ trạng thái nào để mở danh sách hồ sơ tương ứng.</p>
    </>}
  </figure>;
}

const classGroups = [
  { key: 'notSubmitted', label: 'Chưa nộp', color: '#64748B', chipBg: 'bg-slate-50 text-slate-700 border-slate-200', states: ['NOT_SUBMITTED'], desc: 'Chưa nộp tự đánh giá (còn trong kỳ/chờ sinh viên)' },
  { key: 'processing', label: 'Đang xử lý', color: '#F59E0B', chipBg: 'bg-amber-50 text-amber-800 border-amber-200', states: ['REVIEWING', 'STUDENT_RETURNED', 'FACULTY_RETURNED'], desc: 'Đang thẩm định, chờ sinh viên sửa hoặc CTSV trả' },
  { key: 'ready', label: 'Sẵn sàng gửi', color: '#0284C7', chipBg: 'bg-sky-50 text-sky-800 border-sky-200', states: ['READY'], desc: 'Đã hoàn tất tại Khoa, sẵn sàng bàn giao' },
  { key: 'sent', label: 'Chờ CTSV công bố', color: '#1D6FC2', chipBg: 'bg-blue-50 text-blue-800 border-blue-200', states: ['SENT'], desc: 'Khoa đã bàn giao cho CTSV, chờ công bố' },
  { key: 'published', label: 'Đã công bố', color: '#059669', chipBg: 'bg-emerald-50 text-emerald-800 border-emerald-200', states: ['PUBLISHED'], desc: 'CTSV đã công bố kết quả chính thức' },
  { key: 'recorded', label: 'Ghi nhận không nộp', color: '#BE123C', chipBg: 'bg-rose-50 text-rose-800 border-rose-200', states: ['NOT_SUBMITTED_RECORDED'], desc: 'Quá hạn nộp và ghi nhận không nộp theo quy chế (thống kê riêng)' },
] as const;

function FacultyClassRow({ cls, termId }: { cls: FacultyClassProgress; termId: string }) {
  const [hoveredGroup, setHoveredGroup] = useState<typeof classGroups[number] | null>(null);
  const activeGroups = classGroups.filter(g => cls[g.key] > 0);
  const isComplete = cls.handedOver === cls.total && cls.total > 0;

  return (
    <li className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#1D6FC2]/40 hover:shadow-xs space-y-2.5">
      {/* 1. Header: Class code, student count and handoff progress */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Link className={'font-bold text-sm text-[#0F172A] hover:text-[#1D6FC2] hover:underline ' + focus} to={facultyListHref(termId, undefined, cls.id)}>
            {cls.code}
          </Link>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
            {countFormat(cls.total)} SV
          </span>
        </div>

        <div className="tabular-nums text-xs">
          {hoveredGroup ? (
            <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: hoveredGroup.color }}>
              <span className="h-2 w-2 rounded-full shadow-2xs" style={{ backgroundColor: hoveredGroup.color }} />
              {hoveredGroup.label}: <strong>{cls[hoveredGroup.key]} SV</strong> ({pct(cls[hoveredGroup.key], cls.total)})
            </span>
          ) : isComplete ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã bàn giao 100%
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[#64748B]">
              <span>Bàn giao:</span>
              <strong className="text-[#0F172A] font-extrabold">{cls.handedOver}/{cls.total}</strong>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${cls.handedOver > 0 ? 'bg-[#EFF6FF] text-[#1D6FC2] border border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'}`}>
                {pct(cls.handedOver, cls.total)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Sleek stacked progress bar (no ugly fat grey block, no text clutters inside) */}
      <div
        className="relative flex h-3.5 w-full rounded-full bg-[#F1F5F9] p-0.5 border border-[#E2E8F0] shadow-2xs"
        role="img"
        aria-label={`${cls.code}: ${classGroups.map(g => `${g.label} ${cls[g.key]}`).join(', ')}. Đã bàn giao ${pct(cls.handedOver, cls.total)}.`}
      >
        {activeGroups.map((group, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === activeGroups.length - 1;
          const roundedClass = isFirst && isLast ? 'rounded-full' : isFirst ? 'rounded-l-full' : isLast ? 'rounded-r-full' : '';
          return (
            <Link
              key={group.key}
              to={facultyListHref(termId, group.states[0], cls.id)}
              onMouseEnter={() => setHoveredGroup(group)}
              onMouseLeave={() => setHoveredGroup(null)}
              style={{ width: `${(cls[group.key] / cls.total) * 100}%`, backgroundColor: group.color }}
              className={`group/seg relative h-full transition-all duration-150 hover:brightness-110 hover:z-20 focus-visible:outline-none ${roundedClass}`}
              aria-label={`${group.label}: ${cls[group.key]} SV (${pct(cls[group.key], cls.total)})`}
            >
              {/* Floating popup tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/seg:flex flex-col items-center z-30 whitespace-nowrap">
                <div className="rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-xl flex items-center gap-1.5 border border-white/10">
                  <span className="h-2 w-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: group.color }} />
                  <span>{group.label}:</span>
                  <strong className="text-white font-bold">{cls[group.key]} SV</strong>
                  <span className="text-white/70">({pct(cls[group.key], cls.total)})</span>
                </div>
                <div className="h-1.5 w-2.5 bg-[#0F172A] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* 3. Quick mini breakdown chips for groups present in this class + direct link */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {activeGroups.map((group) => (
            <Link
              key={group.key}
              to={facultyListHref(termId, group.states[0], cls.id)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all hover:scale-102 ${group.chipBg}`}
              title={`Xem ${cls[group.key]} phiếu ${group.label}`}
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              <span>{group.label}:</span>
              <strong>{cls[group.key]}</strong>
            </Link>
          ))}
        </div>

        <Link
          to={facultyListHref(termId, undefined, cls.id)}
          className="text-[11px] font-semibold text-[#1D6FC2] hover:underline inline-flex items-center gap-0.5 ml-auto"
        >
          Xem hồ sơ lớp <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </li>
  );
}

export function FacultyClassChart({ classes, termId }: { classes: FacultyClassProgress[]; termId: string }) {
  const id = useId();
  const [table, setTable] = useState(false), [all, setAll] = useState(false);
  const visible = all ? classes : classes.slice(0, 8);
  return <figure aria-labelledby={id} data-testid="faculty-class-chart" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <figcaption id={id}>
        <h2 className="text-base font-semibold font-heading text-[#0A0A0A]">Tiến độ giữa các lớp</h2>
        <p className="mt-1 max-w-xl text-xs text-[#6B6B6B]">Ưu tiên lớp có tỷ lệ phiếu chưa bàn giao cao; di chuột vào từng phân đoạn để xem chi tiết.</p>
      </figcaption>
      <button type="button" aria-pressed={table} onClick={() => setTable(v => !v)} className={'rounded-md border border-[#E8E8EC] px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#FAFAFA] ' + focus}>
        {table ? 'Xem dạng thanh' : 'Xem dạng bảng'}
      </button>
    </div>
    {!classes.length ? <p className="py-8 text-center text-sm text-[#6B6B6B]">Chưa có danh sách lớp trong kỳ này.</p> : table ? <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs"><caption className="sr-only">Số phiếu và tiến độ bàn giao theo lớp</caption><thead><tr className="border-b bg-[#FAFAFA]">{['Lớp', 'Sĩ số', ...classGroups.map(g => g.label), 'Tỷ lệ bàn giao'].map(label => <th key={label} scope="col" className="px-2 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{visible.map(cls => <tr key={cls.id} className="border-b border-[#E8E8EC]">
          <th scope="row" className="px-2 py-3"><Link className={'text-[#1D6FC2] ' + focus} to={facultyListHref(termId, undefined, cls.id)}>{cls.code}</Link></th><td className="px-2 py-3">{cls.total}</td>
          {classGroups.map(group => <td key={group.key} className="px-2 py-3">{group.key === 'processing' ? <details><summary className={'cursor-pointer ' + focus}>{cls.processing}</summary><div className="space-y-2 py-2">{group.states.map(state => <Link key={state} className="block text-[#1D6FC2]" to={facultyListHref(termId, state, cls.id)}>{facultyStates.find(s => s.key === state)?.label}: {cls.counts[state]}</Link>)}</div></details> : <Link className={'text-[#1D6FC2] ' + focus} to={facultyListHref(termId, group.states[0], cls.id)}>{cls[group.key]}</Link>}</td>)}
          <td className="px-2 py-3">{pct(cls.handedOver, cls.total)}</td>
        </tr>)}</tbody>
      </table>
    </div> : <>
      <div className="flex flex-col gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs">
        <ul aria-label="Chú giải tiến độ lớp" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
          {classGroups.map(group => (
            <li key={group.key} className="flex items-center gap-1.5" title={group.desc}>
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: group.color }} />
              <span className="font-semibold text-[#0F172A]">{group.label}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1 border-t border-[#E2E8F0] pt-2 text-[11px] text-[#64748B] sm:grid-cols-2">
          <div><span className="font-bold text-[#475569]">• Chưa nộp:</span> Chưa nộp tự đánh giá (còn trong hạn/chờ sinh viên).</div>
          <div><span className="font-bold text-[#BE123C]">• Ghi nhận không nộp:</span> Quá hạn nộp và ghi nhận không nộp theo quy chế (thống kê riêng).</div>
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-[#64748B] font-medium px-1" aria-hidden="true"><span>0% bàn giao</span><span>50%</span><span>100%</span></div>
      <ul className="space-y-3">{visible.map(cls => <FacultyClassRow key={cls.id} cls={cls} termId={termId} />)}</ul>
    </>}
    {classes.length > 8 && <button type="button" aria-expanded={all} onClick={() => setAll(v => !v)} className={'rounded-md border border-[#E8E8EC] px-3 py-2 text-xs font-semibold text-[#1D6FC2] ' + focus}>{all ? 'Thu gọn (8 lớp)' : `Xem tất cả ${classes.length} lớp`}</button>}
    {classes.length > 0 && <p className="text-[11px] leading-5 text-[#64748B]">Đã bàn giao bao gồm phiếu chờ công bố và đã công bố. Mỗi thanh thể hiện 100% sĩ số lớp.</p>}
  </figure>;
}

export function FacultyEvidenceDonut({ kpi, termId }: { kpi: FacultyKpi; termId: string }) {
  const id = useId();
  const total = kpi.totalEvidences;
  const remaining = total - kpi.approvedEvidences - kpi.rejectedEvidences;
  const valid = [total, kpi.approvedEvidences, kpi.rejectedEvidences, remaining].every(n => Number.isInteger(n) && n >= 0);
  const items = [
    { label: 'Đã duyệt', count: kpi.approvedEvidences, color: '#059669', status: 'APPROVED' },
    { label: 'Từ chối', count: kpi.rejectedEvidences, color: '#DC2626', status: 'REJECTED' },
    { label: 'Đang thẩm định / Chờ', count: remaining, color: '#D97706', status: undefined },
  ];
  let offset = 0;
  return <figure aria-labelledby={id} data-testid="faculty-evidence-donut" className="space-y-4">
    <figcaption id={id} className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold font-heading text-[#0A0A0A]">Tình hình minh chứng</h2>
        <p className="mt-0.5 text-xs text-[#6B6B6B]">Tỷ trọng hồ sơ đã có quyết định và đang xử lý.</p>
      </div>
      <Link className={'text-xs font-semibold text-[#1D6FC2] hover:underline ' + focus} to={'/officer/queue?' + new URLSearchParams({ termId })}>
        Mở hàng đợi →
      </Link>
    </figcaption>
    {!valid ? <p role="alert" className="text-sm text-red-700">Số liệu minh chứng chưa nhất quán. Vui lòng làm mới.</p> : total === 0 ? <p className="py-6 text-center text-xs text-[#6B6B6B]">Chưa có minh chứng trong kỳ này.</p> : <>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 180 180" className="h-full w-full" role="img" aria-label={items.map(item => `${item.label}: ${item.count} (${pct(item.count, total)})`).join('; ')}>
            <circle cx="90" cy="90" r="68" fill="none" stroke="#F4F4F6" strokeWidth="22" />
            {items.map(item => { const value = item.count / total * 100, start = offset; offset += value; return value > 0 ? <circle key={item.label} cx="90" cy="90" r="68" pathLength="100" fill="none" stroke={item.color} strokeWidth="22" strokeDasharray={`${value} ${100 - value}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" /> : null; })}
          </svg>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl font-bold tabular-nums text-[#0A0A0A]">{countFormat(total)}</strong><span className="text-[10px] text-[#6B6B6B]">minh chứng</span></div>
        </div>
        <ul className="w-full min-w-0 space-y-2 text-xs">{items.map(item => <li key={item.label}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />{item.status ? <Link className={'text-[#1D6FC2] hover:underline ' + focus} to={'/officer/queue?' + new URLSearchParams({ termId, status: item.status })}>{item.label}</Link> : <span className="text-[#0A0A0A]">{item.label}</span>}</span><span className="shrink-0 tabular-nums font-medium text-[#0A0A0A]"><strong>{countFormat(item.count)}</strong> · <span className="text-[#6B6B6B]">{pct(item.count, total)}</span></span></div></li>)}</ul>
      </div>
      <p className="text-xs text-[#6B6B6B] leading-relaxed"><strong className="text-[#0A0A0A]">{pct(kpi.approvedEvidences + kpi.rejectedEvidences, total)}</strong> hồ sơ đã có quyết định cuối. Nhóm đang thẩm định có thể đang xác minh hoặc chờ sinh viên bổ sung.</p>
    </>}
  </figure>;
}
