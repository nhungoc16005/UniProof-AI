import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GroundingStatus, ImportBatchStatus, ImportBatchType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowActor, WorkflowService } from '../evaluation-workflow/workflow.service';
import { lockTerm } from '../evaluation-workflow/workflow-lock.helper';
import { normalizeActivityRole, recomputeAndSaveActivityCriterion } from '../activities/activity-aggregator';
import { validateVerifiedData } from '../assessments/assessments.service';
import { ActivitiesService } from '../activities/activities.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { ConfirmGroundingImportDto, PreviewGroundingImportDto } from './dto/grounding-import.dto';
import { assertF15Open } from './f15-policy';

@Injectable()
export class GroundingImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly activitiesService: ActivitiesService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  private assertStaffFacultyScope(actor: WorkflowActor) {
    if (actor.role === Role.ADMIN) return;
    if (actor.role !== Role.STAFF || !actor.facultyId) {
      throw new ForbiddenException('Chưa được phân công Khoa');
    }
  }

  private async clubImportLocks(db: Prisma.TransactionClient, termId: string, studentIds: string[]) {
    const scoped = { termId, studentId: { in: studentIds } };
    const [publications, finalized] = await Promise.all([
      db.assessmentPublication.findMany({ where: scoped, select: { studentId: true } }),
      db.criterionAssessment.findMany({
        where: { ...scoped, status: 'FINALIZED', criterion: { code: { in: ['4', '13'] }, rubricVersion: { termId, status: 'PUBLISHED' } } },
        select: { studentId: true, criterion: { select: { code: true } } },
      }),
    ]);
    const publishedStudents = new Set(publications.map(publication => publication.studentId));
    const finalizedCriteria = new Set(finalized.map(row => `${row.studentId}:${row.criterion.code}`));
    return (studentId: string, criterionCode: string) =>
      publishedStudents.has(studentId) || finalizedCriteria.has(`${studentId}:${criterionCode}`);
  }
  /**
   * Bước 1 & 2: Preview kiểm tra dữ liệu trước khi import.
   * TUYỆT ĐỐI KHÔNG GHI VÀO DATABASE.
   */
  async preview(actor: WorkflowActor, dto: PreviewGroundingImportDto) {
    this.assertStaffFacultyScope(actor);

    const source = dto.source?.trim() || 'File tải lên';

    const term = await this.prisma.term.findUnique({
      where: { id: dto.termId },
    });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    assertF15Open(term);

    const rubric = await this.prisma.rubricVersion.findFirst({
      where: { termId: dto.termId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      include: { criteria: true },
    });
    if (!rubric) throw new BadRequestException('Kỳ này chưa có bộ tiêu chí nào được ban hành');

    const criteriaByCode = new Map(rubric.criteria.map((c) => [c.code, c]));

    // Lấy danh sách MSSV trong file để truy vấn một lần
    const rawStudentCodes = dto.rows
      .map((r) => String(r.studentCode || '').trim())
      .filter(Boolean);

    const students = await this.prisma.user.findMany({
      where: { studentCode: { in: rawStudentCodes }, role: Role.STUDENT },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        class: { select: { id: true, code: true, facultyId: true } },
      },
    });
    const studentByCode = new Map(students.map((s) => [s.studentCode, s]));

    // Lấy roster của Khoa trong kỳ (ưu tiên snapshot handoff của kỳ đó)
    const handoffs = await this.prisma.assessmentHandoff.findMany({
      where: {
        termId: dto.termId,
        studentId: { in: students.map((s) => s.id) },
      },
      select: { studentId: true, facultyId: true, status: true },
    });
    const handoffMap = new Map(handoffs.map((h) => [h.studentId, h]));
    const clubImportLocked = dto.type === ImportBatchType.CLUB_LEADERSHIP
      ? await this.clubImportLocks(this.prisma, dto.termId, students.map(student => student.id)) : undefined;

    // Nếu là ACTIVITY: kiểm tra Activity có tồn tại và hợp lệ không
    let activityRecord: any = null;
    if (dto.type === ImportBatchType.ACTIVITY) {
      if (!dto.activityId) throw new BadRequestException('Import hoạt động bắt buộc phải chọn Hoạt động (activityId)');
      activityRecord = await this.prisma.activity.findUnique({
        where: { id: dto.activityId },
        include: { participants: { where: { status: { not: 'REVOKED' } }, select: { studentId: true } } },
      });
      if (!activityRecord) throw new NotFoundException(`Không tìm thấy hoạt động với ID: ${dto.activityId}`);
      if (activityRecord.termId && activityRecord.termId !== dto.termId) {
        throw new BadRequestException('Hoạt động không thuộc kỳ đánh giá này');
      }
      if (actor.role === Role.STAFF && activityRecord.facultyId && activityRecord.facultyId !== actor.facultyId) {
        throw new ForbiddenException('Hoạt động nằm ngoài Khoa phụ trách');
      }
    }

    const previewItems: Array<{
      rowIndex: number;
      studentCode: string;
      fullName?: string;
      criterionCode?: string;
      status: 'VALID' | 'ERROR' | 'SKIPPED';
      reason?: string;
      data?: Record<string, unknown>;
    }> = [];

    const seenKeys = new Set<string>();
    let validCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];
      const rowIndex = i + 1;
      const rawCode = String(row.studentCode || '').trim();

      if (!rawCode) {
        previewItems.push({
          rowIndex,
          studentCode: '',
          status: 'ERROR',
          reason: 'Mã số sinh viên (studentCode) không được để trống',
        });
        errorCount++;
        continue;
      }

      const student = studentByCode.get(rawCode);
      if (!student) {
        previewItems.push({
          rowIndex,
          studentCode: rawCode,
          status: 'ERROR',
          reason: `Không tìm thấy sinh viên có MSSV: ${rawCode}`,
        });
        errorCount++;
        continue;
      }

      if (term.workflowEnabled && !handoffMap.has(student.id)) {
        previewItems.push({ rowIndex, studentCode: rawCode, fullName: student.fullName, status: 'ERROR', reason: 'Sinh viên không thuộc danh sách đánh giá của kỳ' });
        errorCount++;
        continue;
      }

      // Kiểm tra phạm vi Khoa: ưu tiên snapshot handoff của kỳ đó, nếu chưa có thì theo class.facultyId
      if (actor.role === Role.STAFF) {
        const handoff = handoffMap.get(student.id);
        const studentFacultyId = handoff ? handoff.facultyId : student.class?.facultyId;
        if (studentFacultyId !== actor.facultyId) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            status: 'ERROR',
            reason: 'Sinh viên không thuộc Khoa quản lý của cán bộ trong kỳ này',
          });
          errorCount++;
          continue;
        }
      }

      // Kiểm tra theo từng loại dữ liệu
      if (dto.type === ImportBatchType.ACADEMIC) {
        const criterionCode = String(row.criterionCode || '').trim();
        if (!['1', '3', '7'].includes(criterionCode)) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Tiêu chí '${criterionCode}' không thuộc danh mục học vụ hợp lệ (chỉ chấp nhận: 1, 3, 7)`,
          });
          errorCount++;
          continue;
        }

        const criterion = criteriaByCode.get(criterionCode);
        if (!criterion) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Không tìm thấy tiêu chí ${criterionCode} trong bộ tiêu chí kỳ này`,
          });
          errorCount++;
          continue;
        }

        // Kiểm tra trùng lặp trong cùng file
        const dupKey = `${rawCode}:${criterionCode}`;
        if (seenKeys.has(dupKey)) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Trùng lặp MSSV ${rawCode} cho tiêu chí ${criterionCode} trong cùng file`,
          });
          errorCount++;
          continue;
        }
        seenKeys.add(dupKey);

        const [existingGrounding, existingAssessment] = await Promise.all([
          this.prisma.academicGrounding.findFirst({ where: { termId: dto.termId, studentId: student.id, criterionCode, status: GroundingStatus.ACTIVE }, select: { id: true } }),
          this.prisma.criterionAssessment.findUnique({ where: { studentId_termId_criterionId: { studentId: student.id, termId: dto.termId, criterionId: criterion.id } }, select: { verifiedData: true } }),
        ]);
        if (existingGrounding || existingAssessment?.verifiedData) {
          previewItems.push({ rowIndex, studentCode: rawCode, fullName: student.fullName, criterionCode, status: 'SKIPPED', reason: 'Đã có căn cứ hoặc dữ liệu xác minh; xử lý riêng trước khi nhập lại' });
          skippedCount++;
          continue;
        }

        const rowData = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
        try {
          validateVerifiedData(criterion.scoringConfig as Record<string, unknown> | null, rowData, criterion.maxScore);
        } catch (err: any) {
          const detailMsg = err?.response?.details?.fields?.map((f: any) => `${f.field}: ${f.message}`).join(', ') || err.message;
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Dữ liệu không hợp lệ: ${detailMsg || 'Sai định dạng công thức'}`,
          });
          errorCount++;
          continue;
        }

        previewItems.push({
          rowIndex,
          studentCode: rawCode,
          fullName: student.fullName,
          criterionCode,
          status: 'VALID',
          data: rowData,
        });
        validCount++;
      } else if (dto.type === ImportBatchType.ACTIVITY) {
        const dupKey = rawCode;
        if (seenKeys.has(dupKey)) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            status: 'ERROR',
            reason: `Trùng lặp MSSV ${rawCode} trong danh sách điểm danh cùng file`,
          });
          errorCount++;
          continue;
        }
        seenKeys.add(dupKey);

        const existingParticipant = activityRecord.participants?.some((p: any) => p.studentId === student.id);
        if (existingParticipant) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            status: 'SKIPPED',
            reason: 'Sinh viên đã có tên trong danh sách điểm danh của hoạt động này',
          });
          skippedCount++;
          continue;
        }

        const rawRole = row.role ? String(row.role) : undefined;
        const normalizedRole = rawRole ? normalizeActivityRole(rawRole) : 'THAM_GIA_CHINH';
        if (!['PARTICIPANT', 'ORGANIZER', 'CHEERLEADER', 'THAM_GIA_CHINH'].includes(normalizedRole)) {
          previewItems.push({ rowIndex, studentCode: rawCode, fullName: student.fullName, status: 'ERROR', reason: `Vai trò '${rawRole}' không hợp lệ` });
          errorCount++;
          continue;
        }

        previewItems.push({
          rowIndex,
          studentCode: rawCode,
          fullName: student.fullName,
          status: 'VALID',
          data: { role: normalizedRole, rawRole: row.role },
        });
        validCount++;
      } else if (dto.type === ImportBatchType.CLUB_LEADERSHIP) {
        const criterionCode = String(row.criterionCode || '').trim();
        if (!['4', '13'].includes(criterionCode) || !criteriaByCode.has(criterionCode)) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Tiêu chí '${criterionCode}' không có trong nhóm CLB/BTC của rubric kỳ này (4, 13)`,
          });
          errorCount++;
          continue;
        }

        if (['SENT', 'EXCLUDED'].includes(handoffMap.get(student.id)?.status ?? '') || clubImportLocked?.(student.id, criterionCode)) {
          previewItems.push({ rowIndex, studentCode: rawCode, fullName: student.fullName, criterionCode, status: 'ERROR', reason: 'Phiếu đã khóa, tiêu chí đã chốt hoặc đã có kết quả công bố' });
          errorCount++;
          continue;
        }
        const orgName = String(row.organizationName || '').trim();
        const roleTitle = String(row.roleTitle || '').trim();
        if (!orgName || !roleTitle) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: 'Tên tổ chức (organizationName) và chức vụ/vai trò (roleTitle) không được để trống',
          });
          errorCount++;
          continue;
        }

        const dupKey = `${rawCode}:${criterionCode}:${orgName}`;
        if (seenKeys.has(dupKey)) {
          previewItems.push({
            rowIndex,
            studentCode: rawCode,
            fullName: student.fullName,
            criterionCode,
            status: 'ERROR',
            reason: `Trùng lặp MSSV ${rawCode} cho tiêu chí ${criterionCode} tại đơn vị ${orgName}`,
          });
          errorCount++;
          continue;
        }
        seenKeys.add(dupKey);

        previewItems.push({
          rowIndex,
          studentCode: rawCode,
          fullName: student.fullName,
          criterionCode,
          status: 'VALID',
          data: { organizationName: orgName, roleTitle },
        });
        validCount++;
      }
    }

    return {
      termId: dto.termId,
      type: dto.type,
      source: dto.source,
      totalRows: dto.rows.length,
      validCount,
      errorCount,
      skippedCount,
      canCommit: validCount > 0,
      previewItems,
    };
  }

  /**
   * Bước 3 & 4: Xác nhận nhập dữ liệu (Confirm Import)
   * Chạy trong transaction, kiểm tra lại điều kiện và hỗ trợ idempotency.
   */
  async confirm(actor: WorkflowActor, dto: ConfirmGroundingImportDto) {
    if (!dto.previewTermId || dto.previewTermId !== dto.termId) {
      throw new BadRequestException({
        code: 'GROUNDING_PREVIEW_TERM_MISMATCH',
        message: 'Kỳ xác nhận khác kỳ đã xem trước. Hãy xem trước lại tệp cho kỳ này.',
      });
    }
    this.assertStaffFacultyScope(actor);

    const source = dto.source?.trim() || 'File tải lên';
    const inputRows = (dto.validRows && dto.validRows.length > 0 ? dto.validRows : dto.rows) || [];
    if (!inputRows.length) {
      throw new BadRequestException('Danh sách dòng cần nhập không được trống');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const term = await lockTerm(tx, dto.termId);
        assertF15Open(term);

        // Kiểm tra IdempotencyKey
        if (dto.idempotencyKey) {
          const existing = await tx.importBatch.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing && existing.termId !== dto.termId) {
            throw new ConflictException('Khóa xác nhận đã được sử dụng cho kỳ khác. Hãy xem trước lại tệp.');
          }
          if (existing && existing.status === ImportBatchStatus.ACTIVE) {
            return {
              idempotencyReplay: true,
              batchId: existing.id,
              status: existing.status,
              totalRows: existing.totalRows,
              validRows: existing.validRows,
              message: 'Lô import đã được thực hiện trước đó (Idempotent)',
            };
          }
        }

        const rubric = await tx.rubricVersion.findFirst({
          where: { termId: dto.termId, status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          include: { criteria: true },
        });
        if (!rubric) throw new BadRequestException('Kỳ này chưa có bộ tiêu chí nào được ban hành');
        const criteriaByCode = new Map(rubric.criteria.map((c) => [c.code, c]));

        const rawStudentCodes = [...new Set(inputRows.map((r) => String(r.studentCode || '').trim()).filter(Boolean))];
        const students = await tx.user.findMany({
          where: { studentCode: { in: rawStudentCodes }, role: Role.STUDENT },
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            class: { select: { id: true, code: true, facultyId: true } },
          },
        });
        const studentByCode = new Map(students.map((s) => [s.studentCode, s]));

        const handoffs = await tx.assessmentHandoff.findMany({
          where: {
            termId: dto.termId,
            studentId: { in: students.map((s) => s.id) },
          },
          select: { studentId: true, facultyId: true, status: true },
        });
        const handoffMap = new Map(handoffs.map((h) => [h.studentId, h]));
        const clubImportLocked = dto.type === ImportBatchType.CLUB_LEADERSHIP
          ? await this.clubImportLocks(tx, dto.termId, students.map(student => student.id)) : undefined;

        let existingParticipantIds = new Set<string>();
        if (dto.type === ImportBatchType.ACTIVITY) {
          if (!dto.activityId) throw new BadRequestException('Import hoạt động bắt buộc chọn activityId');
          const activityRecord = await tx.activity.findUnique({
            where: { id: dto.activityId },
            include: { participants: { where: { status: { not: 'REVOKED' } }, select: { studentId: true } } },
          });
          if (!activityRecord) throw new NotFoundException(`Không tìm thấy hoạt động với ID: ${dto.activityId}`);
          if (activityRecord.termId && activityRecord.termId !== dto.termId) {
            throw new BadRequestException('Hoạt động không thuộc kỳ đánh giá này');
          }
          if (actor.role === Role.STAFF && activityRecord.facultyId && activityRecord.facultyId !== actor.facultyId) {
            throw new ForbiddenException('Hoạt động nằm ngoài Khoa phụ trách');
          }
          existingParticipantIds = new Set(activityRecord.participants.map((p: any) => p.studentId));
        }

        const validAcademicItems: any[] = [];
        const validActivityParticipants: any[] = [];
        const validClubItems: any[] = [];
        const affectedStudentIds = new Set<string>();
        const seenConfirmKeys = new Set<string>();

        for (const row of inputRows) {
          const rawCode = String(row.studentCode || '').trim();
          if (!rawCode) continue;

          const student = studentByCode.get(rawCode);
          if (!student) continue;
          if (term.workflowEnabled && !handoffMap.has(student.id)) continue;

          // Kiểm tra lại phạm vi Khoa (snapshot handoff của kỳ hoặc class)
          if (actor.role === Role.STAFF) {
            const handoff = handoffMap.get(student.id);
            const studentFacultyId = handoff ? handoff.facultyId : student.class?.facultyId;
            if (studentFacultyId !== actor.facultyId) continue;
          }

          if (dto.type === ImportBatchType.ACADEMIC) {
            const criterionCode = String(row.criterionCode || '').trim();
            if (!['1', '3', '7'].includes(criterionCode)) continue;
            const criterion = criteriaByCode.get(criterionCode);
            if (!criterion) continue;

            const dupKey = `${rawCode}:${criterionCode}`;
            if (seenConfirmKeys.has(dupKey)) continue;
            seenConfirmKeys.add(dupKey);

            const [existingGrounding, existingAssessment] = await Promise.all([
              tx.academicGrounding.findFirst({ where: { termId: dto.termId, studentId: student.id, criterionCode, status: GroundingStatus.ACTIVE }, select: { id: true } }),
              tx.criterionAssessment.findUnique({ where: { studentId_termId_criterionId: { studentId: student.id, termId: dto.termId, criterionId: criterion.id } }, select: { verifiedData: true } }),
            ]);
            if (existingGrounding || existingAssessment?.verifiedData) continue;

            const handoff = handoffMap.get(student.id);
            if (handoff && ['SENT', 'EXCLUDED'].includes(handoff.status)) continue;
            if (await tx.assessmentPublication.count({ where: { termId: dto.termId, studentId: student.id } })) continue;

            const rowData = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
            try {
              validateVerifiedData(criterion.scoringConfig as Record<string, unknown> | null, rowData, criterion.maxScore);
            } catch {
              continue;
            }

            validAcademicItems.push({
              termId: dto.termId,
              studentId: student.id,
              criterionCode,
              data: rowData as Prisma.InputJsonValue,
              source: row.source ? String(row.source).trim() : source,
              note: row.note ? String(row.note).trim() : null,
              status: GroundingStatus.ACTIVE,
            });
            affectedStudentIds.add(student.id);
          } else if (dto.type === ImportBatchType.ACTIVITY) {
            if (existingParticipantIds.has(student.id)) continue;
            const dupKey = rawCode;
            if (seenConfirmKeys.has(dupKey)) continue;
            seenConfirmKeys.add(dupKey);

            const rawRole = (row.data as any)?.role || row.role;
            const role = rawRole ? normalizeActivityRole(String(rawRole)) : 'THAM_GIA_CHINH';
            if (!['PARTICIPANT', 'ORGANIZER', 'CHEERLEADER', 'THAM_GIA_CHINH'].includes(role)) continue;
            validActivityParticipants.push({
              studentCode: rawCode,
              formRole: role,
              note: row.note ? String(row.note).trim() : undefined,
            });
            affectedStudentIds.add(student.id);
          } else if (dto.type === ImportBatchType.CLUB_LEADERSHIP) {
            const criterionCode = String(row.criterionCode || '').trim();
            if (!['4', '13'].includes(criterionCode) || !criteriaByCode.has(criterionCode)) continue;
            if (['SENT', 'EXCLUDED'].includes(handoffMap.get(student.id)?.status ?? '') || clubImportLocked?.(student.id, criterionCode)) continue;

            const orgName = String((row.data as any)?.organizationName || row.organizationName || '').trim();
            const roleTitle = String((row.data as any)?.roleTitle || row.roleTitle || '').trim();
            if (!orgName || !roleTitle) continue;

            const dupKey = `${rawCode}:${criterionCode}:${orgName}`;
            if (seenConfirmKeys.has(dupKey)) continue;
            seenConfirmKeys.add(dupKey);

            validClubItems.push({
              termId: dto.termId,
              studentId: student.id,
              criterionCode,
              organizationName: orgName,
              roleTitle,
              source: row.source ? String(row.source).trim() : source,
              note: row.note ? String(row.note).trim() : null,
              status: GroundingStatus.ACTIVE,
            });
            affectedStudentIds.add(student.id);
          }
        }

        const validCount =
          dto.type === ImportBatchType.ACADEMIC
            ? validAcademicItems.length
            : dto.type === ImportBatchType.ACTIVITY
            ? validActivityParticipants.length
            : validClubItems.length;

        if (validCount === 0) {
          throw new BadRequestException('Không có dòng dữ liệu nào hợp lệ để nhập vào hệ thống');
        }

        const facultyId = actor.role === Role.STAFF ? actor.facultyId! : (await tx.faculty.findFirst())!.id;
        const batch = await tx.importBatch.create({
          data: {
            termId: dto.termId,
            facultyId,
            type: dto.type,
            source,
            importedById: actor.id,
            totalRows: inputRows.length,
            validRows: validCount,
            status: ImportBatchStatus.ACTIVE,
            idempotencyKey: dto.idempotencyKey || null,
          },
        });

        if (dto.type === ImportBatchType.ACADEMIC) {
          await tx.academicGrounding.createMany({
            data: validAcademicItems.map((item) => ({ ...item, batchId: batch.id })),
            skipDuplicates: true,
          });

          // Tự động đồng bộ từ AcademicGrounding (ACTIVE) vào CriterionAssessment (Point 2)
          for (const studentId of affectedStudentIds) {
            await this.assessmentsService.syncStudentGrounding(tx, studentId, dto.termId);
          }
        } else if (dto.type === ImportBatchType.ACTIVITY) {
          await this.activitiesService.batchAddParticipants(
            dto.activityId!,
            {
              participants: validActivityParticipants,
              batchId: batch.id,
              source,
            },
            actor,
            tx, // TRUYỀN externalTx để tránh lồng transaction
          );
        } else if (dto.type === ImportBatchType.CLUB_LEADERSHIP) {
          await tx.clubLeadershipGrounding.createMany({
            data: validClubItems.map((item) => ({ ...item, batchId: batch.id })),
          });
          for (const studentId of affectedStudentIds) {
            await this.assessmentsService.syncStudentGrounding(tx, studentId, dto.termId, rubric.id);
          }
        }

        // Ghi AuditLog
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'GROUNDING_BATCH_IMPORTED',
            entityType: 'ImportBatch',
            entityId: batch.id,
            oldValue: null,
            newValue: {
              batchId: batch.id,
              termId: dto.termId,
              type: dto.type,
              source,
              validRowsCount: validCount,
              affectedStudentsCount: affectedStudentIds.size,
            },
          },
        });

        return {
          success: true,
          batchId: batch.id,
          type: batch.type,
          validRows: validCount,
          affectedStudentsCount: affectedStudentIds.size,
        };
      },
      { timeout: 30000 },
    );
  }

  /**
   * Danh sách các lô đã nhập của Khoa
   */
  async listBatches(actor: WorkflowActor, termId: string, type?: ImportBatchType) {
    this.assertStaffFacultyScope(actor);

    const facultyFilter = actor.role === Role.STAFF ? { facultyId: actor.facultyId! } : {};
    return this.prisma.importBatch.findMany({
      where: {
        termId,
        ...facultyFilter,
        ...(type ? { type } : {}),
      },
      include: {
        importedBy: { select: { id: true, fullName: true, email: true } },
        revokedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Xem chi tiết một lô import
   */
  async getBatchDetails(actor: WorkflowActor, batchId: string) {
    const batch = await this.prisma.importBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: {
        importedBy: { select: { id: true, fullName: true, email: true } },
        revokedBy: { select: { id: true, fullName: true, email: true } },
        academicGroundings: {
          include: { student: { select: { id: true, studentCode: true, fullName: true } } },
          take: 200,
        },
        clubLeadershipGroundings: {
          include: { student: { select: { id: true, studentCode: true, fullName: true } } },
          take: 200,
        },
        activityParticipants: {
          include: { student: { select: { id: true, studentCode: true, fullName: true } } },
          take: 200,
        },
      },
    });

    if (actor.role === Role.STAFF && actor.facultyId !== batch.facultyId) {
      throw new ForbiddenException('Lô import không thuộc Khoa quản lý của cán bộ');
    }

    return batch;
  }

  /**
   * Thu hồi lô import (Batch Revoke)
   * RÀNG BUỘC AN TOÀN TUYỆT ĐỐI:
   * Nếu có bất kỳ dòng nào trong lô đã được dùng để chốt tiêu chí (FINALIZED),
   * phiếu liên quan SENT, đã có publication hoặc kỳ đã đóng -> CHẶN TOÀN BỘ LÔ.
   */
  async revokeBatch(actor: WorkflowActor, batchId: string, reasonOrDto: string | { reason: string }) {
    this.assertStaffFacultyScope(actor);
    const reason = typeof reasonOrDto === 'string' ? reasonOrDto : reasonOrDto?.reason;
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Bắt buộc phải nhập lý do khi thu hồi lô');
    }

    const batch = await this.prisma.importBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: { term: true },
    });

    if (actor.role === Role.STAFF && actor.facultyId !== batch.facultyId) {
      throw new ForbiddenException('Lô import không thuộc Khoa quản lý của cán bộ');
    }

    if (batch.status === ImportBatchStatus.REVOKED) {
      throw new BadRequestException('Lô import này đã được thu hồi trước đó');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const term = await lockTerm(tx, batch.termId);
        assertF15Open(term);

        const currentBatch = await tx.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
        if (currentBatch.status !== ImportBatchStatus.ACTIVE) throw new BadRequestException('Lô import này đã được thu hồi trước đó');

        const blockers: string[] = [];

        if (batch.type === ImportBatchType.ACADEMIC) {
          const groundings = await tx.academicGrounding.findMany({
            where: { batchId: batch.id, status: GroundingStatus.ACTIVE },
            include: { student: { select: { id: true, studentCode: true, fullName: true } } },
          });

          const studentIds = [...new Set(groundings.map((g) => g.studentId))];

          // 1. Kiểm tra phiếu SENT hoặc EXCLUDED
          const handoffs = await tx.assessmentHandoff.findMany({
            where: { termId: batch.termId, studentId: { in: studentIds } },
            include: { student: { select: { studentCode: true, fullName: true } } },
          });
          for (const h of handoffs) {
            if (h.status === 'SENT') {
              blockers.push(`Sinh viên ${h.student.studentCode} (${h.student.fullName}) đã được gửi lên CTSV/Admin (SENT)`);
            }
          }

          // 2. Kiểm tra đã có publication chưa
          const publications = await tx.assessmentPublication.findMany({
            where: { termId: batch.termId, studentId: { in: studentIds } },
            select: { studentId: true },
          });
          if (publications.length > 0) {
            blockers.push(`Đã có ${publications.length} kết quả sinh viên được công bố chính thức`);
          }

          // 3. Kiểm tra xem có tiêu chí nào liên quan đã bị chốt FINALIZED chưa
          for (const g of groundings) {
            const criterion = await tx.criterion.findFirst({
              where: { code: g.criterionCode, rubricVersion: { termId: batch.termId, status: 'PUBLISHED' } },
            });
            if (criterion) {
              const ca = await tx.criterionAssessment.findUnique({
                where: {
                  studentId_termId_criterionId: {
                    studentId: g.studentId,
                    termId: batch.termId,
                    criterionId: criterion.id,
                  },
                },
              });
              if (ca && ca.status === 'FINALIZED') {
                blockers.push(
                  `Tiêu chí ${g.criterionCode} của sinh viên ${g.student.studentCode} (${g.student.fullName}) đã được chốt chính thức (FINALIZED)`,
                );
              }
            }
          }

          if (blockers.length > 0) {
            throw new BadRequestException({
              message: 'Không thể thu hồi lô do có dữ liệu đã được chốt hoặc đã gửi Admin',
              blockers,
            });
          }

          // Thực hiện vô hiệu hóa
          await tx.academicGrounding.updateMany({
            where: { batchId: batch.id },
            data: { status: GroundingStatus.REVOKED },
          });

          await tx.importBatch.update({
            where: { id: batch.id },
            data: {
              status: ImportBatchStatus.REVOKED,
              revokedById: actor.id,
              revokedAt: new Date(),
              revokeReason: reason.trim(),
            },
          });

          // Tự động đồng bộ lại để xóa/tính lại điểm gợi ý từ lô bị thu hồi
          for (const studentId of studentIds) {
            await this.assessmentsService.syncStudentGrounding(tx, studentId, batch.termId);
          }
        } else if (batch.type === ImportBatchType.ACTIVITY) {
          const participants = await tx.activityParticipant.findMany({
            where: { batchId: batch.id },
            include: {
              student: { select: { id: true, studentCode: true, fullName: true } },
              activity: { select: { id: true, termId: true, criterionId: true } },
            },
          });

          const studentIds = [...new Set(participants.map((p) => p.studentId))];
          const activityMap = new Map<string, { id: string; termId: string | null; criterionId: string | null }>();
          for (const p of participants) {
            if (p.activity) activityMap.set(p.activity.id, p.activity);
          }

          // Kiểm tra xem có sinh viên nào trong lô đã gửi lên CTSV (SENT) chưa
          const sentHandoffs = await tx.assessmentHandoff.findMany({
            where: { termId: batch.termId, studentId: { in: studentIds }, status: 'SENT' },
            include: { student: { select: { studentCode: true } } },
          });
          if (sentHandoffs.length > 0) {
            blockers.push(`Đã có ${sentHandoffs.length} phiếu sinh viên trong lô hoạt động này được gửi lên CTSV (SENT)`);
          }
          const publications = await tx.assessmentPublication.count({ where: { termId: batch.termId, studentId: { in: studentIds } } });
          if (publications) blockers.push(`Đã có ${publications} kết quả sinh viên được công bố`);

          // Kiểm tra xem có sinh viên nào đã được chốt điểm chính thức (FINALIZED) cho tiêu chí của hoạt động này chưa
          for (const activity of activityMap.values()) {
            if (activity.criterionId) {
              const finalizedAssessments = await tx.criterionAssessment.findMany({
                where: {
                  termId: batch.termId,
                  studentId: { in: studentIds },
                  criterionId: activity.criterionId,
                  status: 'FINALIZED',
                },
                include: { student: { select: { studentCode: true } } },
              });
              for (const fa of finalizedAssessments) {
                blockers.push(`Sinh viên ${fa.student.studentCode} đã được chốt chính thức (FINALIZED) cho tiêu chí của hoạt động này`);
              }
            }
          }

          if (blockers.length > 0) {
            throw new BadRequestException({
              message: 'Không thể thu hồi lô hoạt động do một số sinh viên đã chốt điểm hoặc đã gửi Admin',
              blockers,
            });
          }

          // Giữ lại lịch sử từng dòng, kể cả người và thời điểm xác nhận trước đó.
          await tx.activityParticipant.updateMany({
            where: { batchId: batch.id, status: { not: 'REVOKED' } },
            data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason.trim(), revision: { increment: 1 } },
          });

          await tx.importBatch.update({
            where: { id: batch.id },
            data: {
              status: ImportBatchStatus.REVOKED,
              revokedById: actor.id,
              revokedAt: new Date(),
              revokeReason: reason.trim(),
            },
          });

          // Tự động tính toán lại điểm tiêu chí cho các sinh viên bị ảnh hưởng
          for (const activity of activityMap.values()) {
            if (activity.termId && activity.criterionId) {
              for (const studentId of studentIds) {
                await recomputeAndSaveActivityCriterion(
                  tx,
                  { studentId, termId: activity.termId, criterionId: activity.criterionId },
                  'Dữ liệu được cập nhật lại sau khi thu hồi lô điểm danh hoạt động.',
                );
              }
            }
          }
        } else if (batch.type === ImportBatchType.CLUB_LEADERSHIP) {
          const groundings = await tx.clubLeadershipGrounding.findMany({
            where: { batchId: batch.id, status: GroundingStatus.ACTIVE },
            include: { student: { select: { id: true, studentCode: true, fullName: true } } },
          });

          const studentIds = [...new Set(groundings.map((g) => g.studentId))];

          const handedOff = await tx.assessmentHandoff.count({
            where: { termId: batch.termId, studentId: { in: studentIds }, status: { in: ['SENT', 'EXCLUDED'] } },
          });
          if (handedOff) blockers.push('Có phiếu sinh viên trong lô đã gửi CTSV hoặc đã bị loại trừ');

          const published = await tx.assessmentPublication.count({
            where: { termId: batch.termId, studentId: { in: studentIds } },
          });
          if (published) blockers.push('Có kết quả sinh viên trong lô đã được công bố');

          const finalized = await tx.criterionAssessment.findMany({
            where: {
              termId: batch.termId,
              status: 'FINALIZED',
              studentId: { in: studentIds },
              criterion: { code: { in: [...new Set(groundings.map(row => row.criterionCode))] }, rubricVersion: { termId: batch.termId, status: 'PUBLISHED' } },
            },
            select: { studentId: true, student: { select: { studentCode: true } }, criterion: { select: { code: true } } },
          });
          const affectedCriteria = new Set(groundings.map(row => `${row.studentId}:${row.criterionCode}`));
          for (const row of finalized) {
            if (affectedCriteria.has(`${row.studentId}:${row.criterion.code}`)) {
              blockers.push(`Tiêu chí ${row.criterion.code} của sinh viên ${row.student.studentCode} đã được chốt chính thức (FINALIZED)`);
            }
          }

          if (blockers.length > 0) {
            throw new BadRequestException({
              message: 'Không thể thu hồi lô CLB/BTC vì có phiếu đã khóa, chốt điểm hoặc công bố',
              blockers,
            });
          }

          await tx.clubLeadershipGrounding.updateMany({
            where: { batchId: batch.id },
            data: { status: GroundingStatus.REVOKED },
          });

          await tx.importBatch.update({
            where: { id: batch.id },
            data: {
              status: ImportBatchStatus.REVOKED,
              revokedById: actor.id,
              revokedAt: new Date(),
              revokeReason: reason.trim(),
            },
          });
          for (const studentId of studentIds) {
            await this.assessmentsService.syncStudentGrounding(tx, studentId, batch.termId);
          }
        }

        // Ghi AuditLog
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'GROUNDING_BATCH_REVOKED',
            entityType: 'ImportBatch',
            entityId: batch.id,
            oldValue: { status: ImportBatchStatus.ACTIVE },
            newValue: {
              status: ImportBatchStatus.REVOKED,
              reason: reason.trim(),
              revokedAt: new Date(),
            },
          },
        });

        return {
          success: true,
          batchId: batch.id,
          message: 'Thu hồi lô căn cứ thành công; các điểm gợi ý liên quan đã được tính toán lại',
        };
      },
      { timeout: 30000 },
    );
  }
}
