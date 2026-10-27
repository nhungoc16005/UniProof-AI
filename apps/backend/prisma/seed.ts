import { Prisma, PrismaClient, RubricVersionStatus } from '@prisma/client';
import { assertDutRubricTotals, DUT_RUBRIC_CATEGORIES, DUT_RUBRIC_CRITERIA } from '../src/criteria/dut-rubric';

const prisma = new PrismaClient();

async function main() {
  assertDutRubricTotals();
  const total = DUT_RUBRIC_CATEGORIES.reduce((sum, category) => sum + category.maxScore, 0);
  if (total !== 100 || DUT_RUBRIC_CRITERIA.length !== 16) {
    throw new Error(`Bộ tiêu chí chuẩn không hợp lệ: ${DUT_RUBRIC_CRITERIA.length} mục, tổng ${total} điểm.`);
  }

  const definition = {
    categories: DUT_RUBRIC_CATEGORIES.map((category) => ({
      code: category.code,
      name: category.name,
      maxScore: category.maxScore,
      position: category.position,
      criteria: DUT_RUBRIC_CRITERIA.filter((criterion) => criterion.category === category.code).map((criterion) => ({
        code: criterion.code,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        scoringConfig: criterion.scoringConfig,
      })),
    })),
  };

  const result = await prisma.$transaction(async (tx) => {
    const template = await tx.rubricTemplate.upsert({
      where: { code: 'DUT_DEFAULT' },
      update: {},
      create: { code: 'DUT_DEFAULT', name: 'Bộ tiêu chí ĐHBK Đà Nẵng' },
    });

    const published = await tx.rubricTemplateVersion.findFirst({
      where: { templateId: template.id, status: RubricVersionStatus.PUBLISHED },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    if (published) return { created: false, version: published.version };

    const existingVersion = await tx.rubricTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { version: 'desc' },
      select: { version: true, status: true },
    });
    if (existingVersion) {
      throw new Error(`Bộ chuẩn có phiên bản ${existingVersion.version} ở trạng thái ${existingVersion.status}, chưa có bản ban hành; seed dừng để tránh ghi đè.`);
    }

    const created = await tx.rubricTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        status: RubricVersionStatus.PUBLISHED,
        definition: definition as Prisma.InputJsonValue,
        sourceDescription: 'Cấu hình tiêu chí theo tài liệu trường cung cấp',
        publishedAt: new Date(),
      },
      select: { version: true },
    });
    return { created: true, version: created.version };
  });

  console.log(result.created
    ? `Đã tạo bộ chuẩn DUT_DEFAULT v${result.version}: 5 khung, 16 tiêu chí, 100 điểm.`
    : `Bộ chuẩn DUT_DEFAULT v${result.version} đã tồn tại; không thay đổi dữ liệu.`);
  console.log('Seed chỉ quản lý rubric chuẩn; không tạo tài khoản, kỳ, hoạt động, minh chứng hoặc điểm mẫu.');
}

main()
  .catch((error) => {
    console.error('Seed rubric thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
