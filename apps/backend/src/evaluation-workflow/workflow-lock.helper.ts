import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Khóa hàng Term độc quyền (SELECT FOR UPDATE) dùng chung cho các transaction
 * quản lý workflow, chốt kỳ và gia hạn thời hạn để tránh race condition và circular dependency.
 */
export async function lockTerm(tx: Prisma.TransactionClient, termId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Term" WHERE "id" = ${termId} FOR UPDATE`;
  const term = await tx.term.findUnique({ where: { id: termId } });
  if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
  return term;
}
