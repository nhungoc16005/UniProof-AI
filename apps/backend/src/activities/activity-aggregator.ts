import { BadRequestException } from '@nestjs/common';
import { Prisma, ActivityParticipantStatus, EvidenceStatus } from '@prisma/client';
import { evaluateRubricCriterion } from '../criteria/rubric-scoring';

export function normalizeActivityRole(role?: string | null): string {
  if (!role) return 'PARTICIPANT';
  const upper = String(role).trim().toUpperCase();
  if (upper === 'CO_VU' || upper === 'CHEERLEADER') return 'CHEERLEADER';
  if (upper === 'BAN_TO_CHUC' || upper === 'BTC' || upper === 'ORGANIZER') return 'ORGANIZER';
  if (upper === 'THAM_GIA' || upper === 'THAM_GIA_CHINH' || upper === 'PARTICIPANT' || !upper) return 'PARTICIPANT';
  return upper;
}

export interface AggregateActivityCriterionParams {
  studentId: string;
  termId: string;
  criterionId: string;
}

export interface UnifiedActivityAggregation {
  verifiedDataUpdates: {
    verifiedActivityCount: number;
    cheerleaderActivityCount: number;
    convertedCommunityPoints: number;
    activitySource: string;
  };
  evaluation: {
    status: 'READY_FOR_REVIEW' | 'NEEDS_VERIFICATION';
    suggestedScore: number | null;
    reason: string;
  };
  hasRoleConflict: boolean;
  hasUnresolvedEvidence: boolean;
  blockerReason?: string;
}

/**
 * Tổng hợp toàn bộ nguồn hoạt động của sinh viên trong kỳ cho một tiêu chí:
 * Hợp nhất điểm danh đã xác nhận (Attendance CONFIRMED) và minh chứng đã duyệt (Evidence APPROVED).
 * Cùng activityId chỉ tính 1 lần; ưu tiên vai trò từ Attendance CONFIRMED.
 * Phát hiện mâu thuẫn vai trò giữa các Evidence APPROVED nếu không có Attendance làm chuẩn.
 */
