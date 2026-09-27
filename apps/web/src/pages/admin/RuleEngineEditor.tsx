import React, { useState } from 'react';
import { Settings, Play, CheckCircle2, AlertCircle, Code2, Plus, Sparkles } from 'lucide-react';

export const RuleEngineEditor: React.FC = () => {
  const [selectedRule, setSelectedRule] = useState({
    id: 'rule-01',
    name: 'RULE_CAP_CHEERLEADER',
    version: 2,
    status: 'PUBLISHED',
    ruleType: 'CAP_RESTRICTION',
    jsonLogic: JSON.stringify(
      {
        and: [
          { '==': [{ var: 'declaredRole' }, 'CHEERLEADER'] },
          { '<=': [{ var: 'suggestedScore' }, 2.0] },
          { '<=': [{ var: 'termCheerleaderTotal' }, 5.0] },
        ],
      },
      null,
      2
    ),
  });

  const [testPayload, setTestPayload] = useState(
    JSON.stringify(
      {
        declaredRole: 'CHEERLEADER',
        suggestedScore: 3.5,
        termCheerleaderTotal: 4.0,
      },
      null,
      2
    )
  );

  const [testResult, setTestResult] = useState<any | null>(null);

  const handleTestRun = () => {
    try {
      const parsedTest = JSON.parse(testPayload);
      // Simulate rule execution
      const capped = parsedTest.declaredRole === 'CHEERLEADER' && parsedTest.suggestedScore > 2.0;
      setTestResult({
        passed: true,
        finalRecommendedScore: capped ? 2.0 : parsedTest.suggestedScore,
        capped: capped,
        message: capped
          ? 'Rule áp dụng thành công: Đã tự động cắt điểm (Cap) về mức tối đa 2.0đ cho vai trò Cổ vũ.'
          : 'Hồ sơ thỏa mãn toàn bộ điều kiện rule.',
      });
    } catch {
      alert('Dữ liệu JSON test không hợp lệ!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Rule Engine & Soạn thảo Luật (A05)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Soạn thảo, kiểm tra chạy thử (Dry-run) và phát hành phiên bản quy tắc tính điểm độc lập với AI.
          </p>
        </div>

        <button
          onClick={() => alert('Đã phát hành phiên bản quy tắc mới v3 thành công!')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Publish Phiên bản mới (v3)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Rule JSON Editor */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="font-bold text-xs text-slate-900 block">{selectedRule.name}</span>
              <span className="text-[10px] text-slate-500">Phiên bản: v{selectedRule.version} · Loại: {selectedRule.ruleType}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {selectedRule.status}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Logic JSON (JsonLogic Schema)</span>
            </label>
            <textarea
              rows={12}
              value={selectedRule.jsonLogic}
              onChange={(e) => setSelectedRule({ ...selectedRule, jsonLogic: e.target.value })}
              className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Right: Dry-Run Testing Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-900 uppercase">
              Kiểm tra chạy thử (Dry-Run Test)
            </span>
            <button
              onClick={handleTestRun}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Chạy thử ngay</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dữ liệu đầu vào giả lập (Input Context JSON):
            </label>
            <textarea
              rows={6}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 uppercase text-[11px] block">
                Kết quả thực thi Rule:
              </span>
              <div className="flex items-center justify-between">
                <span>Điểm chốt đề xuất:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {testResult.finalRecommendedScore} đ
                </span>
              </div>
              <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                {testResult.message}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
