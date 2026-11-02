import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import { Evidence } from '../types';
import { errorMessage } from './EvaluationBoard';
import { StatusBadge } from './ui/StatusBadge';

export const EvidenceInspection: React.FC = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data,setData] = useState<Evidence | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let cancelled=false; setLoading(true); setError(''); setData(null);
    if (id) apiClient.getEvidenceById(id).then(value=>{if(!cancelled)setData(value);}).catch(err=>{if(!cancelled)setError(errorMessage(err));}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[id]);
  return <div className="space-y-4"><Link className="text-sm text-blue-700" to={params.get('studentId') ? `/admin/results/${params.get('studentId')}?termId=${params.get('termId') || ''}&tab=evidence` : '/admin/results'}>← Quay lại phiếu</Link><h1 className="text-xl font-bold">Tra cứu minh chứng</h1><p className="text-sm text-slate-600">CTSV xem căn cứ; cán bộ Khoa chịu trách nhiệm thẩm định.</p>{loading && <p role="status">Đang tải hồ sơ…</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{data && <><section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">{data.declaredActivityName}</h2><p className="my-2 text-sm">{data.student?.studentCode} · {data.student?.fullName}</p><StatusBadge status={data.status}/><p className="mt-3 whitespace-pre-wrap text-sm">{data.description}</p><h3 className="mt-4 text-sm font-semibold">Tệp minh chứng</h3><ul className="mt-2 space-y-2">{data.files?.map(f=><li key={f.id}><a className="text-sm text-blue-700 underline" href={f.fileUrl} target="_blank" rel="noreferrer">{f.fileName || 'Mở tệp minh chứng'}</a></li>)}</ul>{!data.files?.length && <p className="text-sm text-slate-500">Chưa có tệp.</p>}</section><section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Căn cứ xác minh</h2>{data.verificationResults?.map(v=><p key={v.id} className="mt-2 whitespace-pre-wrap text-sm">L{v.verificationLevel} · {v.status} · {v.sourceDescription}</p>)}{!data.verificationResults?.length && <p className="mt-2 text-sm text-slate-500">Chưa có kết quả xác minh.</p>}</section><section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Đề xuất AI</h2>{data.aiSuggestions?.map(a=><p key={a.id} className="mt-2 text-sm">{a.suggestedScore ?? 'Chưa đề xuất điểm'} · {a.reasoning}</p>)}{!data.aiSuggestions?.length && <p className="mt-2 text-sm text-slate-500">Chưa có đề xuất AI còn hiệu lực.</p>}</section><section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Lịch sử thẩm định</h2>{data.reviews?.map(r=><p key={r.id} className="mt-2 text-sm">{new Date(r.createdAt).toLocaleString('vi-VN')} · {r.decision} · {r.reason}</p>)}</section></>}</div>;
};
