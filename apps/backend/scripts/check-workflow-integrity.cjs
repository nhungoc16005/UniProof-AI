// Read-only preflight. Prints only counts, never identities, evidence or credentials.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const checks = [
    ['unknown handoff statuses', `SELECT COUNT(*)::text AS count FROM "AssessmentHandoff" WHERE "status"::text NOT IN ('WORKING','SENT','RETURNED','EXCLUDED')`],
    ['orphan handoffs', `SELECT COUNT(*)::text AS count FROM "AssessmentHandoff" h LEFT JOIN "User" u ON u.id=h."studentId" LEFT JOIN "Term" t ON t.id=h."termId" LEFT JOIN "RubricVersion" r ON r.id=h."rubricVersionId" LEFT JOIN "Class" c ON c.id=h."classId" LEFT JOIN "Faculty" f ON f.id=h."facultyId" LEFT JOIN "User" s ON s.id=h."sentById" WHERE u.id IS NULL OR t.id IS NULL OR r.id IS NULL OR c.id IS NULL OR f.id IS NULL OR (h."sentById" IS NOT NULL AND s.id IS NULL)`],
    ['orphan publications', `SELECT COUNT(*)::text AS count FROM "AssessmentPublication" p LEFT JOIN "User" u ON u.id=p."studentId" LEFT JOIN "Term" t ON t.id=p."termId" LEFT JOIN "RubricVersion" r ON r.id=p."rubricVersionId" LEFT JOIN "User" a ON a.id=p."publishedById" WHERE u.id IS NULL OR t.id IS NULL OR r.id IS NULL OR a.id IS NULL`],
    ['orphan appeals', `SELECT COUNT(*)::text AS count FROM "Appeal" a LEFT JOIN "Term" t ON t.id=a."termId" LEFT JOIN "CriterionAssessment" c ON c.id=a."criterionAssessmentId" WHERE (a."termId" IS NOT NULL AND t.id IS NULL) OR (a."criterionAssessmentId" IS NOT NULL AND c.id IS NULL)`],
    ['cross-term handoff rubrics', `SELECT COUNT(*)::text AS count FROM "AssessmentHandoff" h JOIN "RubricVersion" r ON r.id=h."rubricVersionId" WHERE h."termId" <> r."termId"`],
  ];
  let failed = false;
  for (const [label, sql] of checks) {
    const [row] = await prisma.$queryRawUnsafe(sql);
    console.log(`${label}: ${row.count}`);
    failed ||= row.count !== '0';
  }
  if (failed) { console.error('Preflight failed: repair source records before migration.'); process.exitCode = 1; }
  else console.log('PASS: workflow integrity preflight (read-only)');
})().catch(() => { console.error('Preflight could not read database. Check connection and existing workflow schema.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