export async function aggregateStudentActivitySources(
  tx: Prisma.TransactionClient,
  params: AggregateActivityCriterionParams
): Promise<UnifiedActivityAggregation> {
  const { studentId, termId, criterionId } = params;

  // 1. Đọc Criterion
  const criterion = await tx.criterion.findUniqueOrThrow({
    where: { id: criterionId },
    select: { id: true, maxScore: true, scoringConfig: true, rolesScore: true },
  });

  const config = criterion.scoringConfig as Record<string, any> | null;
  if (!config || !['activity_threshold', 'community_activity_tier'].includes(String(config.kind))) {
    throw new BadRequestException('Tiêu chí không thuộc nhóm tính điểm theo hoạt động hoặc cộng đồng');
  }

  // 2. Đọc Attendance CONFIRMED của sinh viên
  const attendances = await tx.activityParticipant.findMany({
    where: {
      studentId,
      status: ActivityParticipantStatus.CONFIRMED,
      activity: { termId, criterionId },
    },
    select: { id: true, activityId: true, formRole: true },
  });

  // 3. Đọc CriterionAssessment hiện tại để tìm các Evidence đã liên kết
  const existingAssessment = await tx.criterionAssessment.findUnique({
    where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
    select: { id: true, verifiedData: true },
  });

  const evidences = existingAssessment
    ? await tx.evidence.findMany({
        where: { studentId, termId, criterionAssessmentId: existingAssessment.id },
        select: { id: true, activityId: true, declaredRole: true, status: true },
      })
    : [];

  const hasUnresolvedEvidence = evidences.some(
    (e) =>
      e.status !== EvidenceStatus.APPROVED &&
      e.status !== EvidenceStatus.REJECTED &&
      e.status !== EvidenceStatus.WITHDRAWN
  );

  const approvedEvidences = evidences.filter((e) => e.status === EvidenceStatus.APPROVED);

  // 4. Hợp nhất nguồn hoạt động (Aggregation)
  type AggregatedSource = {
    sourceKey: string;
    activityId?: string;
    role: string | null;
    fromAttendance: boolean;
    fromEvidence: boolean;
  };

  const sourceMap = new Map<string, AggregatedSource>();
  let hasRoleConflict = false;
  const activityApprovedRoles = new Map<string, Set<string>>();

  // Nạp từ Attendance CONFIRMED (Ưu tiên vai trò từ attendance)
  for (const att of attendances) {
    const key = `activity:${att.activityId}`;
    sourceMap.set(key, {
      sourceKey: key,
      activityId: att.activityId,
      role: att.formRole,
      fromAttendance: true,
      fromEvidence: false,
    });
  }

  // Nạp từ Approved Evidences
  for (const evi of approvedEvidences) {
    const key = evi.activityId ? `activity:${evi.activityId}` : `evidence:${evi.id}`;
    if (evi.activityId) {
      if (!activityApprovedRoles.has(evi.activityId)) {
        activityApprovedRoles.set(evi.activityId, new Set());
      }
      if (evi.declaredRole) {
        activityApprovedRoles.get(evi.activityId)!.add(evi.declaredRole);
      }
    }

    if (sourceMap.has(key)) {
      // Đã có Attendance -> đánh dấu có cả evidence, giữ vai trò attendance theo DEC-008
      const existing = sourceMap.get(key)!;
      existing.fromEvidence = true;
    } else {
      sourceMap.set(key, {
        sourceKey: key,
        activityId: evi.activityId ?? undefined,
        role: evi.declaredRole ?? null,
        fromAttendance: false,
        fromEvidence: true,
      });
    }
  }

  // Kiểm tra mâu thuẫn vai trò: Nếu cùng activityId có nhiều evidence APPROVED mà vai trò khác nhau và không có attendance CONFIRMED
  for (const [actId, roles] of activityApprovedRoles.entries()) {
    const hasAttendance = attendances.some((a) => a.activityId === actId);
    if (!hasAttendance) {
      const normalizedRoles = new Set([...roles].map((r) => normalizeActivityRole(r)));
      if (normalizedRoles.size > 1) {
        hasRoleConflict = true;
        break;
      }
    }
  }

  // 5. Tính toán các chỉ số server-owned
  const verifiedActivityCount = sourceMap.size;
  const cheerleaderActivityCount = [...sourceMap.values()].filter((item) =>
    normalizeActivityRole(item.role) === 'CHEERLEADER'
  ).length;

  let convertedCommunityPoints = 0;
  let blockerReason: string | undefined;

  if (config.kind === 'community_activity_tier') {
    const roleScores =
      criterion.rolesScore && typeof criterion.rolesScore === 'object' && !Array.isArray(criterion.rolesScore)
        ? (criterion.rolesScore as Record<string, unknown>)
        : null;

    const normalizedRoleScores: Record<string, number> = {};
    const aliasMap = new Map<string, Array<{ key: string; score: number }>>();

    if (roleScores) {
      for (const [key, val] of Object.entries(roleScores)) {
        if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          const normKey = normalizeActivityRole(key);
          normalizedRoleScores[normKey] = val;
          normalizedRoleScores[key.trim().toUpperCase()] = val;
          if (!aliasMap.has(normKey)) aliasMap.set(normKey, []);
          aliasMap.get(normKey)!.push({ key, score: val });
        }
      }
    }

    // Kiểm tra alias mâu thuẫn trong cấu hình điểm vai trò
    let hasAliasConflict = false;
    for (const [normKey, list] of aliasMap.entries()) {
      if (list.length > 1) {
        const first = list[0].score;
        if (list.some((item) => Math.abs(item.score - first) > 0.0001)) {
          hasAliasConflict = true;
          blockerReason = `Tiêu chí cộng đồng có cấu hình điểm vai trò mâu thuẫn cho vai trò ${normKey} (${list.map((i) => `${i.key}=${i.score}đ`).join(', ')}).`;
          break;
        }
      }
    }

    if (!hasAliasConflict) {
      if (!roleScores || Object.keys(normalizedRoleScores).length === 0) {
        blockerReason = 'Tiêu chí cộng đồng chưa cấu hình bảng điểm vai trò rolesScore trong rubric.';
      } else {
        for (const item of sourceMap.values()) {
          const normRole = normalizeActivityRole(item.role);
          const configuredPoints = normalizedRoleScores[normRole];
          if (configuredPoints === undefined || configuredPoints === null) {
            blockerReason = `Tiêu chí cộng đồng thiếu cấu hình điểm cho vai trò '${item.role || normRole}' trong rubric rolesScore.`;
            break;
          }
          convertedCommunityPoints += configuredPoints;
        }
      }
    }
  }

  const verifiedDataUpdates = {
    verifiedActivityCount,
    cheerleaderActivityCount,
    convertedCommunityPoints,
    activitySource: 'UNIFIED_ACTIVITY_AGGREGATOR',
  };

  // 6. Tính evaluation
  let evaluation: {
    status: 'READY_FOR_REVIEW' | 'NEEDS_VERIFICATION';
    suggestedScore: number | null;
    reason: string;
  };

  if (blockerReason) {
    evaluation = {
      status: 'NEEDS_VERIFICATION',
      suggestedScore: null,
      reason: blockerReason,
    };
  } else if (hasRoleConflict) {
    evaluation = {
      status: 'NEEDS_VERIFICATION',
      suggestedScore: null,
      reason: 'Mâu thuẫn vai trò tham gia hoạt động giữa các minh chứng đã duyệt; cần cán bộ xác nhận lại vai trò.',
    };
  } else if (hasUnresolvedEvidence) {
    evaluation = {
      status: 'NEEDS_VERIFICATION',
      suggestedScore: null,
      reason: 'Còn minh chứng đang chờ xử lý; điểm chỉ được tính sau khi hồ sơ liên quan được duyệt hoặc kết thúc.',
    };
  } else {
    const previous =
      existingAssessment?.verifiedData &&
      typeof existingAssessment.verifiedData === 'object' &&
      !Array.isArray(existingAssessment.verifiedData)
        ? (existingAssessment.verifiedData as Record<string, any>)
        : {};

    const fullVerifiedData = {
      ...previous,
      ...verifiedDataUpdates,
    };

    evaluation = evaluateRubricCriterion(criterion.maxScore, criterion.scoringConfig, fullVerifiedData);
  }

  return {
    verifiedDataUpdates,
    evaluation,
    hasRoleConflict,
    hasUnresolvedEvidence,
    blockerReason,
  };
}

