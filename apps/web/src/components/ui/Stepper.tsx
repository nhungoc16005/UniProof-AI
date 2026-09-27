import React from 'react';
import { Check, RotateCw, Clock, AlertCircle } from 'lucide-react';
import { EvidenceStatus } from '../../types';

interface StepperProps {
  currentStatus: EvidenceStatus;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ currentStatus, className = '' }) => {
  const steps = [
    { id: 1, title: 'Tiếp nhận' },
    { id: 2, title: 'Quét OCR' },
    { id: 3, title: 'Trích xuất AI' },
    { id: 4, title: 'Đối chiếu nguồn' },
    { id: 5, title: 'Đề xuất Rule' },
    { id: 6, title: 'Cán bộ duyệt' },
    { id: 7, title: 'Hoàn tất' },
  ];

  // Map status to active step index
  let activeStep = 1;
  let isFailed = false;

  switch (currentStatus) {
    case 'DRAFT':
      activeStep = 1;
      break;
    case 'PROCESSING':
      activeStep = 3;
      break;
    case 'VERIFIED':
    case 'PLAUSIBLE':
    case 'NEEDS_HUMAN_REVIEW':
      activeStep = 6;
      break;
    case 'NEEDS_SUPPLEMENT':
      activeStep = 6;
      break;
    case 'INVALID':
      activeStep = 6;
      isFailed = true;
      break;
    case 'APPROVED':
    case 'REJECTED':
      activeStep = 7;
      break;
    case 'APPEALING':
      activeStep = 6;
      break;
    case 'WITHDRAWN':
      activeStep = 1;
      break;
    default:
      activeStep = 1;
  }

  return (
    <div className={`w-full py-4 ${className}`}>
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 w-full z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-sky-600 transition-all duration-500 z-0"
          style={{ width: `${((activeStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isPassed = step.id < activeStep;
          const isCurrent = step.id === activeStep;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all ${
                  isPassed
                    ? 'bg-sky-600 text-white shadow-sm'
                    : isCurrent
                    ? currentStatus === 'PROCESSING'
                      ? 'bg-sky-500 text-white ring-4 ring-sky-100 animate-pulse'
                      : isFailed
                      ? 'bg-rose-600 text-white ring-4 ring-rose-100'
                      : 'bg-sky-600 text-white ring-4 ring-sky-100'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isPassed ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : isCurrent ? (
                  currentStatus === 'PROCESSING' ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : isFailed ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    step.id
                  )
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
              <span
                className={`mt-1.5 text-[11px] font-medium whitespace-nowrap hidden sm:block ${
                  isCurrent ? 'text-sky-700 font-semibold' : isPassed ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
