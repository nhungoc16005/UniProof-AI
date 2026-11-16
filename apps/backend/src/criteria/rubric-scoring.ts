export type RubricEvaluation = {
  status: 'NEEDS_VERIFICATION' | 'READY_FOR_REVIEW';
  suggestedScore: number | null;
  reason: string;
};

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;

const getNonNegativeInteger = (data: Record<string, any>, key: string): { valid: boolean; value: number } => {
  const val = data[key];
  if (val === undefined || val === null) return { valid: false, value: 0 };
  if (typeof val === 'number' && Number.isInteger(val) && val >= 0) return { valid: true, value: val };
  return { valid: false, value: 0 };
};

const isNonNegativeNumber = (val: unknown): val is number =>
  typeof val === 'number' && Number.isFinite(val) && val >= 0;

const FORMULA_REQUIRED_FIELDS: Record<string, string[]> = {
  attendance_penalty: ['examBans', 'classWarnings'],
  group_penalty: ['unexcusedAbsences', 'excusedAbsences', 'missedGroupDeadlines'],
  conduct_penalty: [
    'tuitionCompliance', 'studentWeekParticipation', 'disciplinaryViolation',
    'requiredSurveyParticipation', 'nonCauseAccountLocks', 'classTaskFailures',
    'unexcusedClassMeetingAbsences', 'excusedClassMeetingAbsences',
  ],
  leadership_duty: ['leadershipRole', 'collectiveApprovalPercent', 'advisorConfirmation'],
  all_conditions: ['healthInsurance', 'residenceDeclaration', 'communityViolations'],
  community_activity_tier: ['verifiedActivityCount', 'convertedCommunityPoints'],
  academic_effort: ['academicTier', 'improvedFromPreviousTerm', 'academicWarning'],
  award_tier: ['awardTier'],
  activity_threshold: ['verifiedActivityCount'],
  manual_verified: ['officialScore'],
};

function validateConfigForEvaluation(config: Record<string, any>): { valid: boolean; reason?: string } {
  if (!config || typeof config !== 'object' || typeof config.kind !== 'string') {
    return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ.' };
  }

  switch (config.kind) {
    case 'attendance_penalty':
      if (!isNonNegativeNumber(config.baseScore) || !isNonNegativeNumber(config.examBanPenalty) || !isNonNegativeNumber(config.warningPenalty)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai baseScore/penalty).' };
      }
      break;
    case 'group_penalty':
      if (!isNonNegativeNumber(config.baseScore) || !isNonNegativeNumber(config.unexcusedPenalty) || !isNonNegativeNumber(config.excusedPenaltyFromSecond)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai baseScore/penalty).' };
      }
      break;
    case 'conduct_penalty':
      if (!isNonNegativeNumber(config.baseScore)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai baseScore).' };
      }
      break;
    case 'leadership_duty':
    case 'verified_boolean':
      if (!isNonNegativeNumber(config.passScore)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai passScore).' };
      }
      break;
    case 'all_conditions':
      if (!isNonNegativeNumber(config.passScore) || !isNonNegativeNumber(config.failScore)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai passScore/failScore).' };
      }
      break;
    case 'award_tier':
      if (!config.scores || typeof config.scores !== 'object' || Array.isArray(config.scores)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (scores phải là object).' };
      }
      for (const [, score] of Object.entries(config.scores)) {
        if (!isNonNegativeNumber(score)) {
          return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (điểm thành tích phải là số).' };
        }
      }
      break;
    case 'activity_threshold':
      if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (tiers phải là danh sách không rỗng).' };
      }
      for (const tier of config.tiers) {
        if (!tier || typeof tier !== 'object' || !isNonNegativeNumber(tier.min) || !isNonNegativeNumber(tier.score)) {
          return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (phần tử tiers không hợp lệ).' };
        }
      }
      if (config.cheerleaderMultiplier !== undefined && (!isNonNegativeNumber(config.cheerleaderMultiplier) || config.cheerleaderMultiplier <= 0 || config.cheerleaderMultiplier > 1)) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (cheerleaderMultiplier phải trong (0, 1]).' };
      }
      break;
    case 'community_activity_tier':
      if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
        return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (tiers phải là danh sách không rỗng).' };
      }
      for (const tier of config.tiers) {
        if (!tier || typeof tier !== 'object' || !isNonNegativeNumber(tier.minCount) || !isNonNegativeNumber(tier.minPoints) || !isNonNegativeNumber(tier.score)) {
          return { valid: false, reason: 'Cấu hình tiêu chí không hợp lệ (phần tử tiers không hợp lệ).' };
        }
      }
      break;
    case 'manual_verified':
    case 'academic_effort':
      break;
    default:
      return { valid: false, reason: 'Cấu hình tính điểm chưa được hỗ trợ.' };
  }

  return { valid: true };
}

