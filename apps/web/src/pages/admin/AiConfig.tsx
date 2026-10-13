import React, { useState, useEffect } from 'react';
import { Cpu, Sliders, ShieldAlert, Check, RefreshCw } from 'lucide-react';

export const AiConfig: React.FC = () => {
  const [ocrThreshold, setOcrThreshold] = useState(0.85);
  const [abstentionThreshold, setAbstentionThreshold] = useState(0.60);
  const [selectiveThreshold, setSelectiveThreshold] = useState(0.80);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    try {
      const savedOcr = localStorage.getItem('ai_config_ocr');
      const savedAbs = localStorage.getItem('ai_config_abstention');
      const savedSel = localStorage.getItem('ai_config_selective');
      if (savedOcr) setOcrThreshold(parseFloat(savedOcr));
      if (savedAbs) setAbstentionThreshold(parseFloat(savedAbs));
      if (savedSel) setSelectiveThreshold(parseFloat(savedSel));
    } catch (e) {
      // ignore
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('ai_config_ocr', ocrThreshold.toString());
      localStorage.setItem('ai_config_abstention', abstentionThreshold.toString());
      localStorage.setItem('ai_config_selective', selectiveThreshold.toString());
    } catch (e) {
      // ignore
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cấu hình Ngưỡng & Tham số AI (A07)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Kiểm soát mức độ thận trọng của mô hình AI, ngưỡng tự động từ chối dự đoán (Abstention) và ngưỡng cảnh báo OCR.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu thành công cấu hình tham số AI!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        
        {/* OCR Confidence Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-bold text-xs text-slate-800 block">
                Ngưỡng tin cậy OCR (OCR Confidence Threshold)
              </label>
              <span className="text-[11px] text-slate-500">
                Nếu điểm tin cậy quét chữ dưới ngưỡng này, hệ thống sẽ gắn cờ <code>low_confidence=true</code> và cảnh báo vàng cho Cán bộ.
              </span>
            </div>
            <span className="font-mono font-bold text-sky-700 text-sm bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              {ocrThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            value={ocrThreshold}
            onChange={(e) => setOcrThreshold(parseFloat(e.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        {/* Abstention Threshold */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-bold text-xs text-slate-800 block">
                Ngưỡng từ chối đề xuất (Abstention Threshold)
              </label>
              <span className="text-[11px] text-slate-500">
                Nếu độ tin cậy phân loại tiêu chí thấp hơn mức này, AI sẽ <strong>từ chối đưa ra điểm đề xuất (Abstain)</strong> để tránh phán đoán sai lệch.
              </span>
            </div>
            <span className="font-mono font-bold text-sky-700 text-sm bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              {abstentionThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.4"
            max="0.8"
            step="0.01"
            value={abstentionThreshold}
            onChange={(e) => setAbstentionThreshold(parseFloat(e.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        {/* Selective Prediction Threshold */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-bold text-xs text-slate-800 block">
                Ngưỡng xét Fast-track (Selective Prediction Threshold)
              </label>
              <span className="text-[11px] text-slate-500">
                Hồ sơ có điểm tin cậy tổng thể trên ngưỡng này và có đối chứng L1/L2 sẽ được đưa vào luồng duyệt nhanh.
              </span>
            </div>
            <span className="font-mono font-bold text-sky-700 text-sm bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              {selectiveThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.7"
            max="0.95"
            step="0.01"
            value={selectiveThreshold}
            onChange={(e) => setSelectiveThreshold(parseFloat(e.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            Lưu cấu hình ngưỡng
          </button>
        </div>
      </form>
    </div>
  );
};
