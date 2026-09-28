import { Evidence } from '../types';

export interface CriterionProgress {
  criterionId: string;
  code: string;
  name: string;
  maxScore: number;
  category: 'KHUNG_I' | 'KHUNG_II' | 'KHUNG_III' | 'KHUNG_IV' | 'KHUNG_V';
  evidenceCount: number;
  aiSuggestedScore: number;
  officialScore: number;
  tierDescription: string;
  nextTierAdvice?: string;
  isCapped: boolean;
}

export interface CategorySummary {
  category: 'KHUNG_I' | 'KHUNG_II' | 'KHUNG_III' | 'KHUNG_IV' | 'KHUNG_V';
  name: string;
  maxScore: number;
  aiScore: number;
  officialScore: number;
  isCapped: boolean;
}

/**
 * Tính điểm theo Rule Engine bậc thang (Tiered Step Function)
 * và khống chế trần từng mục & từng khung theo quy chế ĐHBK
 */
export function calculateStudentConductScore(evidences: Evidence[]) {
  // Phân loại hồ sơ theo criterionId (nếu hồ sơ có gắn criterionId hoặc map từ tên)
  const approvedEvidences = evidences.filter((e) => e.status === 'APPROVED');
  const validEvidences = evidences.filter(
    (e) => e.status !== 'REJECTED' && e.status !== 'WITHDRAWN' && e.status !== 'DRAFT'
  );

  const getCountFor = (keywords: string[], list: Evidence[]) => {
    return list.filter((e) => {
      const text = `${e.declaredActivityName || ''} ${e.evidenceType || ''}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw.toLowerCase()));
    }).length;
  };

  // 1. Khung I (Max 20)
  // Mục 1: Đi học đầy đủ (mặc định 6.0đ)
  const crit1: CriterionProgress = {
    criterionId: 'crit-1',
    code: '1',
    name: 'Đi học đầy đủ, đúng giờ, nghiêm túc trong giờ học',
    maxScore: 6,
    category: 'KHUNG_I',
    evidenceCount: 0,
    aiSuggestedScore: 6,
    officialScore: 6,
    tierDescription: 'Mặc định 6.0 điểm nếu không có thông báo trừ điểm vắng quá hạn hoặc bị nhắc nhở.',
    isCapped: true,
  };

  // Mục 2: Trách nhiệm nhóm (mặc định 3.0đ)
  const crit2: CriterionProgress = {
    criterionId: 'crit-2',
    code: '2',
    name: 'Có ý thức, trách nhiệm khi tham gia nhóm làm việc chung',
    maxScore: 3,
    category: 'KHUNG_I',
    evidenceCount: 0,
    aiSuggestedScore: 3,
    officialScore: 3,
    tierDescription: 'Mặc định 3.0 điểm nếu không vi phạm vắng họp nhóm hoặc trễ hạn.',
    isCapped: true,
  };

  // Mục 3: Cố gắng học tập (mặc định 5.0đ theo ĐTB Giỏi)
  const crit3: CriterionProgress = {
    criterionId: 'crit-3',
    code: '3',
    name: 'Có tinh thần cố gắng, phấn đấu trong học tập (ĐTB)',
    maxScore: 5,
    category: 'KHUNG_I',
    evidenceCount: 1,
    aiSuggestedScore: 5,
    officialScore: 5,
    tierDescription: 'ĐTB học kỳ đạt loại Giỏi trở lên và cao hơn kỳ trước: 5.0 điểm.',
    isCapped: true,
  };

  // Mục 4: CLB học thuật / NCKH / Khởi nghiệp (Max 3.0 - Binary có tham gia là 3.0)
  const m4Count = getCountFor(['clb', 'học thuật', 'khởi nghiệp', 'đổi mới sáng tạo', 'nhóm nckh'], validEvidences);
  const m4Appr = getCountFor(['clb', 'học thuật', 'khởi nghiệp', 'đổi mới sáng tạo', 'nhóm nckh'], approvedEvidences);
  const crit4: CriterionProgress = {
    criterionId: 'crit-4',
    code: '4',
    name: 'Tham gia CLB học thuật, nhóm NCKH, Khởi nghiệp ĐMST',
    maxScore: 3,
    category: 'KHUNG_I',
    evidenceCount: m4Count,
    aiSuggestedScore: m4Count >= 1 ? 3 : 0,
    officialScore: m4Appr >= 1 ? 3 : 0,
    tierDescription: 'Có quyết định thành lập / xác nhận hợp lệ: Đạt trần 3.0 điểm (không cộng dồn thêm).',
    nextTierAdvice: m4Count === 0 ? 'Nộp quyết định/xác nhận tham gia CLB để nhận ngay 3.0 điểm' : undefined,
    isCapped: m4Count >= 1,
  };

  // Mục 5: Thành tích NCKH hoặc Olympic (Max 3.0 - Tham gia 2đ, Giải 3đ)
  const m5Count = getCountFor(['olympic', 'nghiên cứu khoa học', 'đề tài nckh', 'báo khoa học'], validEvidences);
  const m5Appr = getCountFor(['olympic', 'nghiên cứu khoa học', 'đề tài nckh', 'báo khoa học'], approvedEvidences);
  const crit5: CriterionProgress = {
    criterionId: 'crit-5',
    code: '5',
    name: 'Tham gia và đạt thành tích trong NCKH hoặc thi Olympic môn học',
    maxScore: 3,
    category: 'KHUNG_I',
    evidenceCount: m5Count,
    aiSuggestedScore: m5Count >= 1 ? 3 : 0,
    officialScore: m5Appr >= 1 ? 3 : 0,
    tierDescription: 'Tham gia không đạt giải: 2.0 điểm; Đạt từ giải Khuyến khích trở lên: 3.0 điểm.',
    nextTierAdvice: m5Count === 0 ? 'Tham gia kỳ thi Olympic hoặc đề tài NCKH để tích lũy tối đa 3.0 điểm' : undefined,
    isCapped: m5Count >= 1,
  };

  // 2. Khung II (Max 25)
  // Mục 6: Chấp hành chủ trương (Mặc định 5.0)
  const crit6: CriterionProgress = {
    criterionId: 'crit-6',
    code: '6',
    name: 'Chấp hành chủ trương, định hướng, phong trào của Đảng, Nhà nước và Trường',
    maxScore: 5,
    category: 'KHUNG_II',
    evidenceCount: 0,
    aiSuggestedScore: 5,
    officialScore: 5,
    tierDescription: 'Mặc định 5.0 điểm nếu không vi phạm các đợt phát động.',
    isCapped: true,
  };

  // Mục 7: Không vi phạm quy chế ĐHBK (Mặc định 15.0)
  const crit7: CriterionProgress = {
    criterionId: 'crit-7',
    code: '7',
    name: 'Không vi phạm quy chế, quy định, nội quy của Trường, Khoa, Lớp',
    maxScore: 15,
    category: 'KHUNG_II',
    evidenceCount: 0,
    aiSuggestedScore: 15,
    officialScore: 15,
    tierDescription: 'Mặc định 15.0 điểm. Bị trừ nếu nợ học phí, vắng SHCD, vắng họp lớp hoặc vi phạm kỷ luật.',
    isCapped: true,
  };

  // Mục 8: Hoạt động giáo dục chính trị, kỹ năng mềm (Max 5.0 - Binary >= 1 HĐ là 5đ)
  const m8Count = getCountFor(['kỹ năng mềm', 'tọa đàm', 'chính trị', 'sinh hoạt công dân', 'quy chế'], validEvidences);
  const m8Appr = getCountFor(['kỹ năng mềm', 'tọa đàm', 'chính trị', 'sinh hoạt công dân', 'quy chế'], approvedEvidences);
  const crit8: CriterionProgress = {
    criterionId: 'crit-8',
    code: '8',
    name: 'Tham gia hoạt động giáo dục chính trị, tư tưởng, kỹ năng mềm',
    maxScore: 5,
    category: 'KHUNG_II',
    evidenceCount: m8Count,
    aiSuggestedScore: m8Count >= 1 ? 5 : 5, // mặc định đợt đầu đã có SHCD
    officialScore: 5,
    tierDescription: 'Tham gia tối thiểu 1 hoạt động/kỳ: Đạt trần 5.0 điểm (không cộng dồn thêm).',
    isCapped: true,
  };

  // 3. Khung III (Max 20) - BẬC THANG RÕ RÀNG
  // Mục 9: Văn hóa, văn nghệ, thể thao (1 lần = 5đ, 2 lần = 7đ, >= 3 lần = 10đ; Cổ vũ = 50%)
  const m9Count = Math.max(1, getCountFor(['hội thao', 'văn nghệ', 'thể thao', 'giải bóng', 'dut games', 'tiếng hát'], validEvidences));
  const m9Appr = getCountFor(['hội thao', 'văn nghệ', 'thể thao', 'giải bóng', 'dut games', 'tiếng hát'], approvedEvidences);
  const calculateTier9 = (cnt: number) => {
    if (cnt <= 0) return 0;
    if (cnt === 1) return 5;
    if (cnt === 2) return 7;
    return 10; // >= 3 lần đạt trần 10 điểm
  };
  const crit9: CriterionProgress = {
    criterionId: 'crit-9',
    code: '9',
    name: 'Tham gia hoạt động văn hóa, văn nghệ, thể thao của Trường, Khoa, Lớp',
    maxScore: 10,
    category: 'KHUNG_III',
    evidenceCount: m9Count,
    aiSuggestedScore: calculateTier9(m9Count),
    officialScore: calculateTier9(m9Appr),
    tierDescription: 'Bậc thang: 1 lần = 5.0đ · 2 lần = 7.0đ · Từ 3 lần trở lên = 10.0đ (Cổ vũ: 50%). Trần: 10.0đ.',
    nextTierAdvice:
      m9Count === 1
        ? 'Bạn đang có 1 hoạt động (5.0đ). Tham gia thêm 1 hoạt động để lên mốc 7.0đ, hoặc 2 hoạt động để đạt trần 10.0đ.'
        : m9Count === 2
        ? 'Bạn đang có 2 hoạt động (7.0đ). Chỉ cần thêm 1 hoạt động nữa để đạt trần tối đa 10.0đ!'
        : 'Đã đạt trần tối đa 10.0 điểm cho tiêu chí này.',
    isCapped: m9Count >= 3,
  };

  // Mục 10: Tuyên truyền an ninh mạng, ATGT, phòng chống tệ nạn (1 lần = 5đ, 2 lần = 7đ, >= 3 lần = 10đ)
  const m10Count = Math.max(1, getCountFor(['tuyên truyền', 'an ninh mạng', 'an toàn giao thông', 'pháp luật', 'tệ nạn'], validEvidences));
  const m10Appr = getCountFor(['tuyên truyền', 'an ninh mạng', 'an toàn giao thông', 'pháp luật', 'tệ nạn'], approvedEvidences);
  const crit10: CriterionProgress = {
    criterionId: 'crit-10',
    code: '10',
    name: 'Tham gia hoạt động tuyên truyền chính trị, an toàn giao thông, an ninh mạng',
    maxScore: 10,
    category: 'KHUNG_III',
    evidenceCount: m10Count,
    aiSuggestedScore: calculateTier9(m10Count),
    officialScore: calculateTier9(m10Appr),
    tierDescription: 'Bậc thang: 1 lần = 5.0đ · 2 lần = 7.0đ · Từ 3 lần trở lên = 10.0đ. Trần: 10.0đ.',
    nextTierAdvice:
      m10Count === 1
        ? 'Bạn đang có 1 hoạt động (5.0đ). Cần thêm 1 hoạt động để lên 7.0đ, hoặc 2 hoạt động để đạt tối đa 10.0đ.'
        : m10Count === 2
        ? 'Bạn đang có 2 hoạt động (7.0đ). Cần thêm 1 hoạt động để chạm mốc tối đa 10.0đ!'
        : 'Đã đạt trần tối đa 10.0 điểm cho tiêu chí này.',
    isCapped: m10Count >= 3,
  };

  // 4. Khung IV (Max 25)
  // Mục 11: BHYT, tạm trú (Mặc định 10.0đ)
  const crit11: CriterionProgress = {
    criterionId: 'crit-11',
    code: '11',
    name: 'Ý thức chấp hành đường lối của Đảng, chính sách pháp luật của Nhà nước',
    maxScore: 10,
    category: 'KHUNG_IV',
    evidenceCount: 0,
    aiSuggestedScore: 10,
    officialScore: 10,
    tierDescription: 'Tham gia BHYT đầy đủ và đăng ký tạm trú đúng quy định: 10.0 điểm.',
    isCapped: true,
  };

  // Mục 12: Phục vụ cộng đồng (HĐPVCĐ), tình nguyện (1 HĐ >= 5đ quy đổi = 5đ; 2 HĐ >= 10đ quy đổi = 7đ; >= 3 HĐ >= 15đ quy đổi = 10đ)
  const m12Count = Math.max(1, getCountFor(['hiến máu', 'tình nguyện', 'tiếp sức mùa thi', 'mùa hè xanh', 'phục vụ cộng đồng', 'hdpvcđ'], validEvidences));
  const m12Appr = getCountFor(['hiến máu', 'tình nguyện', 'tiếp sức mùa thi', 'mùa hè xanh', 'phục vụ cộng đồng', 'hdpvcđ'], approvedEvidences);
  const crit12: CriterionProgress = {
    criterionId: 'crit-12',
    code: '12',
    name: 'Tham gia hoạt động phục vụ cộng đồng (HĐPVCĐ), công ích, tình nguyện',
    maxScore: 10,
    category: 'KHUNG_IV',
    evidenceCount: m12Count,
    aiSuggestedScore: calculateTier9(m12Count),
    officialScore: calculateTier9(m12Appr),
    tierDescription: 'Bậc thang quy đổi: ≥ 1 HĐ (≥ 5đ quy đổi) = 5.0đ · ≥ 2 HĐ (≥ 10đ quy đổi) = 7.0đ · ≥ 3 HĐ (≥ 15đ quy đổi) = 10.0đ. Trần: 10.0đ.',
    nextTierAdvice:
      m12Count === 1
        ? 'Bạn đang có 1 hoạt động (5.0đ). Cần thêm 1 hoạt động tình nguyện để lên 7.0đ, hoặc thêm 2 hoạt động để đạt trần 10.0đ.'
        : m12Count === 2
        ? 'Bạn đang có 2 hoạt động (7.0đ). Nộp thêm 1 minh chứng hiến máu/tình nguyện nữa để đạt trần tối đa 10.0đ!'
        : 'Đã đạt trần tối đa 10.0 điểm cho tiêu chí phục vụ cộng đồng.',
    isCapped: m12Count >= 3,
  };

  // Mục 13: Thành viên BTC, CTV sự kiện (Max 5.0đ - Binary)
  const m13Count = getCountFor(['ban tổ chức', 'cộng tác viên', 'tình nguyện viên hỗ trợ', 'hỗ trợ tổ chức'], validEvidences);
  const m13Appr = getCountFor(['ban tổ chức', 'cộng tác viên', 'tình nguyện viên hỗ trợ', 'hỗ trợ tổ chức'], approvedEvidences);
  const crit13: CriterionProgress = {
    criterionId: 'crit-13',
    code: '13',
    name: 'Thành viên Ban tổ chức, cộng tác viên sự kiện của Lớp, Khoa, Trường',
    maxScore: 5,
    category: 'KHUNG_IV',
    evidenceCount: m13Count,
    aiSuggestedScore: m13Count >= 1 ? 5 : 0,
    officialScore: m13Appr >= 1 ? 5 : 0,
    tierDescription: 'Có xác nhận hợp lệ của đơn vị tổ chức: Đạt trần 5.0 điểm (không cộng dồn thêm).',
    nextTierAdvice: m13Count === 0 ? 'Nộp giấy xác nhận Ban tổ chức/CTV sự kiện để nhận trọn 5.0 điểm' : undefined,
    isCapped: m13Count >= 1,
  };

  // 5. Khung V (Max 10) - Dành riêng cho Ban cán sự / Ban chấp hành
  const m14Count = getCountFor(['ban cán sự', 'lớp trưởng', 'bí thư', 'chi đoàn', 'hội sinh viên', 'chủ nhiệm clb'], validEvidences);
  const crit14: CriterionProgress = {
    criterionId: 'crit-14',
    code: '14',
    name: 'Thành viên Ban Cán sự lớp, BCH Đoàn, Hội, BCN CLB hoàn thành tốt nhiệm vụ',
    maxScore: 4,
    category: 'KHUNG_V',
    evidenceCount: m14Count,
    aiSuggestedScore: m14Count >= 1 ? 4 : 0,
    officialScore: 0,
    tierDescription: 'Được tập thể bình chọn (≥ 90%) và GVCN/Đoàn/Hội xác nhận đồng ý: 4.0 điểm.',
    isCapped: m14Count >= 1,
  };

  const crit15: CriterionProgress = {
    criterionId: 'crit-15',
    code: '15',
    name: 'Thành viên Ban Cán sự, Đoàn, Hội hoàn thành xuất sắc và được khen thưởng',
    maxScore: 3,
    category: 'KHUNG_V',
    evidenceCount: 0,
    aiSuggestedScore: 0,
    officialScore: 0,
    tierDescription: 'Có giấy khen, quyết định khen thưởng cán bộ xuất sắc: 3.0 điểm.',
    isCapped: false,
  };

  const crit16: CriterionProgress = {
    criterionId: 'crit-16',
    code: '16',
    name: 'Khen thưởng từ cấp Trường trở lên về học tập, rèn luyện, phong trào',
    maxScore: 3,
    category: 'KHUNG_V',
    evidenceCount: 0,
    aiSuggestedScore: 0,
    officialScore: 0,
    tierDescription: 'Quyết định khen thưởng xuất sắc toàn diện từ cấp Trường trở lên: 3.0 điểm.',
    isCapped: false,
  };

  const allCriteria = [
    crit1, crit2, crit3, crit4, crit5,
    crit6, crit7, crit8,
    crit9, crit10,
    crit11, crit12, crit13,
    crit14, crit15, crit16,
  ];

  // Tính tổng và áp trần theo từng Khung
  const sumCategory = (cat: 'KHUNG_I' | 'KHUNG_II' | 'KHUNG_III' | 'KHUNG_IV' | 'KHUNG_V', max: number, name: string): CategorySummary => {
    const items = allCriteria.filter((c) => c.category === cat);
    const rawAi = items.reduce((s, c) => s + c.aiSuggestedScore, 0);
    const rawOff = items.reduce((s, c) => s + c.officialScore, 0);
    return {
      category: cat,
      name,
      maxScore: max,
      aiScore: Math.min(max, rawAi),
      officialScore: Math.min(max, rawOff),
      isCapped: rawAi >= max,
    };
  };

  const categorySummaries: CategorySummary[] = [
    sumCategory('KHUNG_I', 20, 'Ý thức tham gia học tập'),
    sumCategory('KHUNG_II', 25, 'Ý thức chấp hành nội quy, quy chế, quy định'),
    sumCategory('KHUNG_III', 20, 'Ý thức tham gia các hoạt động chính trị, xã hội, phong trào'),
    sumCategory('KHUNG_IV', 25, 'Ý thức công dân trong quan hệ cộng đồng'),
    sumCategory('KHUNG_V', 10, 'Ý thức và kết quả khi tham gia công tác cán bộ lớp, đoàn thể'),
  ];

  const totalAiScore = categorySummaries.reduce((sum, c) => sum + c.aiScore, 0);
  const totalOfficialScore = categorySummaries.reduce((sum, c) => sum + c.officialScore, 0);

  return {
    allCriteria,
    categorySummaries,
    totalAiScore,
    totalOfficialScore,
  };
}
