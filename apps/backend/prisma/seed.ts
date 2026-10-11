import { PrismaClient, Role, TermStatus, ActivityType, EvidenceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu gieo dữ liệu hạt giống (Seeding database)...');

  // Mật khẩu mặc định
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const officerPasswordHash = await bcrypt.hash('Officer@123', 10);
  const studentPasswordHash = await bcrypt.hash('Student@123', 10);

  // 1. Khoa (Faculties)
  const facultyCNTT = await prisma.faculty.upsert({
    where: { code: 'CNTT' },
    update: {},
    create: {
      code: 'CNTT',
      name: 'Khoa Công nghệ Thông tin',
    },
  });

  const facultyKT = await prisma.faculty.upsert({
    where: { code: 'KT' },
    update: {},
    create: {
      code: 'KT',
      name: 'Khoa Quản lý Dự án & Kinh tế',
    },
  });

  const facultyDTVT = await prisma.faculty.upsert({
    where: { code: 'DTVT' },
    update: {},
    create: {
      code: 'DTVT',
      name: 'Khoa Điện tử - Viễn thông',
    },
  });

  console.log('✅ Đã tạo các Khoa:', [facultyCNTT.code, facultyKT.code, facultyDTVT.code]);

  // 2. Lớp học (Classes)
  const class21TCLC1 = await prisma.class.upsert({
    where: { code: '21TCLC_DT1' },
    update: {},
    create: {
      code: '21TCLC_DT1',
      name: '21TCLC ĐT1 - Kỹ thuật Phần mềm',
      cohort: 'K21',
      facultyId: facultyCNTT.id,
    },
  });

  const class21TCLC2 = await prisma.class.upsert({
    where: { code: '21TCLC_DT2' },
    update: {},
    create: {
      code: '21TCLC_DT2',
      name: '21TCLC ĐT2 - Trí tuệ Nhân tạo',
      cohort: 'K21',
      facultyId: facultyCNTT.id,
    },
  });

  console.log('✅ Đã tạo các Lớp:', [class21TCLC1.code, class21TCLC2.code]);

  // Dọn dẹp các user test cũ nếu có
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['sv.huyen@edupoint.edu.vn', 'staff.cntt@edupoint.edu.vn', 'admin@edupoint.edu.vn'],
      },
    },
  });

  // 3. Người dùng mẫu (Users)
  // Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dut.udn.vn' },
    update: { password: adminPasswordHash },
    create: {
      email: 'admin@dut.udn.vn',
      password: adminPasswordHash,
      fullName: 'Trần Văn Quản Trị',
      role: Role.ADMIN,
      isFirstLogin: false,
      isActive: true,
    },
  });

  // Officer Khoa CNTT
  const officerCNTT = await prisma.user.upsert({
    where: { email: 'officer.cntt@dut.udn.vn' },
    update: { password: officerPasswordHash },
    create: {
      email: 'officer.cntt@dut.udn.vn',
      password: officerPasswordHash,
      fullName: 'Nguyễn Văn Cán Bộ',
      role: Role.STAFF,
      facultyId: facultyCNTT.id,
      isFirstLogin: false,
      isActive: true,
    },
  });

  // Student 1 (Khoa CNTT, Lớp 21TCLC_DT1)
  const student1 = await prisma.user.upsert({
    where: { email: 'sv1.cntt@sv.dut.udn.vn' },
    update: { password: studentPasswordHash },
    create: {
      email: 'sv1.cntt@sv.dut.udn.vn',
      password: studentPasswordHash,
      fullName: 'Lê Văn Sinh Viên',
      studentCode: '102210001',
      role: Role.STUDENT,
      classId: class21TCLC1.id,
      isFirstLogin: false,
      isActive: true,
    },
  });

  // Student 2 (Khoa CNTT, Lớp 21TCLC_DT2)
  const student2 = await prisma.user.upsert({
    where: { email: 'sv2.cntt@sv.dut.udn.vn' },
    update: { password: studentPasswordHash },
    create: {
      email: 'sv2.cntt@sv.dut.udn.vn',
      password: studentPasswordHash,
      fullName: 'Hoàng Thị Hoa',
      studentCode: '102210002',
      role: Role.STUDENT,
      classId: class21TCLC2.id,
      isFirstLogin: false,
      isActive: true,
    },
  });

  console.log('✅ Đã tạo các Tài khoản Test:', [adminUser.email, officerCNTT.email, student1.email, student2.email]);

  // 4. Kỳ đánh giá (Terms)
  const termCurrent = await prisma.term.upsert({
    where: { code: '2026_1' },
    update: { status: TermStatus.ACTIVE },
    create: {
      code: '2026_1',
      name: 'Học kỳ 1 (2026-2027)',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-15'),
      submissionDeadline: new Date('2027-01-20'),
      reviewDeadline: new Date('2027-02-05'),
      appealDeadline: new Date('2027-02-15'),
      status: TermStatus.ACTIVE,
    },
  });

  const termPast = await prisma.term.upsert({
    where: { code: '2025_2' },
    update: { status: TermStatus.CLOSED },
    create: {
      code: '2025_2',
      name: 'Học kỳ 2 (2025-2026)',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-30'),
      submissionDeadline: new Date('2026-07-05'),
      reviewDeadline: new Date('2026-07-20'),
      appealDeadline: new Date('2026-07-30'),
      status: TermStatus.CLOSED,
    },
  });

  console.log('✅ Đã tạo các Kỳ đánh giá:', [termCurrent.code, termPast.code]);

  // 5. Cây 16 Tiêu chí ĐHBK Đà Nẵng (Khung I - V)
  const criteriaData = [
    // Khung I: Ý thức học tập (Max 20đ)
    {
      code: '1',
      name: 'Kết quả học tập',
      description: 'Điểm trung bình chung học tập trong kỳ (Xuất sắc: 10đ, Giỏi: 8đ, Khá: 6đ, TB: 4đ).',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_I',
    },
    {
      code: '2',
      name: 'Ý thức tham gia học tập, NCKH',
      description: 'Tham gia NCKH, viết bài báo hội thảo, sinh hoạt học thuật (Đề tài cấp trường/Bộ/thành phố).',
      minScore: 0.0,
      maxScore: 6.0,
      category: 'KHUNG_I',
    },
    {
      code: '3',
      name: 'Tham gia CLB, cuộc thi học thuật',
      description: 'Thành viên CLB học thuật, tham gia các cuộc thi tay nghề, Olympic, Robocon, Hackathon.',
      minScore: 0.0,
      maxScore: 4.0,
      category: 'KHUNG_I',
    },

    // Khung II: Chấp hành nội quy, quy chế (Max 25đ)
    {
      code: '4',
      name: 'Chấp hành nội quy, quy chế nhà trường',
      description: 'Chấp hành quy chế đào tạo, quy chế thi, không vi phạm kỷ luật của trường và khoa.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_II',
    },
    {
      code: '5',
      name: 'Chấp hành pháp luật, an toàn giao thông',
      description: 'Thực hiện nếp sống văn minh đô thị, không vi phạm luật giao thông và quy định pháp luật.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_II',
    },
    {
      code: '6',
      name: 'Đóng học phí và các khoản đúng hạn',
      description: 'Hoàn thành học phí, BHYT, bảo hiểm tai nạn và nghĩa vụ tài chính đúng thời hạn.',
      minScore: 0.0,
      maxScore: 5.0,
      category: 'KHUNG_II',
    },

    // Khung III: Hoạt động chính trị, XH, VH, TT (Max 20đ)
    {
      code: '7',
      name: 'Rèn luyện chính trị, tư tưởng',
      description: 'Tham gia học tập Nghị quyết, tuần lễ sinh hoạt công dân sinh viên đầu khóa/giữa khóa.',
      minScore: 0.0,
      maxScore: 8.0,
      category: 'KHUNG_III',
    },
    {
      code: '8',
      name: 'Hoạt động văn hóa, văn nghệ, thể thao',
      description: 'Tham gia hội diễn văn nghệ, giải bóng đá, hội thao truyền thống cấp Khoa/Trường/Đại học Đà Nẵng.',
      minScore: 0.0,
      maxScore: 8.0,
      category: 'KHUNG_III',
    },
    {
      code: '9',
      name: 'Phòng chống tệ nạn xã hội',
      description: 'Tham gia các buổi tuyên truyền phòng chống ma túy, an ninh mạng, giữ gìn môi trường học đường.',
      minScore: 0.0,
      maxScore: 4.0,
      category: 'KHUNG_III',
    },

    // Khung IV: Phẩm chất công dân, cộng đồng (Max 25đ)
    {
      code: '10',
      name: 'Chấp hành chủ trương tại nơi cư trú',
      description: 'Có giấy xác nhận sinh viên ngoại trú/nội trú chấp hành tốt nghĩa vụ công dân tại địa phương.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_IV',
    },
    {
      code: '11',
      name: 'Hoạt động tình nguyện, vì cộng đồng',
      description: 'Tham gia Chiến dịch Mùa hè xanh, Tiếp sức mùa thi, Hiến máu nhân đạo, Ngày Chủ nhật xanh.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_IV',
    },
    {
      code: '12',
      name: 'Tương thân tương ái, giúp đỡ bạn bè',
      description: 'Đóng góp ủng hộ quỹ khuyến học, quỹ đồng bào lũ lụt, đôi bạn cùng tiến giúp đỡ bạn học.',
      minScore: 0.0,
      maxScore: 3.0,
      category: 'KHUNG_IV',
    },
    {
      code: '13',
      name: 'Tuyên truyền chủ trương, chính sách',
      description: 'Tích cực tuyên truyền thông tin tích cực, lan tỏa hình ảnh đẹp của nhà trường trên mạng xã hội.',
      minScore: 0.0,
      maxScore: 2.0,
      category: 'KHUNG_IV',
    },

    // Khung V: Hoạt động lớp, đoàn thể (Max 10đ)
    {
      code: '14',
      name: 'Ban cán sự lớp, Đoàn, Hội',
      description: 'Đảm nhiệm chức vụ Lớp trưởng, Bí thư Chi đoàn, Ủy viên BCH Đoàn - Hội hoàn thành tốt nhiệm vụ.',
      minScore: 0.0,
      maxScore: 5.0,
      category: 'KHUNG_V',
    },
    {
      code: '15',
      name: 'Thành tích trong công tác lớp, đoàn thể',
      description: 'Được Đoàn trường, Hội sinh viên hoặc Ban giám hiệu tặng giấy khen cán bộ xuất sắc.',
      minScore: 0.0,
      maxScore: 3.0,
      category: 'KHUNG_V',
    },
    {
      code: '16',
      name: 'Hỗ trợ các hoạt động chung của Khoa/Trường',
      description: 'Tham gia ban tổ chức, hỗ trợ lễ khai giảng, ngày hội việc làm, hội nghị khoa học.',
      minScore: 0.0,
      maxScore: 2.0,
      category: 'KHUNG_V',
    },
  ];

  for (const c of criteriaData) {
    await prisma.criterion.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        description: c.description,
        maxScore: c.maxScore,
        category: c.category,
      },
      create: c,
    });
  }

  console.log(`✅ Đã tạo ${criteriaData.length} Tiêu chí ĐHBK Đà Nẵng (mã 1 - 16).`);

  // 6. Hoạt động mẫu nội bộ (Activities)
  const activity1 = await prisma.activity.create({
    data: {
      name: 'Ngày hội Hiến máu Nhân đạo ĐHBK 2026',
      type: ActivityType.INTERNAL,
      organizer: 'Đoàn Thanh niên - Hội Sinh viên',
      startDate: new Date('2026-10-15'),
      endDate: new Date('2026-10-16'),
      location: 'Hội trường khu F',
      description: 'Chương trình hiến máu tình nguyện vì sự sống người bệnh.',
    },
  });

  const activity2 = await prisma.activity.create({
    data: {
      name: 'Cuộc thi Lập trình BK Hackathon 2026',
      type: ActivityType.INTERNAL,
      organizer: 'Khoa Công nghệ Thông tin',
      startDate: new Date('2026-11-05'),
      endDate: new Date('2026-11-07'),
      location: 'Tòa nhà C',
      description: 'Cuộc thi sáng tạo sản phẩm công nghệ trong 48 giờ.',
    },
  });

  // Điểm danh hoạt động cho Student 1
  await prisma.activityParticipant.upsert({
    where: {
      activityId_studentId: {
        activityId: activity1.id,
        studentId: student1.id,
      },
    },
    update: {},
    create: {
      activityId: activity1.id,
      studentId: student1.id,
      formRole: 'THAM_GIA_CHINH',
      source: 'Import_HienMau_2026.xlsx',
    },
  });

  console.log('✅ Đã tạo các Hoạt động mẫu & Điểm danh cho SV1.');

  // 7. Tạo một số Hồ sơ minh chứng mẫu (Evidences)
  // Hồ sơ 1: Chờ duyệt (PENDING_HUMAN_REVIEW)
  const evidence1 = await prisma.evidence.create({
    data: {
      studentId: student1.id,
      termId: termCurrent.id,
      activityId: activity1.id,
      declaredActivityName: 'Ngày hội Hiến máu Nhân đạo ĐHBK 2026',
      declaredRole: 'THAM_GIA_CHINH',
      evidenceType: 'GIAY_XAC_NHAN',
      status: EvidenceStatus.NEEDS_HUMAN_REVIEW,
      participationDate: new Date('2026-10-15'),
      files: {
        create: [
          {
            fileUrl: 'https://placehold.co/800x600/png?text=Giay+Chung+Nhan+Hien+Mau',
            fileType: 'image/png',
          },
        ],
      },
    },
  });

  // Hồ sơ 2: Đã duyệt (APPROVED)
  const criterionHocTap = await prisma.criterion.findUnique({ where: { code: '1' } });
  const evidence2 = await prisma.evidence.create({
    data: {
      studentId: student1.id,
      termId: termCurrent.id,
      declaredActivityName: 'Bảng điểm rèn luyện và học tập xuất sắc',
      declaredRole: 'PARTICIPANT',
      evidenceType: 'BANG_DIEM',
      status: EvidenceStatus.APPROVED,
      participationDate: new Date('2026-09-20'),
      files: {
        create: [
          {
            fileUrl: 'https://placehold.co/800x600/png?text=Bang+Diem+Hoc+Tap',
            fileType: 'image/png',
          },
        ],
      },
      reviews: {
        create: [
          {
            reviewerId: officerCNTT.id,
            decision: 'APPROVED',
            criterionId: criterionHocTap?.id,
            finalScore: 10.0,
            reason: 'Đạt danh hiệu Sinh viên Giỏi kỳ trước, giấy tờ hợp lệ.',
          },
        ],
      },
    },
  });

  // Cập nhật điểm tích lũy cho Student 1
  await prisma.conductScore.upsert({
    where: {
      studentId_termId: {
        studentId: student1.id,
        termId: termCurrent.id,
      },
    },
    update: {
      totalScore: 10.0,
      classification: 'KHÁ',
    },
    create: {
      studentId: student1.id,
      termId: termCurrent.id,
      totalScore: 10.0,
      classification: 'KHÁ',
    },
  });

  console.log('✅ Đã tạo các Hồ sơ minh chứng mẫu cho SV1.');
  console.log('🎉 Hoàn tất gieo hạt giống dữ liệu!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi gieo dữ liệu hạt giống:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
