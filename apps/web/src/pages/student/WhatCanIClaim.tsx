import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CheckCircle, ArrowRight, Calendar, MapPin, Award } from 'lucide-react';

export const WhatCanIClaim: React.FC = () => {
  const suggestions = [
    {
      category: 'Khung III: Hoạt động Văn thể mỹ & Xã hội',
      gap: 'Còn có thể tích lũy thêm tối đa 8.0 điểm',
      recommendedActivities: [
        {
          name: 'Hội thao Sinh viên Bách Khoa DUT Games 2026',
          points: '+4.0 điểm',
          date: '25/10/2026',
          location: 'Nhà thi đấu Đa năng',
          type: 'Nội bộ',
        },
        {
          name: 'Cuộc thi Tiếng hát Sinh viên Khoa CNTT',
          points: '+3.0 điểm',
          date: '02/11/2026',
          location: 'Hội trường F',
          type: 'Nội bộ',
        },
      ],
    },
    {
      category: 'Khung IV: Phẩm chất công dân & Cộng đồng',
      gap: 'Còn có thể tích lũy thêm tối đa 15.0 điểm',
      recommendedActivities: [
        {
          name: 'Ngày hội Chủ Nhật Đỏ — Hiến máu tình nguyện đợt 2',
          points: '+5.0 điểm',
          date: '15/11/2026',
          location: 'Khu E Bách Khoa',
          type: 'Nội bộ',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4 text-sky-600" />
          <span>Hỗ trợ định hướng tích lũy điểm</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">What Can I Claim? — Bạn còn có thể tích lũy điểm ở đâu? (S08)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Hệ thống AI tự động phân tích trần điểm các tiêu chí và đề xuất hoạt động phù hợp giúp bạn đạt loại Xuất sắc/Tốt.
        </p>
      </div>

      <div className="space-y-6">
        {suggestions.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-900 uppercase">{item.category}</span>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                {item.gap}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.recommendedActivities.map((act, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-sky-300 transition space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-slate-900">{act.name}</h4>
                      <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {act.points}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {act.date}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {act.location}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{act.type}</span>
                    <Link
                      to="/student/evidence/new"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      <span>Nộp minh chứng hoạt động này</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