export function evaluateRubricCriterion(maxScore: number, configValue: unknown, dataValue: unknown): RubricEvaluation {
  const config = asRecord(configValue);
  const data = asRecord(dataValue);
  if (!config || !data) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Chưa có dữ liệu chính thức để tính tiêu chí này.' };
  }

  const configValidation = validateConfigForEvaluation(config);
  if (!configValidation.valid) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: configValidation.reason || 'Cấu hình tiêu chí không hợp lệ.' };
  }

  const declaredRequired = Array.isArray(config.requiredData) ? config.requiredData as string[] : [];
  const formulaRequired = FORMULA_REQUIRED_FIELDS[config.kind] || [];
  const allRequired = Array.from(new Set([...declaredRequired, ...formulaRequired]));
  const missing = allRequired.filter((key) => data[key] === undefined || data[key] === null);
  if (missing.length) {
    return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: `Chờ xác minh: ${missing.join(', ')}.` };
  }

  let score: number | null = null;
  let reason = '';

  switch (config.kind) {
    case 'leadership_duty': {
      if (typeof data.leadershipRole !== 'boolean') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu chức vụ cán bộ phải có kiểu boolean.' };
      }
      if (typeof data.collectiveApprovalPercent !== 'number' || !Number.isFinite(data.collectiveApprovalPercent) || data.collectiveApprovalPercent < 0 || data.collectiveApprovalPercent > 100) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu tỷ lệ bình chọn phải là số từ 0 đến 100.' };
      }
      if (typeof data.advisorConfirmation !== 'boolean') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu xác nhận của đơn vị phụ trách phải có kiểu boolean.' };
      }
      const passed = data.leadershipRole === true && Number(data.collectiveApprovalPercent) > 90 && data.advisorConfirmation === true;
      score = passed ? Number(config.passScore) : 0;
      reason = passed ? 'Đúng chức vụ, tập thể bình chọn trên 90% và đơn vị phụ trách đã xác nhận.' : 'Chưa đủ điều kiện chức vụ, tỷ lệ bình chọn trên 90% và xác nhận của đơn vị phụ trách.';
      break;
    }
    case 'attendance_penalty': {
      const examBans = getNonNegativeInteger(data, 'examBans');
      if (!examBans.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số học phần bị cấm thi không hợp lệ.' };
      }
      const classWarnings = getNonNegativeInteger(data, 'classWarnings');
      if (!classWarnings.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần nhắc nhở không hợp lệ.' };
      }
      score = Number(config.baseScore) - examBans.value * Number(config.examBanPenalty) - classWarnings.value * Number(config.warningPenalty);
      reason = `${examBans.value} học phần bị cấm thi và ${classWarnings.value} lần nhắc nhở đã xác minh; áp dụng mức trừ theo quy chế.`;
      break;
    }
    case 'group_penalty': {
      const missedGroupDeadlines = getNonNegativeInteger(data, 'missedGroupDeadlines');
      if (!missedGroupDeadlines.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số nội dung nhóm trễ hạn không hợp lệ.' };
      }
      const unexcusedAbsences = getNonNegativeInteger(data, 'unexcusedAbsences');
      if (!unexcusedAbsences.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần vắng nhóm không lý do không hợp lệ.' };
      }
      const excusedAbsences = getNonNegativeInteger(data, 'excusedAbsences');
      if (!excusedAbsences.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần vắng nhóm có lý do không hợp lệ.' };
      }
      if (missedGroupDeadlines.value > 0) score = 0;
      else score = Number(config.baseScore) - unexcusedAbsences.value * Number(config.unexcusedPenalty)
        - Math.max(0, excusedAbsences.value - 1) * Number(config.excusedPenaltyFromSecond);
      reason = missedGroupDeadlines.value > 0 ? 'Không hoàn thành nội dung nhóm đúng hạn: trừ hết điểm.' : 'Điểm đã trừ theo số lần vắng làm việc nhóm đã xác minh.';
      break;
    }
    case 'conduct_penalty': {
      if (typeof data.tuitionCompliance !== 'boolean' || typeof data.studentWeekParticipation !== 'boolean' || typeof data.disciplinaryViolation !== 'boolean' || typeof data.requiredSurveyParticipation !== 'boolean') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu điều kiện quy chế phải có kiểu boolean.' };
      }
      const nonCauseLocks = getNonNegativeInteger(data, 'nonCauseAccountLocks');
      if (!nonCauseLocks.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần khóa tài khoản không hợp lệ.' };
      }
      const classFailures = getNonNegativeInteger(data, 'classTaskFailures');
      if (!classFailures.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần không hoàn thành việc lớp không hợp lệ.' };
      }
      const unexcusedMeeting = getNonNegativeInteger(data, 'unexcusedClassMeetingAbsences');
      if (!unexcusedMeeting.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần vắng họp lớp không lý do không hợp lệ.' };
      }
      const excusedMeeting = getNonNegativeInteger(data, 'excusedClassMeetingAbsences');
      if (!excusedMeeting.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số lần vắng họp lớp có lý do không hợp lệ.' };
      }
      if (!data.tuitionCompliance || !data.studentWeekParticipation || data.disciplinaryViolation || !data.requiredSurveyParticipation) {
        score = 0;
        reason = 'Không đạt điều kiện học phí, tuần sinh hoạt công dân, nội quy hoặc khảo sát bắt buộc: 0 điểm.';
      } else if (classFailures.value >= 3) {
        score = 0;
        reason = 'Không hoàn thành nhiệm vụ lớp từ 3 lần: 0 điểm.';
      } else {
        score = Number(config.baseScore) - nonCauseLocks.value * 5 - classFailures.value * 3
          - unexcusedMeeting.value * 10 - excusedMeeting.value * 3;
        reason = 'Điểm đã trừ theo số lần khóa tài khoản và việc lớp/họp lớp đã xác minh.';
      }
      break;
    }
    case 'manual_verified':
      if (typeof data.officialScore !== 'number' || !Number.isFinite(data.officialScore) || data.officialScore < 0 || data.officialScore > maxScore) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Cần cán bộ nhập điểm căn cứ trên dữ liệu/văn bản đã xác minh.' };
      }
      score = data.officialScore;
      reason = 'Điểm được đề xuất từ kết quả xác minh chính thức của cán bộ.';
      break;
    case 'academic_effort': {
      if (typeof data.academicTier !== 'string' || typeof data.academicWarning !== 'boolean' || typeof data.improvedFromPreviousTerm !== 'boolean') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu kết quả học tập không hợp lệ.' };
      }
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
      for (const key of allRequired) {
        if (typeof data[key] !== 'boolean') {
          return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: `Dữ liệu trường ${key} phải có kiểu boolean.` };
        }
      }
      const passed = allRequired.every((key) => data[key] === true);
      score = passed ? Number(config.passScore) : 0;
      reason = passed ? 'Đã đủ các xác nhận bắt buộc.' : 'Không đủ điều kiện theo các xác nhận đã kiểm tra.';
      break;
    }
    case 'award_tier': {
      const tiers = config.scores as Record<string, number>;
      if (typeof data.awardTier !== 'string' || !Object.prototype.hasOwnProperty.call(tiers, data.awardTier)) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Mức thành tích chưa được xác nhận hợp lệ.' };
      }
      score = Number(tiers[data.awardTier]);
      reason = data.awardTier === 'CONSOLATION_OR_HIGHER' ? 'Có giải từ khuyến khích trở lên: 3 điểm.' : 'Có xác nhận tham gia nhưng không đạt giải: 2 điểm.';
      break;
    }
    case 'activity_threshold': {
      const activities = getNonNegativeInteger(data, 'verifiedActivityCount');
      if (!activities.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số hoạt động xác minh không hợp lệ.' };
      }
      const activityCount = activities.value;
      const tiers = config.tiers as Array<{ min: number; score: number }>;
      const tierScore = [...tiers].sort((a, b) => b.min - a.min).find((tier) => activityCount >= tier.min)?.score || 0;
      let cheerleaderCount = 0;
      if (config.cheerleaderMultiplier) {
        const cheerleaders = getNonNegativeInteger(data, 'cheerleaderActivityCount');
        if (!cheerleaders.valid) {
          return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số hoạt động cổ vũ không hợp lệ.' };
        }
        cheerleaderCount = cheerleaders.value;
      }
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
      if (typeof data.healthInsurance !== 'boolean' || typeof data.residenceDeclaration !== 'boolean') {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu bảo hiểm hoặc khai báo cư trú phải có kiểu boolean.' };
      }
      const violations = getNonNegativeInteger(data, 'communityViolations');
      if (!violations.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số vi phạm cộng đồng không hợp lệ.' };
      }
      const passed = data.healthInsurance === true && data.residenceDeclaration === true && violations.value === 0;
      score = passed ? Number(config.passScore) : Number(config.failScore);
      reason = passed ? 'Đủ xác nhận bảo hiểm, cư trú và không vi phạm.' : 'Có điều kiện không đạt theo quy chế: 0 điểm.';
      break;
    }
    case 'community_activity_tier': {
      const activities = getNonNegativeInteger(data, 'verifiedActivityCount');
      if (!activities.valid) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu số hoạt động xác minh không hợp lệ.' };
      }
      const activityCount = activities.value;
      const convertedPointsVal = data.convertedCommunityPoints;
      if (typeof convertedPointsVal !== 'number' || !Number.isFinite(convertedPointsVal) || convertedPointsVal < 0) {
        return { status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Dữ liệu điểm quy đổi hoạt động cộng đồng không hợp lệ.' };
      }
      const convertedPoints = convertedPointsVal;
      const tiers = config.tiers as Array<{ minCount: number; minPoints: number; score: number }>;
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
