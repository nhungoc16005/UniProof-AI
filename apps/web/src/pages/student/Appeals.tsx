import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
export const Appeals: React.FC = () => {
 const { activeTerm } = useAuth();
 const [items,setItems] = useState<any[]>([]);
 const [criteria,setCriteria] = useState<any[]>([]);
 const [canAppeal,setCanAppeal] = useState(false);
 const [selected,setSelected] = useState('');
 const [content,setContent] = useState('');
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 const load = async () => {
  setError('');
  try {
   const [appeals,payload] = await Promise.all([apiClient.getAppeals({termId:activeTerm.id,pageSize:100}),apiClient.getMyAssessments(activeTerm.id)]);
   setItems(appeals); setCanAppeal(!!payload.permissions?.canAppeal);
   setCriteria(payload.categories.flatMap(c=>c.criteria).filter(c=>c.assessment?.officialScore != null));
  } catch(err:any) {setError(err.response?.data?.error?.message || 'Không tải được phúc khảo và kết quả công bố.');}
 };
 useEffect(()=>{void load();},[activeTerm.id]);
 const submit = async (event: React.FormEvent) => {
  event.preventDefault(); setBusy(true);setError('');
  try {await apiClient.createAppeal({criterionAssessmentId:selected,content:content.trim()});setContent('');setSelected('');await load();}
  catch(err:any){setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không gửi được phúc khảo.');}
  finally{setBusy(false);}
 };
 return <div className="space-y-5"><header><h1 className="text-xl font-bold">Phúc khảo kết quả rèn luyện</h1><p className="mt-1 text-sm text-slate-600">{activeTerm.name} · Hạn phúc khảo: {new Date(activeTerm.appealDeadline).toLocaleString('vi-VN')}</p></header>
 {error&&<p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
 {canAppeal ? <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-5"><label className="block text-sm font-semibold">Tiêu chí đề nghị xem lại<select required value={selected} onChange={e=>setSelected(e.target.value)} className="mt-2 w-full rounded-lg border p-2 font-normal"><option value="">Chọn tiêu chí đã công bố</option>{criteria.map(c=><option key={c.id} value={c.assessment.id}>{c.code}. {c.name} · {c.assessment.officialScore}/{c.maxScore} điểm</option>)}</select></label><label className="block text-sm font-semibold">Giải trình<textarea required value={content} onChange={e=>setContent(e.target.value)} rows={4} className="mt-2 w-full rounded-lg border p-3 font-normal" placeholder="Nêu nội dung cần xem lại và căn cứ liên quan" /></label><button disabled={busy||!selected||!content.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Gửi phúc khảo</button></form> : <p className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">Chỉ gửi phúc khảo sau khi CTSV công bố tạm, trong hạn và trước khi kỳ được chốt.</p>}
 <div className="space-y-3"><h2 className="font-semibold">Đơn đã gửi</h2>{items.map(a=><article key={a.id} className="space-y-2 rounded-xl border bg-white p-4 text-sm"><h3 className="font-semibold">{a.criterion ? 'Mục '+a.criterion.code+'. '+a.criterion.name : 'Đề nghị xem lại minh chứng'}</h3><p className="whitespace-pre-wrap">{a.content}</p><p className="text-slate-500">{a.status==='PENDING'?'Chờ Khoa xử lý':a.status==='ACCEPTED'?'Chấp thuận, đánh giá lại':'Đã bác đơn'}</p>{a.resolutionNote&&<p>Phản hồi: {a.resolutionNote}</p>}</article>)}{!items.length&&<p className="text-sm text-slate-500">Chưa có đơn trong kỳ.</p>}</div></div>;
};
