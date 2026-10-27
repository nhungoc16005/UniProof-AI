export type RubricEvaluation = {
  status: 'NEEDS_VERIFICATION' | 'READY_FOR_REVIEW';
  suggestedScore: number | null;
  reason: string;
};

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;

export function evaluateRubricCriterion(maxScore: number, configValue: unknown, dataValue: unknown): RubricEvaluation {
  const config = asRecord(configValue);
  const data = asRecord(dataValue);
  if (!config || !data) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Chưa có dữ liệu chính thức để tính tiêu chí này.' };
  }

  const requiredData = Array.isArray(config.requiredData) ? config.requiredData as string[] : [];
  const missing = requiredData.filter((key) => data[key] === undefined || data[key] === null);
  if (missing.length) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: `Chờ xác minh: ${missing.join(', ')}.` };
  }

  let score: number | null = null;
  let reason = '';
  const count = (key: string) => Math.max(0, Number(data[key]) || 0);

  switch (config.kind) {
    case 'leadership_duty': {
      const passed = data.leadershipRole === true && Number(data.collectiveApprovalPercent) > 90 && data.advisorConfirmation === true;
      score = passed ? Number(config.passScore) : 0;
      reason = passed ? 'Đúng chức vụ, tập thể bình chọn trên 90% và đơn vị phụ trách đã xác nhận.' : 'Chưa đủ điều kiện chức vụ, tỷ lệ bình chọn trên 90% và xác nhận của đơn vị phụ trách.';
      break;
    }
    case 'attendance_penalty': {
      score = Number(config.baseScore) - count('examBans') * Number(config.examBanPenalty) - count('classWarnings') * Number(config.warningPenalty);
      reason = `${count('examBans')} học phần bị cấm thi và ${count('classWarnings')} lần nhắc nhở đã xác minh; áp dụng mức trừ theo quy chế.`;
      break;
    }
    case 'group_penalty': {
      if (count('missedGroupDeadlines') > 0) score = 0;
      else score = Number(config.baseScore) - count('unexcusedAbsences') * Number(config.unexcusedPenalty)
        - Math.max(0, count('excusedAbsences') - 1) * Number(config.excusedPenaltyFromSecond);
      reason = count('missedGroupDeadlines') > 0 ? 'Không hoàn thành nội dung nhóm đúng hạn: trừ hết điểm.' : 'Điểm đã trừ theo số lần vắng làm việc nhóm đã xác minh.';
      break;
    }
    case 'conduct_penalty': {
      if (!data.tuitionCompliance || !data.studentWeekParticipation || data.disciplinaryViolation || !data.requiredSurveyParticipation) {
        score = 0;
        reason = 'Không đạt điều kiện học phí, tuần sinh hoạt công dân, nội quy hoặc khảo sát bắt buộc: 0 điểm.';
      } else if (count('classTaskFailures') >= 3) {
        score = 0;
        reason = 'Không hoàn thành nhiệm vụ lớp từ 3 lần: 0 điểm.';
      } else {
        score = Number(config.baseScore) - count('nonCauseAccountLocks') * 5 - count('classTaskFailures') * 3
          - count('unexcusedClassMeetingAbsences') * 10 - count('excusedClassMeetingAbsences') * 3;
        reason = 'Điểm đã trừ theo số lần khóa tài khoản và việc lớp/họp lớp đã xác minh.';
      }
      break;
    }
    case 'manual_verified':
      if (typeof data.officialScore !== 'number') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Cần cán bộ nhập điểm căn cứ trên dữ liệu/văn bản đã xác minh.' };
      }
      score = data.officialScore;
      reason = 'Điểm được đề xuất từ kết quả xác minh chính thức của cán bộ.';
      break;
    case 'academic_effort': {
      if (data.academicWarning || data.academicTier === 'BELOW_AVERAGE') score = 0;
      else if (data.academicTier === 'EXCELLENT' && data.improvedFromPreviousTerm) score = 5;
      else if (['AVERAGE', 'ABOVE_AVERAGE', 'GOOD', 'EXCELLENT'].includes(data.academicTier) && data.improvedFromPreviousTerm && ['GOOD', 'EXCELLENT'].includes(data.academicTier)) score = 5;
      else if (['AVERAGE', 'ABOVE_AVERAGE', 'GOOD', 'EXCELLENT'].includes(data.academicTier) && data.improvedFromPreviousTerm) score = 4;
      else if (['AVERAGE', 'ABOVE_AVERAGE', 'GOOD', 'EXCELLENT'].includes(data.academicTier)) score = 3;
      else return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Phân loại kết quả học tập chưa hợp lệ.' };
      reason = data.academicWarning || data.academicTier === 'BELOW_AVERAGE'
        ? 'Học lực yếu trở xuống hoặc thuộc diện cảnh báo: 0 điểm.'
        : `Điểm được xác định theo xếp loại học tập ${data.academicTier}${data.improvedFromPreviousTerm ? ' và mức cải thiện so với kỳ trước' : ''}.`;
      break;
    }
    case 'verified_boolean': {
      const passed = requiredData.every((key) => data[key] === true);
      score = passed ? Number(config.passScore) : 0;
      reason = passed ? 'Đã đủ các xác nhận bắt buộc.' : 'Không đủ điều kiện theo các xác nhận đã kiểm tra.';
      break;
    }
    case 'award_tier': {
      const tiers = config.scores as Record<string, number>;
      if (!Object.prototype.hasOwnProperty.call(tiers || {}, data.awardTier)) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Mức thành tích chưa được xác nhận hợp lệ.' };
      }
      score = Number(tiers[data.awardTier]);
      reason = data.awardTier === 'CONSOLATION_OR_HIGHER' ? 'Có giải từ khuyến khích trở lên: 3 điểm.' : 'Có xác nhận tham gia nhưng không đạt giải: 2 điểm.';
      break;
    }
    case 'activity_threshold': {
      const activityCount = count('verifiedActivityCount');
      const tiers = Array.isArray(config.tiers) ? config.tiers as Array<{ min: number; score: number }> : [];
      const tierScore = [...tiers].sort((a, b) => b.min - a.min).find((tier) => activityCount >= tier.min)?.score || 0;
      const cheerleaderCount = config.cheerleaderMultiplier ? count('cheerleaderActivityCount') : 0;
      const participantCount = Math.max(0, activityCount - cheerleaderCount);
      const participantScore = [...tiers].sort((a, b) => b.min - a.min).find((tier) => participantCount >= tier.min)?.score || 0;
      const cheerScore = [...tiers].sort((a, b) => b.min - a.min).find((tier) => cheerleaderCount >= tier.min)?.score || 0;
      score = config.cheerleaderMultiplier
        ? participantScore + cheerScore * Number(config.cheerleaderMultiplier)
        : tierScore;
      reason = activityCount === 0
        ? 'Không có hoạt động được xác minh: 0 điểm.'
        : `${activityCount} hoạt động được xác minh${cheerleaderCount ? `; phần cổ vũ áp dụng hệ số ${config.cheerleaderMultiplier}` : ''}.`;
      break;
    }
    case 'all_conditions': {
      const passed = data.healthInsurance === true && data.residenceDeclaration === true && Number(data.communityViolations) === 0;
      score = passed ? Number(config.passScore) : Number(config.failScore);
      reason = passed ? 'Đủ xác nhận bảo hiểm, cư trú và không vi phạm.' : 'Có điều kiện không đạt theo quy chế: 0 điểm.';
      break;
    }
    case 'community_activity_tier': {
      const activityCount = count('verifiedActivityCount');
      const convertedPoints = count('convertedCommunityPoints');
      const tiers = Array.isArray(config.tiers) ? config.tiers as Array<{ minCount: number; minPoints: number; score: number }> : [];
      const tier = [...tiers].sort((a, b) => b.score - a.score).find((item) => activityCount >= item.minCount && convertedPoints >= item.minPoints);
      score = tier?.score || 0;
      reason = tier
        ? `${activityCount} hoạt động và ${convertedPoints} điểm quy đổi đã được xác minh.`
        : activityCount === 0 ? 'Không tham gia hoạt động: 0 điểm.' : 'Chưa đạt ngưỡng hoạt động và điểm quy đổi.';
      break;
    }
    default:
      return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Cấu hình tính điểm chưa được hỗ trợ.' };
  }

  if (!Number.isFinite(score)) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu xác minh không hợp lệ.' };
  }
  const boundedScore = Math.min(maxScore, Math.max(0, score as number));
  return {
    status: 'READY_FOR_REVIEW',
    suggestedScore: boundedScore,
    reason: boundedScore === score ? reason : `${reason} Điểm được giới hạn trong khoảng 0–${maxScore}.`,
  };
}
