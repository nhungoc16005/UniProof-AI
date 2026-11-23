// Creates synthetic M2 manual-smoke accounts/data only in an explicitly named local *_test database.
const bcrypt = require('bcryptjs');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL to a local disposable *_test database.');
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
  throw new Error('Refusing to seed: only localhost/127.0.0.1 databases ending in _test are accepted.');
}
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const password = 'M2-local-only-2026!';

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const faculty = await prisma.faculty.upsert({
    where: { code: 'M2SMOKE' },
    update: { name: 'Khoa Synthetic M2' },
    create: { code: 'M2SMOKE', name: 'Khoa Synthetic M2' },
  });
  const classroom = await prisma.class.upsert({
    where: { code: 'M2SMOKE-K26' },
    update: { name: 'Lớp kiểm thử M2', facultyId: faculty.id },
    create: { code: 'M2SMOKE-K26', name: 'Lớp kiểm thử M2', cohort: 'K26', facultyId: faculty.id },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'm2.admin@localhost.test' },
    update: { fullName: 'Quản trị viên kiểm thử M2', password: passwordHash, role: 'ADMIN', isActive: true, isFirstLogin: false },
    create: { email: 'm2.admin@localhost.test', fullName: 'Quản trị viên kiểm thử M2', password: passwordHash, role: 'ADMIN', isActive: true, isFirstLogin: false },
  });
  const officer = await prisma.user.upsert({
    where: { email: 'm2.officer@localhost.test' },
    update: { fullName: 'Cán bộ kiểm thử M2', password: passwordHash, role: 'STAFF', facultyId: faculty.id, isActive: true, isFirstLogin: false },
    create: { email: 'm2.officer@localhost.test', fullName: 'Cán bộ kiểm thử M2', password: passwordHash, role: 'STAFF', facultyId: faculty.id, isActive: true, isFirstLogin: false },
  });
  const student = await prisma.user.upsert({
    where: { email: 'm2.student@localhost.test' },
    update: { fullName: 'Sinh viên Tổng hợp', password: passwordHash, role: 'STUDENT', studentCode: 'SV00000001', classId: classroom.id, isActive: true, isFirstLogin: false },
    create: { email: 'm2.student@localhost.test', fullName: 'Sinh viên Tổng hợp', password: passwordHash, role: 'STUDENT', studentCode: 'SV00000001', classId: classroom.id, isActive: true, isFirstLogin: false },
  });

  const now = new Date();
  const term = await prisma.term.upsert({
    where: { code: 'M2_MANUAL_SMOKE' },
    update: { name: 'Kỳ kiểm thử M2', startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 30 * 86400000), submissionDeadline: new Date(now.getTime() + 7 * 86400000), reviewDeadline: new Date(now.getTime() + 14 * 86400000), appealDeadline: new Date(now.getTime() + 21 * 86400000), status: 'ACTIVE', workflowEnabled: true },
    create: { code: 'M2_MANUAL_SMOKE', name: 'Kỳ kiểm thử M2', startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 30 * 86400000), submissionDeadline: new Date(now.getTime() + 7 * 86400000), reviewDeadline: new Date(now.getTime() + 14 * 86400000), appealDeadline: new Date(now.getTime() + 21 * 86400000), status: 'ACTIVE', workflowEnabled: true },
  });
  const rubric = await prisma.rubricVersion.upsert({
    where: { termId_version: { termId: term.id, version: 1 } },
    update: { status: 'PUBLISHED', publishedAt: now },
    create: { termId: term.id, version: 1, status: 'PUBLISHED', publishedAt: now, categories: { create: { code: 'M2', name: 'Minh chứng kiểm thử', maxScore: 100, position: 1 } } },
    include: { categories: true },
  });
  const category = rubric.categories[0] || await prisma.rubricCategory.create({ data: { rubricVersionId: rubric.id, code: 'M2', name: 'Minh chứng kiểm thử', maxScore: 100, position: 1 } });
  const criterion = await prisma.criterion.upsert({
    where: { rubricVersionId_code: { rubricVersionId: rubric.id, code: 'M2.1' } },
    update: { name: 'Hoạt động ngoại khóa tổng hợp', description: 'Tiêu chí synthetic để kiểm thử M2.', maxScore: 100, categoryId: category.id, scoringConfig: { kind: 'manual_verified', requiredData: ['officialScore'] } },
    create: { rubricVersionId: rubric.id, categoryId: category.id, code: 'M2.1', name: 'Hoạt động ngoại khóa tổng hợp', description: 'Tiêu chí synthetic để kiểm thử M2.', maxScore: 100, category: 'M2', scoringConfig: { kind: 'manual_verified', requiredData: ['officialScore'] } },
  });
  await prisma.assessmentHandoff.upsert({
    where: { studentId_termId: { studentId: student.id, termId: term.id } },
    update: { rubricVersionId: rubric.id, classId: classroom.id, facultyId: faculty.id, status: 'WORKING' },
    create: { studentId: student.id, termId: term.id, rubricVersionId: rubric.id, classId: classroom.id, facultyId: faculty.id },
  });

  console.log(JSON.stringify({
    testOnly: true,
    termCode: term.code,
    criterionCode: criterion.code,
    accounts: [admin.email, officer.email, student.email],
    localOnlyPassword: password,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
