import React, { useState } from 'react';
import { AiConfig } from './AiConfig';
import { GroundTruth } from './GroundTruth';
import { AiEvaluation } from './AiEvaluation';
import { Cpu, Database, BarChart2 } from 'lucide-react';

export const AiCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'groundtruth' | 'evaluation'>('config');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Trung tâm Điều hành & Đánh giá AI (A07 - A09)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý toàn diện các mô hình trí tuệ nhân tạo PhoBERT / OCR: cấu hình ngưỡng suy luận, tập dữ liệu kiểm chuẩn và benchmark chất lượng.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'config'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Cấu hình Ngưỡng & Tham số (A07)</span>
        </button>

        <button
          onClick={() => setActiveTab('groundtruth')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'groundtruth'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Dữ liệu kiểm chuẩn Ground Truth (A08)</span>
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${
            activeTab === 'evaluation'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Báo cáo Đánh giá & Benchmark (A09)</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && <AiConfig />}
      {activeTab === 'groundtruth' && <GroundTruth />}
      {activeTab === 'evaluation' && <AiEvaluation />}
    </div>
  );
};
