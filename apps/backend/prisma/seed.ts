import { PrismaClient, Role, TermStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu gieo dữ liệu hạt giống (Seeding database)...');

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

  // 3. Kỳ đánh giá (Terms)
  const termCurrent = await prisma.term.upsert({
    where: { code: '2024_1' },
    update: {},
    create: {
      code: '2024_1',
      name: 'Học kỳ 1 (2024-2025)',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-01-15'),
      submissionDeadline: new Date('2025-01-20'),
      reviewDeadline: new Date('2025-02-05'),
      appealDeadline: new Date('2025-02-15'),
      status: TermStatus.ACTIVE,
    },
  });

  const termPast = await prisma.term.upsert({
    where: { code: '2023_2' },
    update: {},
    create: {
      code: '2023_2',
      name: 'Học kỳ 2 (2023-2024)',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-06-30'),
      submissionDeadline: new Date('2024-07-05'),
      reviewDeadline: new Date('2024-07-20'),
      appealDeadline: new Date('2024-07-30'),
      status: TermStatus.CLOSED,
    },
  });

  console.log('✅ Đã tạo các Kỳ đánh giá:', [termCurrent.code, termPast.code]);

  // 4. Khung Tiêu chí (Criteria I - V)
  const criteriaData = [
    {
      code: '1.1',
      name: 'Ý thức và kết quả học tập',
      description: 'Đánh giá tinh thần học tập, kết quả điểm TBCTL và các chứng chỉ tin học/ngoại ngữ chuẩn đầu ra.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_I',
      rolesScore: { 'XUAT_SAC': 10.0, 'GIOI': 8.0, 'KHA': 6.0, 'TRUNG_BINH': 4.0 },
    },
    {
      code: '1.2',
      name: 'Nghiên cứu khoa học và thi học thuật',
      description: 'Tham gia đề tài NCKH các cấp, cuộc thi Robocon, Olympic, Hackathon, viết bài báo hội nghị.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_I',
      rolesScore: { 'GIAI_NHAT': 10.0, 'GIAI_NHI': 8.0, 'GIAI_BA': 6.0, 'THAM_GIA': 4.0 },
    },
    {
      code: '2.1',
      name: 'Chấp hành nội quy, quy chế nhà trường',
      description: 'Ý thức chấp hành các văn bản chỉ đạo của Bộ GD&ĐT, Nội quy sinh viên, không vi phạm kỷ luật.',
      minScore: 0.0,
      maxScore: 25.0,
      category: 'KHUNG_II',
      rolesScore: { 'KHONG_VI_PHAM': 25.0, 'NHAC_NHO': 15.0 },
    },
    {
      code: '3.1',
      name: 'Hoạt động văn hóa, văn nghệ, thể thao',
      description: 'Tham gia các giải bóng đá, hội diễn văn nghệ, ngày hội truyền thống cấp trường / cấp khoa.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_III',
      rolesScore: { 'BAN_TO_CHUC': 5.0, 'THAM_GIA_CHINH': 3.0, 'CO_VU': 1.0 },
    },
    {
      code: '4.1',
      name: 'Hoạt động tình nguyện và phục vụ cộng đồng',
      description: 'Tham gia Chiến dịch Mùa hè xanh, Tiếp sức mùa thi, Chủ nhật xanh, Dọn dẹp môi trường.',
      minScore: 0.0,
      maxScore: 15.0,
      category: 'KHUNG_IV',
      rolesScore: { 'TRUONG_DOAN': 10.0, 'TINH_NGUYEN_VIEN': 5.0 },
    },
    {
      code: '4.2',
      name: 'Hiến máu nhân đạo và tương thân tương ái',
      description: 'Tham gia hiến máu nhân đạo, quyên góp ủng hộ đồng bào vùng lũ lụt, hoàn cảnh khó khăn.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_IV',
      rolesScore: { 'HIEN_MAU': 5.0, 'QUYEN_GOP': 2.0 },
    },
    {
      code: '5.1',
      name: 'Phụ trách công tác tập thể, cán bộ lớp, đoàn hội',
      description: 'Đảm nhiệm vai trò Lớp trưởng, Bí thư Chi đoàn, Ban chấp hành Đoàn trường / Hội sinh viên.',
      minScore: 0.0,
      maxScore: 10.0,
      category: 'KHUNG_V',
      rolesScore: { 'LOP_TRUONG': 10.0, 'BI_THU': 10.0, 'CAN_SU': 6.0 },
    },
  ];

  for (const c of criteriaData) {
    await prisma.criterion.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  console.log(`✅ Đã tạo ${criteriaData.length} Tiêu chí khung I - V.`);

  // 5. Người dùng mẫu (Pre-provisioned Users)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edupoint.edu.vn' },
    update: {},
    create: {
      email: 'admin@edupoint.edu.vn',
      fullName: 'Quản trị viên Hệ thống',
      role: Role.ADMIN,
      isFirstLogin: false,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff.cntt@edupoint.edu.vn' },
    update: {},
    create: {
      email: 'staff.cntt@edupoint.edu.vn',
      fullName: 'Thầy Cán Bộ Quản Lý CNTT',
      role: Role.STAFF,
      facultyId: facultyCNTT.id,
      isFirstLogin: false,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'sv.huyen@edupoint.edu.vn' },
    update: {},
    create: {
      email: 'sv.huyen@edupoint.edu.vn',
      studentCode: '102210001',
      fullName: 'Nguyễn Thanh Huyền',
      role: Role.STUDENT,
      classId: class21TCLC1.id,
      isFirstLogin: false,
    },
  });

  console.log('✅ Đã tạo các Tài khoản mẫu:');
  console.log(`   - ADMIN:   ${admin.email} (${admin.fullName})`);
  console.log(`   - STAFF:   ${staff.email} (${staff.fullName}) - Khoa CNTT`);
  console.log(`   - STUDENT: ${student.email} (${student.fullName}) - MSSV: ${student.studentCode} - Lớp ${class21TCLC1.code}`);

  console.log('🎉 Hoàn tất gieo dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi gieo dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
