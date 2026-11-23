import React from 'react';
import { EvidenceInspectionResult } from '../types';

export interface AiPipelineAdviceResult {
  kind: 'pipeline';
  score?: number | null;
  checkerResults: Array<{ checker: string; status: string; message_vi?: string | null }>;
  scoreBreakdown: Array<{ component: string; source: string; status: string; score: number; weight: number }>;
  decisionReason?: string | null;
  error?: string | null;
}

type AiPanelResult = EvidenceInspectionResult | AiPipelineAdviceResult;
const isPipelineAdvice = (value: AiPanelResult): value is AiPipelineAdviceResult =>
  (value as AiPipelineAdviceResult).kind === 'pipeline';

const tierStyles: Record<string, { label: string; className: string }> = {
  GREEN: { label: 'XANH · Hợp lệ cao', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  YELLOW_STRONG: { label: 'VÀNG MẠNH · Duyệt nhanh', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  YELLOW_WEAK: { label: 'VÀNG YẾU · Duyệt kỹ', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  RED: { label: 'ĐỎ · Cần từ chối/xem lại', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const checkStatusLabels: Record<string, string> = {
  PASS: 'Đạt',
  REVIEW: 'Cần xem lại',
  FAIL: 'Không đạt',
  NOT_CHECKED: 'Chưa kiểm tra',
};

const checkStatusClass: Record<string, string> = {
  PASS: 'text-emerald-700',
  REVIEW: 'text-amber-700',
  FAIL: 'text-rose-700',
  NOT_CHECKED: 'text-slate-500',
};

const formatPercent = (value?: number | null) =>
  value == null ? '—' : `${Math.round(value > 1 ? value : value * 100)}%`;

export const AiResultPanel: React.FC<{ result: AiPanelResult; mode?: 'OFF' | 'SHADOW' | 'ASSIST' }> = ({ result, mode = 'ASSIST' }) => {
  if (mode !== 'ASSIST') return null;

  if (isPipelineAdvice(result)) {
    const hasUnresolvedChecks = result.checkerResults.some((check) => check.status === 'REVIEW' || check.status === 'NOT_CHECKED');
    const score = result.score == null ? null : hasUnresolvedChecks ? Math.min(result.score, 89) : result.score;
    const labels = { PASS: 'Đạt', REVIEW: 'Cần xem lại', FAIL: 'Không đạt', NOT_CHECKED: 'Chưa kiểm tra' };
    const statusClasses = { PASS: 'text-emerald-700', REVIEW: 'text-amber-700', FAIL: 'text-rose-700', NOT_CHECKED: 'text-slate-500' };
    return (
      <section role="region" aria-label="Gợi ý của hệ thống" className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between border-b border-violet-200 pb-2">
          <h3 className="text-sm font-bold text-violet-950">Gợi ý của hệ thống · Cán bộ quyết định</h3>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-violet-800">Không phải quyết định chính thức</span>
        </div>
        {result.decisionReason && <p className="mt-2 text-xs text-slate-700">{result.decisionReason}</p>}
        {result.error && <p role="status" className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">{result.error}</p>}
        {!!result.checkerResults.length && <ul className="mt-2 space-y-1 text-xs">{result.checkerResults.map((check, index) => <li key={`${check.checker}-${index}`} className="flex items-start justify-between gap-3 rounded bg-white px-2 py-1.5">
          <span className="font-medium text-slate-700">{check.message_vi || check.checker}</span><span className={`shrink-0 font-semibold ${statusClasses[check.status as keyof typeof statusClasses] || 'text-slate-500'}`}>{labels[check.status as keyof typeof labels] || 'Chưa kiểm tra'}</span>
        </li>)}</ul>}
        {!!result.scoreBreakdown.length && <div className="mt-3 border-t border-violet-200 pt-2">
          <p className="text-xs font-bold text-slate-700">Điểm gợi ý: {score ?? '—'} / 100 · không phải xác suất</p>
          <ul className="mt-1 space-y-1 text-[11px] text-slate-600">{result.scoreBreakdown.map((row, index) => <li key={`${row.component}-${index}`} className="flex justify-between gap-2"><span>{row.component} · {labels[row.status as keyof typeof labels] || 'Chưa kiểm tra'} · nguồn: {row.source}</span><span>{row.score} (trọng số {row.weight})</span></li>)}</ul>
        </div>}
      </section>
    );
  }

  const hasUnresolvedChecks = result.documentChecks.some((check) => check.status === 'REVIEW' || check.status === 'NOT_CHECKED');
  const displayedScore = hasUnresolvedChecks ? Math.min(result.aiConfidenceScore, 89) : result.aiConfidenceScore;
  const requestedTier = hasUnresolvedChecks && result.tier === 'GREEN' ? 'YELLOW_WEAK' : result.tier;
  const tier = tierStyles[requestedTier] || { label: requestedTier, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  const ocr = result.ocrExtraction;
  const quality = result.qualityCheck;
  const web = result.webVerification;
  const breakdownEntries = Object.entries(result.breakdown || {});

  return (
    <div role="region" aria-label="Gợi ý của hệ thống" className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gợi ý của hệ thống · Cán bộ quyết định</p>
            <p className="text-3xl font-bold text-slate-900">
              {displayedScore}
              <span className="text-base font-medium text-slate-500">/100</span>
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tier.className}`}>{tier.label}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Điểm này là tín hiệu hỗ trợ, không phải xác suất hoặc quyết định duyệt.</p>
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Luồng xử lý</dt>
            <dd className="font-semibold text-slate-900">{result.pipelineMode}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phân loại</dt>
            <dd className="font-semibold text-slate-900">{result.classification}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Trùng lặp</dt>
            <dd className="font-semibold text-slate-900">
              {result.isDuplicate ? `Có (${result.duplicateMatchType || 'không rõ'})` : 'Không'}
            </dd>
          </div>
        </dl>
        {result.recommendation && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{result.recommendation}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-800">Chất lượng ảnh</h3>
        <p className="mt-1 text-sm text-slate-700">
          {quality.passed ? 'Đạt ngưỡng' : 'Cần xem lại'} · điểm chất lượng {quality.qualityScore}/100 (ngưỡng {quality.qualityThreshold})
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Độ nét (Laplacian) {quality.blurScore} · độ sáng {quality.brightness}
          {quality.skewAngle != null ? ` · góc nghiêng ${quality.skewAngle}°` : ''}
        </p>
        {quality.errorDetails && <p className="mt-1 text-xs text-rose-700">{quality.errorDetails}</p>}
      </section>

      {(result.rubricPrediction || result.criterionAssessment?.mlPrediction) && (() => {
        const ml = result.rubricPrediction || result.criterionAssessment?.mlPrediction!;
        return (
          <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-indigo-950">
                Phân loại Tiêu chí Rubric (Model ML tự huấn luyện)
              </h3>
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-800">
                {ml.modelName} v{ml.modelVersion}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-indigo-950">
              Tiêu chí phù hợp nhất: <strong>{ml.predictedLabelName}</strong>{' '}
              <span className="font-semibold text-indigo-700">({Math.round(ml.confidence * 100)}%)</span>
            </p>
            {!!ml.topCandidates?.length && (
              <div className="mt-2.5 space-y-1.5">
                {ml.topCandidates.map((cand) => {
                  const pct = Math.round(cand.probability * 100);
                  return (
                    <div key={cand.label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px] text-slate-700">
                        <span className="font-medium">{cand.labelName}</span>
                        <span className="font-mono font-semibold">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Kết quả dự đoán từ tập 123 mẫu hoạt động thực tế (chỉ hỗ trợ gợi ý, không thay thế quyết định cán bộ).
            </p>
          </section>
        );
      })()}

      {result.criterionAssessment && (
        <section className="rounded-xl border border-indigo-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Gợi ý chấm điểm theo tiêu chí Rubric (Tầng 2)</h3>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-800 border border-indigo-200">
              {result.criterionAssessment.suggestedScore != null
                ? `Gợi ý: ${result.criterionAssessment.suggestedScore} điểm`
                : 'Chưa xác định điểm (Cán bộ quyết định)'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-800">
            Trạng thái: <strong>{result.criterionAssessment.status}</strong>
            {result.criterionAssessment.matchScore != null ? ` · Mức khớp điều kiện: ${result.criterionAssessment.matchScore}%` : ''}
          </p>
          {result.criterionAssessment.reason && (
            <p className="mt-1 text-xs text-slate-700">{result.criterionAssessment.reason}</p>
          )}
          {!!result.criterionAssessment.matchedRequirements?.length && (
            <p className="mt-2 text-xs text-emerald-800">
              <strong>Điều kiện đã tìm thấy:</strong> {result.criterionAssessment.matchedRequirements.join('; ')}
            </p>
          )}
          {!!result.criterionAssessment.missingRequirements?.length && (
            <p className="mt-1 text-xs text-amber-800">
              <strong>Điều kiện còn thiếu / cần kiểm tra:</strong> {result.criterionAssessment.missingRequirements.join('; ')}
            </p>
          )}
        </section>
      )}

      {ocr && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Nhận dạng văn bản (OCR)</h3>
            {(ocr.recognitionMethod || ocr.processingTimeMs != null) && (
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                {ocr.recognitionMethod || 'ocr'}
                {ocr.processingTimeMs != null ? ` · ${ocr.processingTimeMs} ms` : ''}
              </span>
            )}
          </div>
          {ocr.available ? (
            <>
              <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                <p>Họ tên trích xuất: <strong>{ocr.studentNameExtracted || '—'}</strong> · khớp {formatPercent(ocr.nameMatchRatio)}</p>
                <p>MSSV trích xuất: <strong>{ocr.studentCodeExtracted || '—'}</strong> · {ocr.codeMatched ? 'khớp' : ocr.codeMismatch ? 'không khớp' : 'chưa đối chiếu'}</p>
                <p>Tên hoạt động: <strong>{ocr.activityNameExtracted || '—'}</strong> · khớp {formatPercent(ocr.activityNameMatchRatio)}</p>
                <p>Đơn vị cấp: <strong>{ocr.organizerExtracted || '—'}</strong></p>
                <p>Ngày cấp: <strong>{ocr.issuedDateExtracted || '—'}</strong></p>
                {ocr.certificateNumber && <p>Số hiệu: <strong>{ocr.certificateNumber}</strong></p>}
                {ocr.citizenIdExtracted && <p>CCCD: <strong>{ocr.citizenIdExtracted}</strong> · {ocr.citizenIdMatched ? 'khớp' : 'không khớp'}</p>}
              </div>
              {ocr.rawText && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-blue-700">Xem nội dung OCR</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{ocr.rawText}</pre>
                </details>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-rose-700">{ocr.errorDetails || 'OCR không khả dụng.'}</p>
          )}
        </section>
      )}

      {result.forensicCheck && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Dấu vân tay & chỉnh sửa ảnh</h3>
          <p className="mt-1 text-sm text-slate-700">
            ELA {result.forensicCheck.elaAnomalyScore} · {result.forensicCheck.isTampered ? 'Có tín hiệu bất thường' : 'Không thấy tín hiệu chỉnh sửa'}
          </p>
          <p className="mt-1 break-all text-xs text-slate-600">SHA-256: {result.forensicCheck.sha256}</p>
          <p className="break-all text-xs text-slate-600">pHash: {result.forensicCheck.pHash}</p>
          {!!result.forensicCheck.warnings?.length && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
              {result.forensicCheck.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          )}
        </section>
      )}

      {!!result.documentChecks?.length && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Checklist phân tích</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {result.documentChecks.map((check) => (
              <li key={check.key} className="leading-5">
                <strong className="text-slate-800">{check.label}:</strong>{' '}
                <span className={checkStatusClass[check.status] || 'text-slate-600'}>{checkStatusLabels[check.status] || check.status}</span>.{' '}
                <span className="text-slate-600">{check.details}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.documentMarks && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Chữ ký & con dấu</h3>
          <p className="mt-1 text-xs text-slate-700">Chữ ký: {result.documentMarks.signatureEvidence} ({result.documentMarks.signatureStatus})</p>
          <p className="text-xs text-slate-700">Con dấu: {result.documentMarks.sealEvidence} ({result.documentMarks.sealStatus})</p>
        </section>
      )}

      {result.templateMatch && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Đối chiếu phôi mẫu</h3>
          <p className="mt-1 text-sm text-slate-700">
            {result.templateMatch.status} · tương đồng {result.templateMatch.confidence}%
          </p>
          {result.templateMatch.evidence && <p className="mt-1 text-xs text-slate-600">{result.templateMatch.evidence}</p>}
        </section>
      )}

      {result.qrVerification && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Mã QR & tra cứu website</h3>
          {result.qrVerification.detected ? (
            <>
              <p className="mt-1 text-xs text-slate-700">
                Nội dung QR: <span className="break-all font-mono">{result.qrVerification.rawText}</span>
              </p>
              {result.qrVerification.verificationUrl && (
                <p className="mt-1 text-sm text-slate-700">
                  Đường dẫn:{' '}
                  <a className="text-blue-700 underline" href={result.qrVerification.verificationUrl} target="_blank" rel="noreferrer">
                    {result.qrVerification.verificationUrl}
                  </a>
                </p>
              )}
              {result.qrVerification.fetched && (
                <p className="mt-1 text-xs text-slate-700">
                  Trang: {result.qrVerification.pageTitle || '—'} ·{' '}
                  {result.qrVerification.matchesDeclared ? 'khớp thông tin khai báo' : 'chưa khớp thông tin khai báo'}
                  {result.qrVerification.matchScore != null ? ` · tương đồng ${formatPercent(result.qrVerification.matchScore)}` : ''}
                  {` · cộng ${result.qrVerification.confidenceBoost} điểm`}
                </p>
              )}
              {result.qrVerification.errorDetails && <p className="mt-1 text-xs text-amber-700">{result.qrVerification.errorDetails}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-600">{result.qrVerification.errorDetails || 'Không tìm thấy mã QR trên tệp minh chứng.'}</p>
          )}
        </section>
      )}

      {(result.faceVerification || result.sceneVision || result.exifData) && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Phân tích ảnh sự kiện</h3>
          {result.faceVerification && (
            <p className="mt-1 text-xs text-slate-700">
              {result.faceVerification.status === 'NOT_CHECKED'
                ? result.faceVerification.statusMessage || 'Chưa kiểm tra khuôn mặt.'
                : `Khuôn mặt phát hiện: ${result.faceVerification.facesDetected} · ${result.faceVerification.matched ? 'có khớp' : 'chưa khớp'} · cộng ${result.faceVerification.confidenceBoost} điểm${result.faceVerification.statusMessage ? ` · ${result.faceVerification.statusMessage}` : ''}`}
            </p>
          )}
          {result.sceneVision && (
            <p className="mt-1 text-xs text-slate-700">
              Bối cảnh: {result.sceneVision.sceneContext || '—'}
              {result.sceneVision.detectedBannerText ? ` · Banner: ${result.sceneVision.detectedBannerText}` : ''}
              {result.sceneVision.matchesActivity != null ? ` · ${result.sceneVision.matchesActivity ? 'khớp hoạt động' : 'chưa khớp hoạt động'}` : ''}
            </p>
          )}
          {result.exifData && (
            <p className="mt-1 text-xs text-slate-700">
              EXIF: {result.exifData.cameraModel || '—'} · chụp {result.exifData.captureDate || '—'}
              {result.exifData.matchesDeclaredDate != null ? ` · ${result.exifData.matchesDeclaredDate ? 'khớp ngày khai báo' : 'lệch ngày khai báo'}` : ''}
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-800">Tra cứu nguồn công khai (Luồng 2)</h3>
        {web.searched ? (
          <>
            {web.queryUsed && <p className="mt-1 text-xs text-slate-600">Truy vấn: {web.queryUsed}</p>}
            {web.articleUrl ? (
              <p className="mt-2 text-sm text-slate-700">
                Tìm thấy:{' '}
                <a className="text-blue-700 underline" href={web.articleUrl} target="_blank" rel="noreferrer">
                  {web.articleTitle || web.articleUrl}
                </a>
                {web.matchScore != null ? ` · tương đồng ${formatPercent(web.matchScore)}` : ''}
                {` · cộng ${web.confidenceBoost} điểm`}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Đã tra cứu nhưng không tìm thấy bài đối chứng phù hợp. Cộng 0 điểm.</p>
            )}
            {web.errorDetails && <p className="mt-1 text-xs text-amber-700">{web.errorDetails}</p>}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Chưa bật tra cứu nguồn công khai cho lần chạy này.</p>
        )}
      </section>

      {!!breakdownEntries.length && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Chi tiết cộng/trừ điểm</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {breakdownEntries.map(([key, value]) => (
              <li key={key} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
                <span className="font-mono text-slate-600">{key}</span>
                <span className="font-semibold text-slate-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
