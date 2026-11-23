import { BadRequestException } from '@nestjs/common';
import { Term, TermStatus } from '@prisma/client';

export function assertF15Open(term: Pick<Term, 'status' | 'evidenceBasisWorkflowEnabled'>) {
  if (term.status !== TermStatus.ACTIVE && term.status !== TermStatus.REVIEWING) {
    throw new BadRequestException('Kỳ đánh giá phải đang mở hoặc đang thẩm định để sử dụng quy trình căn cứ.');
  }
  if (!term.evidenceBasisWorkflowEnabled) {
    throw new BadRequestException('Kỳ đánh giá đang sử dụng quy trình truyền thống.');
  }
}