/**
 * Tính toán lại tiêu chí hoạt động và cập nhật CriterionAssessment trong transaction.
 * Tự động vô hiệu hóa officialScore cũ nếu căn cứ hoạt động thay đổi.
 */
export async function recomputeAndSaveActivityCriterion(
  tx: Prisma.TransactionClient,
  params: AggregateActivityCriterionParams,
  verificationNote = 'Dữ liệu được tổng hợp từ nguồn hoạt động chung (điểm danh & minh chứng).'
) {
  const { studentId, termId, criterionId } = params;
  const { verifiedDataUpdates, evaluation } = await aggregateStudentActivitySources(tx, params);

  const existingAssessment = await tx.criterionAssessment.findUnique({
    where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
    select: { verifiedData: true },
  });

  const previous =
    existingAssessment?.verifiedData &&
    typeof existingAssessment.verifiedData === 'object' &&
    !Array.isArray(existingAssessment.verifiedData)
      ? (existingAssessment.verifiedData as Record<string, any>)
      : {};

  const verifiedData = {
    ...previous,
    ...verifiedDataUpdates,
  };

  return tx.criterionAssessment.upsert({
    where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
    create: {
      studentId,
      termId,
      criterionId,
      verifiedData,
      verificationNote,
      suggestedScore: evaluation.suggestedScore,
      suggestionReason: evaluation.reason,
      status: evaluation.status,
    },
    update: {
      verifiedData,
      verificationNote,
      suggestedScore: evaluation.suggestedScore,
      suggestionReason: evaluation.reason,
      status: evaluation.status,
      officialScore: null,
      officialReason: null,
      finalizedAt: null,
      finalReviewerId: null,
    },
  });
}
