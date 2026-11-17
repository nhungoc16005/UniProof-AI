// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { AiPipelineAdviceResult, AiResultPanel } from './AiResultPanel';

afterEach(cleanup);

const result: AiPipelineAdviceResult = {
  kind: 'pipeline',
  score: 96,
  checkerResults: [
    { checker: 'quality', status: 'PASS', message_vi: 'Chất lượng ảnh đạt yêu cầu.' },
    { checker: 'identity', status: 'NOT_CHECKED', message_vi: 'Chưa đọc được MSSV từ giấy chứng nhận.' },
    { checker: 'term', status: 'REVIEW', message_vi: 'Ngày cấp cần cán bộ kiểm tra với học kỳ.' },
  ],
  scoreBreakdown: [
    { component: 'quality', source: 'quality_checker', status: 'PASS', score: 28, weight: 20 },
    { component: 'identity', source: 'ocr_checker', status: 'NOT_CHECKED', score: 0, weight: 15 },
  ],
  decisionReason: 'Cần cán bộ xem lại các trường chưa xác minh.',
};

describe('AiResultPanel', () => {
  it('shows NOT_CHECKED as “Chưa kiểm tra”, distinct from PASS', () => {
    render(<AiResultPanel result={result} />);

    const notChecked = screen.getByText('Chưa kiểm tra');
    const passed = screen.getByText('Đạt');
    expect(notChecked).toBeTruthy();
    expect(notChecked.className).not.toBe(passed.className);
    expect(screen.getByText('Chưa đọc được MSSV từ giấy chứng nhận.')).toBeTruthy();
  });

  it('shows Vietnamese checker messages, score breakdown, and an advisory without approval controls', () => {
    render(<AiResultPanel result={result} />);

    const panel = within(screen.getByRole('region', { name: 'Gợi ý của hệ thống' }));
    expect(panel.getByText('Gợi ý của hệ thống · Cán bộ quyết định')).toBeTruthy();
    expect(panel.getByText('Chất lượng ảnh đạt yêu cầu.')).toBeTruthy();
    expect(panel.getByText('Ngày cấp cần cán bộ kiểm tra với học kỳ.')).toBeTruthy();
    expect(panel.getByText('Cần xem lại')).toBeTruthy();
    expect(panel.getByText('quality · Đạt · nguồn: quality_checker')).toBeTruthy();
    expect(panel.getByText(/Điểm gợi ý: 89 \/ 100 · không phải xác suất/)).toBeTruthy();
    expect(panel.queryByRole('button', { name: /duyệt/i })).toBeNull();
  });

  it('caps the displayed score at 89 and removes the green tier while REVIEW or NOT_CHECKED remains', () => {
    render(<AiResultPanel result={result} />);

    const panel = within(screen.getByRole('region', { name: 'Gợi ý của hệ thống' }));
    expect(panel.getByText(/Điểm gợi ý: 89 \/ 100/)).toBeTruthy();
    expect(panel.queryByText(/XANH/)).toBeNull();
  });

  it.each(['OFF', 'SHADOW'] as const)('does not render the panel when AI_MODE is %s', (mode) => {
    render(<AiResultPanel result={result} mode={mode} />);

    expect(screen.queryByRole('region', { name: 'Gợi ý của hệ thống' })).toBeNull();
    expect(screen.queryByText('Gợi ý của hệ thống · Cán bộ quyết định')).toBeNull();
  });
});
