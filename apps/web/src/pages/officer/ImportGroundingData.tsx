import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { parseAcademicTier, parseBooleanVal, parseNonNegativeInteger } from '../../lib/groundingImportValues';
import {
  ImportBatchType,
  GroundingImportBatch,
  PreviewImportResult,
  Activity,
  Term,
} from '../../types';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  History,
  Loader2,
} from 'lucide-react';

export type GroundingCategory =
  | 'ACADEMIC_1'
  | 'ACADEMIC_3'
  | 'ACADEMIC_7'
  | 'ACTIVITY'
  | 'CLUB_LEADERSHIP';

const CATEGORY_CONFIGS: Record<
  GroundingCategory,
  {
    backendType: ImportBatchType;
    criterionCode?: string;
    title: string;
    desc: string;
    criteriaTag: string;
    templateFileName: string;
    sheetName: string;
  }
> = {
  ACADEMIC_1: {
    backendType: 'ACADEMIC',
    criterionCode: '1',
    title: 'TC1: Đi học đầy đủ & Chuyên cần',
    desc: 'Số học phần cấm thi, số lần nhắc nhở / không nghiêm túc trong giờ học',
    criteriaTag: 'Tiêu chí 1 (Tối đa 6đ)',
    templateFileName: 'Template_TC1_Chuyen_can.xlsx',
    sheetName: 'Can_cu_TC1',
  },
  ACADEMIC_3: {
    backendType: 'ACADEMIC',
    criterionCode: '3',
    title: 'TC3: Tinh thần phấn đấu trong học tập',
    desc: 'Xếp loại học tập (GPA), tiến bộ so với kỳ trước, diện cảnh báo học tập',
    criteriaTag: 'Tiêu chí 3 (Tối đa 5đ)',
    templateFileName: 'Template_TC3_Hoc_tap.xlsx',
    sheetName: 'Can_cu_TC3',
  },
  ACADEMIC_7: {
    backendType: 'ACADEMIC',
    criterionCode: '7',
    title: 'TC7: Chấp hành nội quy, quy chế',
    desc: 'Học phí, Tuần SHCD, vi phạm kỷ luật, khảo sát, khóa tài khoản, họp lớp',
    criteriaTag: 'Tiêu chí 7 (Tối đa 15đ)',
    templateFileName: 'Template_TC7_Noi_quy_Quy_che.xlsx',
    sheetName: 'Can_cu_TC7',
  },
  ACTIVITY: {
    backendType: 'ACTIVITY',
    title: 'Hoạt động & Sự kiện ngoại khóa',
    desc: 'Danh sách sinh viên tham gia, tình nguyện viên, ban tổ chức, cổ vũ',
    criteriaTag: 'TC8, TC9, TC10, TC12',
    templateFileName: 'Template_Diem_danh_Hoat_dong.xlsx',
    sheetName: 'Diem_danh_hoat_dong',
  },
  CLUB_LEADERSHIP: {
    backendType: 'CLUB_LEADERSHIP',
    title: 'Ban cán sự lớp & Ban chủ nhiệm CLB',
    desc: 'Xác nhận chức vụ cán bộ lớp, Đoàn - Hội, Ban chủ nhiệm CLB / Đội / Nhóm',
    criteriaTag: 'TC4, TC13',
    templateFileName: 'Template_Can_cu_Can_bo_CLB.xlsx',
    sheetName: 'Can_cu_CLB_Can_bo',
  },
};

export const ImportGroundingData: React.FC = () => {
  const { activeTerm, terms } = useAuth();
  const [params] = useSearchParams();
  const termId = params.get('termId') || activeTerm?.id || '';
  const currentTerm = terms.find((term) => term.id === termId) ?? (activeTerm?.id === termId ? activeTerm : undefined);
  return <ImportGroundingWorkspace key={termId} termId={termId} currentTerm={currentTerm} />;
};

type ImportContext = {
  termId: string;
  category: GroundingCategory;
  activityId?: string;
  file: File;
  idempotencyKey: string;
};

function ImportGroundingWorkspace({ termId, currentTerm }: { termId: string; currentTerm?: Term }) {
  // Tab: 'NEW_IMPORT' | 'BATCH_HISTORY'
  const [activeTab, setActiveTab] = useState<'NEW_IMPORT' | 'BATCH_HISTORY'>('NEW_IMPORT');

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<GroundingCategory>('ACADEMIC_1');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  // Preview & Confirm State
  const currentImport = useRef<ImportContext | null>(null);
  const [previewSession, setPreviewSession] = useState<{
    context: ImportContext;
    rows: Record<string, unknown>[];
    result: PreviewImportResult;
  } | null>(null);
  const previewResult = previewSession?.result;
  const [rowStatusFilter, setRowStatusFilter] = useState<'ALL' | 'VALID' | 'ERROR' | 'SKIPPED'>('ALL');
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Batches History State
  const [batches, setBatches] = useState<GroundingImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<GroundingImportBatch | null>(null);
  const [loadingBatchDetails, setLoadingBatchDetails] = useState<boolean>(false);

  // Revoke Batch Dialog
  const [revokingBatch, setRevokingBatch] = useState<GroundingImportBatch | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [revokeError, setRevokeError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => () => { currentImport.current = null; }, []);

  const resetPreview = () => {
    currentImport.current = null;
    setPreviewSession(null);
    setFileName('');
    setRowStatusFilter('ALL');
    setIsPreviewing(false);
    setIsConfirming(false);
    setErrorMsg('');
    setSuccessMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Tải danh sách hoạt động khi chọn ACTIVITY
  useEffect(() => {
    let cancelled = false;
    if (selectedCategory === 'ACTIVITY' && termId) {
      apiClient
        .getActivities({ termId })
        .then((data) => {
          if (cancelled) return;
          setActivities(data || []);
          setSelectedActivityId(current => data?.some(activity => activity.id === current) ? current : data?.[0]?.id ?? '');
        })
        .catch(() => { if (!cancelled) setActivities([]); });
    }
    return () => { cancelled = true; };
  }, [selectedCategory, termId]);

  // Tải danh sách lô đã nhập
  const loadBatches = async () => {
    if (!termId) return;
    setLoadingBatches(true);
    try {
      const data = await apiClient.listGroundingBatches(termId);
      setBatches(data || []);
    } catch (err: any) {
      console.error('Lỗi tải danh sách lô căn cứ:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'BATCH_HISTORY') {
      void loadBatches();
    }
  }, [activeTab, termId]);

  // Helper chuẩn hóa vai trò hoạt động
  const parseActivityRoleVal = (val: any): string => {
    if (!val) return 'THAM_GIA_CHINH';
    const str = String(val).trim().toUpperCase();
    if (['BAN_TO_CHUC', 'BTC', 'ORGANIZER', 'BAN TỔ CHỨC'].includes(str)) return 'BAN_TO_CHUC';
    if (['TINH_NGUYEN', 'TNV', 'VOLUNTEER', 'TÌNH NGUYỆN VIÊN'].includes(str)) return 'TINH_NGUYEN';
    if (['CO_VU', 'CHEERLEADER', 'CỔ VŨ'].includes(str)) return 'CO_VU';
    if (['HO_TRO', 'SUPPORT', 'HỖ TRỢ'].includes(str)) return 'HO_TRO';
    if (['THAM_GIA', 'THAM_GIA_CHINH', 'PARTICIPANT'].includes(str)) return 'THAM_GIA_CHINH';
    return str;
  };

  // Tạo và tải template Excel mẫu theo danh mục
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const config = CATEGORY_CONFIGS[selectedCategory];

    if (selectedCategory === 'ACADEMIC_1') {
      const data = [
        {
          MSSV: '102210001',
          Ho_va_ten: 'Nguyễn Văn An (Tùy chọn)',
          So_hoc_phan_cam_thi: 0,
          So_lan_nhac_nho: 0,
          Ghi_chu: 'Đi học nghiêm túc đầy đủ',
        },
        {
          MSSV: '102210002',
          Ho_va_ten: 'Trần Thị Bình (Tùy chọn)',
          So_hoc_phan_cam_thi: 1,
          So_lan_nhac_nho: 2,
          Ghi_chu: 'Cấm thi 1 môn Toán rời rạc, nhắc nhở 2 lần',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
      XLSX.writeFile(wb, config.templateFileName);
    } else if (selectedCategory === 'ACADEMIC_3') {
      const data = [
        {
          MSSV: '102210001',
          Ho_va_ten: 'Nguyễn Văn An (Tùy chọn)',
          Xep_loai_hoc_tap: 'GIOI',
          Tien_bo_so_voi_ky_truoc: 'CO',
          Canh_bao_hoc_tap: 'KHONG',
          Ghi_chu: 'GPA 3.42, cao hơn kỳ trước',
        },
        {
          MSSV: '102210002',
          Ho_va_ten: 'Trần Thị Bình (Tùy chọn)',
          Xep_loai_hoc_tap: 'TRUNG_BINH',
          Tien_bo_so_voi_ky_truoc: 'KHONG',
          Canh_bao_hoc_tap: 'KHONG',
          Ghi_chu: 'GPA 2.30',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
      XLSX.writeFile(wb, config.templateFileName);
    } else if (selectedCategory === 'ACADEMIC_7') {
      const data = [
        {
          MSSV: '102210001',
          Ho_va_ten: 'Nguyễn Văn An (Tùy chọn)',
          Nop_hoc_phi_dung_han: 'CO',
          Tham_gia_tuan_SHCD: 'CO',
          Vi_pham_ky_luat: 'KHONG',
          Tham_gia_khao_sat: 'CO',
          Khoa_tai_khoan_ngoai_y_muon: 0,
          Khong_hoan_thanh_viec_lop: 0,
          Vang_hop_lop_khong_phep: 0,
          Vang_hop_lop_co_phep: 0,
          Ghi_chu: 'Chấp hành đầy đủ nội quy',
        },
        {
          MSSV: '102210002',
          Ho_va_ten: 'Trần Thị Bình (Tùy chọn)',
          Nop_hoc_phi_dung_han: 'KHONG',
          Tham_gia_tuan_SHCD: 'CO',
          Vi_pham_ky_luat: 'KHONG',
          Tham_gia_khao_sat: 'CO',
          Khoa_tai_khoan_ngoai_y_muon: 1,
          Khong_hoan_thanh_viec_lop: 1,
          Vang_hop_lop_khong_phep: 1,
          Vang_hop_lop_co_phep: 0,
          Ghi_chu: 'Nợ học phí, vắng họp lớp không phép',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
      XLSX.writeFile(wb, config.templateFileName);
    } else if (selectedCategory === 'ACTIVITY') {
      const data = [
        {
          MSSV: '102210001',
          Ho_va_ten: 'Nguyễn Văn An (Tùy chọn)',
          Vai_tro: 'THAM_GIA_CHINH',
          Ghi_chu: 'Quét mã QR điểm danh tại hội trường',
        },
        {
          MSSV: '102210002',
          Ho_va_ten: 'Trần Thị Bình (Tùy chọn)',
          Vai_tro: 'BAN_TO_CHUC',
          Ghi_chu: 'Điều phối viên chương trình',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
      XLSX.writeFile(wb, config.templateFileName);
    } else {
      const data = [
        {
          MSSV: '102210001',
          Ho_va_ten: 'Nguyễn Văn An (Tùy chọn)',
          Ma_tieu_chi: '4',
          Ten_to_chuc: 'CLB Tin học DUT',
          Chuc_vu_vai_tro: 'Thành viên chính thức',
          Can_cu_minh_chung: 'Quyết định số 12/QĐ-ĐTN',
          Ghi_chu: 'Tham gia sinh hoạt định kỳ',
        },
        {
          MSSV: '102210002',
          Ho_va_ten: 'Trần Thị Bình (Tùy chọn)',
          Ma_tieu_chi: '13',
          Ten_to_chuc: 'Ban tổ chức Lễ Khai giảng',
          Chuc_vu_vai_tro: 'Cộng tác viên hậu cần',
          Can_cu_minh_chung: 'Giấy chứng nhận số 45/GCN-ĐHĐN',
          Ghi_chu: 'Hỗ trợ tổ chức sự kiện',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
      XLSX.writeFile(wb, config.templateFileName);
    }
  };

  // Xử lý khi người dùng chọn file Excel / CSV
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !termId) return;

    const context = {
      termId,
      category: selectedCategory,
      activityId: selectedCategory === 'ACTIVITY' ? selectedActivityId : undefined,
      file,
      idempotencyKey: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    currentImport.current = context;
    setPreviewSession(null);
    setRowStatusFilter('ALL');
    setErrorMsg('');
    setSuccessMsg('');
    setFileName(file.name);
    setIsPreviewing(true);

    try {
      const buffer = await file.arrayBuffer();
      if (currentImport.current !== context) return;
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        throw new Error('Tệp không có dữ liệu hoặc bảng tính bị trống.');
      }

      // Map dữ liệu theo từng danh mục
      const mappedRows: Record<string, unknown>[] = [];
      const config = CATEGORY_CONFIGS[context.category];

      for (const row of jsonData) {
        const studentCode = String(
          row['MSSV'] ?? row['mssv'] ?? row['StudentCode'] ?? row['studentCode'] ?? ''
        ).trim();

        const note = String(row['Ghi_chu'] ?? row['ghiChu'] ?? row['note'] ?? '').trim();

        if (context.category === 'ACADEMIC_1') {
          mappedRows.push({
            studentCode,
            criterionCode: '1',
            data: {
              examBans: parseNonNegativeInteger(row['So_hoc_phan_cam_thi'] ?? row['examBans']),
              classWarnings: parseNonNegativeInteger(row['So_lan_nhac_nho'] ?? row['classWarnings']),
            },
            source: file.name,
            note: note || undefined,
          });
        } else if (context.category === 'ACADEMIC_3') {
          mappedRows.push({
            studentCode,
            criterionCode: '3',
            data: {
              academicTier: parseAcademicTier(row['Xep_loai_hoc_tap'] ?? row['academicTier']),
              improvedFromPreviousTerm: parseBooleanVal(row['Tien_bo_so_voi_ky_truoc'] ?? row['improvedFromPreviousTerm']),
              academicWarning: parseBooleanVal(row['Canh_bao_hoc_tap'] ?? row['academicWarning']),
            },
            source: file.name,
            note: note || undefined,
          });
        } else if (context.category === 'ACADEMIC_7') {
          mappedRows.push({
            studentCode,
            criterionCode: '7',
            data: {
              tuitionCompliance: parseBooleanVal(row['Nop_hoc_phi_dung_han'] ?? row['tuitionCompliance']),
              studentWeekParticipation: parseBooleanVal(row['Tham_gia_tuan_SHCD'] ?? row['studentWeekParticipation']),
              disciplinaryViolation: parseBooleanVal(row['Vi_pham_ky_luat'] ?? row['disciplinaryViolation']),
              requiredSurveyParticipation: parseBooleanVal(row['Tham_gia_khao_sat'] ?? row['requiredSurveyParticipation']),
              nonCauseAccountLocks: parseNonNegativeInteger(row['Khoa_tai_khoan_ngoai_y_muon'] ?? row['nonCauseAccountLocks']),
              classTaskFailures: parseNonNegativeInteger(row['Khong_hoan_thanh_viec_lop'] ?? row['classTaskFailures']),
              unexcusedClassMeetingAbsences: parseNonNegativeInteger(row['Vang_hop_lop_khong_phep'] ?? row['unexcusedClassMeetingAbsences']),
              excusedClassMeetingAbsences: parseNonNegativeInteger(row['Vang_hop_lop_co_phep'] ?? row['excusedClassMeetingAbsences']),
            },
            source: file.name,
            note: note || undefined,
          });
        } else if (context.category === 'ACTIVITY') {
          mappedRows.push({
            studentCode,
            role: parseActivityRoleVal(row['Vai_tro'] ?? row['role']),
            note: note || undefined,
          });
        } else {
          const criterionCode = String(row['Ma_tieu_chi'] ?? row['criterionCode'] ?? '4').trim();
          const orgName = String(row['Ten_to_chuc'] ?? row['organizationName'] ?? '').trim();
          const roleTitle = String(row['Chuc_vu_vai_tro'] ?? row['roleTitle'] ?? '').trim();
          const sourceText = String(row['Can_cu_minh_chung'] ?? row['source'] ?? file.name).trim();

          mappedRows.push({
            studentCode,
            criterionCode,
            organizationName: orgName,
            roleTitle,
            source: sourceText,
            note: note || undefined,
          });
        }
      }

      // Gọi API Preview kiểm tra in-memory
      const preview = await apiClient.previewGroundingImport({
        termId: context.termId,
        type: config.backendType,
        rows: mappedRows,
        source: context.file.name,
        activityId: context.activityId,
      });

      if (currentImport.current !== context) return;
      if (preview.termId !== context.termId) throw new Error('Kết quả xem trước không thuộc kỳ đã chọn. Hãy xem trước lại tệp.');
      setPreviewSession({ context, rows: mappedRows, result: preview });
    } catch (err: any) {
      if (currentImport.current !== context) return;
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi khi đọc file và kiểm tra dữ liệu.');
    } finally {
      if (currentImport.current === context) setIsPreviewing(false);
    }
  };

  // Xác nhận nhập dữ liệu (Confirm)
  const handleConfirmImport = async () => {
    if (!previewSession || isConfirming) return;
    const { context, rows, result } = previewSession;
    const validCount = previewResult?.validCount ?? previewResult?.validRows ?? 0;
    if (!validCount || currentImport.current !== context || context.termId !== termId
      || context.category !== selectedCategory
      || (context.category === 'ACTIVITY' && context.activityId !== selectedActivityId)) return;

    setIsConfirming(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.confirmGroundingImport({
        termId: context.termId,
        previewTermId: result.termId,
        type: CATEGORY_CONFIGS[context.category].backendType,
        rows,
        source: context.file.name,
        idempotencyKey: context.idempotencyKey,
        activityId: context.activityId,
      });

      if (currentImport.current !== context) return;
      resetPreview();
      const count = res.validRows || res.recordCount || validCount;
      setSuccessMsg(
        `Đã nhập thành công lô căn cứ ${res.batchId} (${count} dòng hợp lệ). Điểm gợi ý đã được đồng bộ vào phiếu đánh giá của sinh viên.`
      );

      // Chuyển sang xem lịch sử lô
      setActiveTab('BATCH_HISTORY');
    } catch (err: any) {
      if (currentImport.current !== context) return;
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi khi xác nhận lưu lô căn cứ.');
    } finally {
      if (currentImport.current === context) setIsConfirming(false);
    }
  };

  // Xem chi tiết dòng trong lô
  const handleViewBatchDetails = async (batchId: string) => {
    setLoadingBatchDetails(true);
    try {
      const details = await apiClient.getGroundingBatch(batchId);
      setSelectedBatchDetails(details);
    } catch (err: any) {
      window.alert(err.response?.data?.message || 'Không thể tải chi tiết lô.');
    } finally {
      setLoadingBatchDetails(false);
    }
  };

  // Thu hồi lô
  const handleConfirmRevoke = async () => {
    if (!revokingBatch || revokeReason.trim().length < 5) return;

    setIsRevoking(true);
    setRevokeError('');

    try {
      await apiClient.revokeGroundingBatch(revokingBatch.id, {
        reason: revokeReason.trim(),
      });

      setRevokingBatch(null);
      setRevokeReason('');
      void loadBatches();
      window.alert('Đã thu hồi lô thành công. Điểm gợi ý liên quan đã được tính toán lại.');
    } catch (err: any) {
      setRevokeError(err.response?.data?.message || err.message || 'Không thể thu hồi lô căn cứ.');
    } finally {
      setIsRevoking(false);
    }
  };

  const previewItems = useMemo(() => {
    if (!previewResult) return [];
    return previewResult.previewItems || (previewResult.rows as any[]) || [];
  }, [previewResult]);

  const filteredPreviewRows = useMemo(() => {
    if (rowStatusFilter === 'ALL') return previewItems;
    return previewItems.filter((r) => r.status === rowStatusFilter);
  }, [previewItems, rowStatusFilter]);

  const validCount = previewResult?.validCount ?? previewResult?.validRows ?? 0;
  const errorCount = previewResult?.errorCount ?? previewResult?.errorRows ?? 0;
  const skippedCount = previewResult?.skippedCount ?? previewResult?.ignoredRows ?? 0;
  const canCommit = previewResult?.canCommit ?? (validCount > 0);

  const workflowEnabled = currentTerm?.evidenceBasisWorkflowEnabled ?? false;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E8EC] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#0A0A0A] tracking-tight">
              Căn cứ chấm điểm & Nhập dữ liệu
            </h1>
            {workflowEnabled ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Quy trình căn cứ mới
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                Quy trình truyền thống
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#6B6B6B]">
            Nhập kết quả học tập, vi phạm nội quy, danh sách hoạt động và ban cán sự để tự động xác minh tiêu chí và gợi ý điểm cho sinh viên.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-[#E8E8EC] bg-[#FAFAFA] p-1">
          <button
            onClick={() => setActiveTab('NEW_IMPORT')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'NEW_IMPORT'
                ? 'bg-white text-[#1D6FC2] shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#0A0A0A]'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Nhập căn cứ mới
          </button>
          <button
            onClick={() => setActiveTab('BATCH_HISTORY')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'BATCH_HISTORY'
                ? 'bg-white text-[#1D6FC2] shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#0A0A0A]'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử các lô đã nhập
          </button>
        </div>
      </header>

      {/* Thông báo lỗi & thành công */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: NHẬP CĂN CỨ MỚI */}
      {activeTab === 'NEW_IMPORT' && (
        <div className="space-y-6">
          {/* Card Bước 1: Chọn nguồn căn cứ */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold font-heading text-[#0A0A0A] flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FC2] text-[11px] font-bold text-white">
                1
              </span>
              Chọn danh mục căn cứ cần nhập dữ liệu
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(CATEGORY_CONFIGS) as GroundingCategory[]).map((cat) => {
                const info = CATEGORY_CONFIGS[cat];
                const isSelected = selectedCategory === cat;
                return (
                  <div
                    key={cat}
                    onClick={() => {
                      if (cat === selectedCategory) return;
                      resetPreview();
                      setSelectedCategory(cat);
                    }}
                    className={`cursor-pointer rounded-xl border p-4 transition text-left flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#1D6FC2] bg-blue-50/40 ring-1 ring-[#1D6FC2]'
                        : 'border-[#E8E8EC] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-heading text-[#0A0A0A]">{info.title}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-[#1D6FC2]" />}
                      </div>
                      <p className="mt-1 text-[11px] text-[#6B6B6B]">{info.desc}</p>
                    </div>
                    <div className="mt-3 border-t border-[#E8E8EC] pt-2">
                      <span className="text-[10px] font-semibold text-[#1D6FC2] block">{info.criteriaTag}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chọn Hoạt động khi category === 'ACTIVITY' */}
            {selectedCategory === 'ACTIVITY' && (
              <div className="mt-4 rounded-lg bg-[#FAFAFA] p-3 border border-[#E8E8EC] space-y-2">
                <label className="text-xs font-semibold text-[#0A0A0A] block">
                  Chọn hoạt động trong kỳ để gắn danh sách điểm danh *
                </label>
                {activities.length > 0 ? (
                  <select
                    value={selectedActivityId}
                    onChange={(e) => {
                      resetPreview();
                      setSelectedActivityId(e.target.value);
                    }}
                    className="w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2 text-xs font-medium text-[#0A0A0A] focus:border-[#1D6FC2] focus:outline-none"
                  >
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.name} {act.startDate ? `(${new Date(act.startDate).toLocaleDateString('vi-VN')})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-700">
                    Khoa chưa có hoạt động nào trong kỳ này. Hãy tạo hoạt động trước trong mục "Hoạt động & điểm danh".
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Card Bước 2: Tải file mẫu và Tải lên */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold font-heading text-[#0A0A0A] flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FC2] text-[11px] font-bold text-white">
                2
              </span>
              Tải file mẫu Excel chuẩn & Tải lên dữ liệu
            </h2>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C2DBF2] bg-[#F0F6FC] px-4 py-2 text-xs font-semibold text-[#1D6FC2] hover:bg-[#E1EDF9] transition"
              >
                <Download className="h-4 w-4" />
                Tải file mẫu Excel ({CATEGORY_CONFIGS[selectedCategory].templateFileName})
              </button>

              <label className="inline-flex items-center gap-2 rounded-lg bg-[#1D6FC2] hover:bg-[#175A9E] px-4 py-2 text-xs font-semibold text-white cursor-pointer transition shadow-2xs">
                <UploadCloud className="h-4 w-4" />
                {isPreviewing ? 'Đang đọc và kiểm tra...' : 'Chọn file Excel để tải lên'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  disabled={!termId || isConfirming || (selectedCategory === 'ACTIVITY' && !selectedActivityId)}
                  className="hidden"
                />
              </label>

              {fileName && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {fileName}
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#6B6B6B]">
              * Hệ thống tự động kiểm tra định dạng và dữ liệu từng dòng. Ô trống hoặc thiếu dữ liệu được giữ trạng thái "Chờ xác minh", tuyệt đối không tự ép kiểu thành 0 điểm hay vi phạm.
            </p>
          </section>

          {/* Card Bước 3: Xem trước kết quả kiểm tra (Preview) */}
          {previewResult && (
            <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8EC] pb-3">
                <div>
                  <h2 className="text-sm font-bold font-heading text-[#0A0A0A] flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FC2] text-[11px] font-bold text-white">
                      3
                    </span>
                    Kết quả kiểm tra dữ liệu trước khi nhập (Preview)
                  </h2>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    Hệ thống sẽ chỉ commit các dòng hợp lệ. Các dòng có lỗi sẽ bị bỏ qua an toàn.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isConfirming || !canCommit || validCount === 0}
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition shadow-2xs"
                  >
                    {isConfirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Xác nhận nhập {validCount} dòng hợp lệ
                  </button>
                </div>
              </div>

              {/* Thống kê dòng */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <span className="text-[11px] text-slate-500 font-medium block">Tổng số dòng đọc được</span>
                  <span className="text-lg font-bold text-slate-900">{previewResult.totalRows}</span>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <span className="text-[11px] text-emerald-700 font-medium block">Hợp lệ & Sẵn sàng</span>
                  <span className="text-lg font-bold text-emerald-800">{validCount}</span>
                </div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <span className="text-[11px] text-rose-700 font-medium block">Lỗi (sẽ bị bỏ qua)</span>
                  <span className="text-lg font-bold text-rose-800">{errorCount}</span>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <span className="text-[11px] text-amber-700 font-medium block">Bỏ qua / Đã có</span>
                  <span className="text-lg font-bold text-amber-800">{skippedCount}</span>
                </div>
              </div>

              {/* Bộ lọc trạng thái dòng */}
              <div className="flex items-center gap-2">
                {(['ALL', 'VALID', 'ERROR', 'SKIPPED'] as const).map((filter) => {
                  const labels = {
                    ALL: `Tất cả (${previewItems.length})`,
                    VALID: `Hợp lệ (${validCount})`,
                    ERROR: `Có lỗi (${errorCount})`,
                    SKIPPED: `Bỏ qua (${skippedCount})`,
                  };
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRowStatusFilter(filter)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        rowStatusFilter === filter
                          ? 'bg-[#1D6FC2] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {labels[filter]}
                    </button>
                  );
                })}
              </div>

              {/* Bảng chi tiết từng dòng */}
              <div className="overflow-x-auto max-h-[350px] border border-[#E8E8EC] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] text-[11px] font-bold text-[#475569] uppercase border-b border-[#E8E8EC] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">STT</th>
                      <th className="px-3 py-2">MSSV</th>
                      <th className="px-3 py-2">Họ tên sinh viên</th>
                      <th className="px-3 py-2">Tiêu chí</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2">Chi tiết lý do / Nội dung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8EC]">
                    {filteredPreviewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-center text-slate-500 font-mono">{row.rowIndex}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{row.studentCode}</td>
                        <td className="px-3 py-2 text-slate-700">{row.fullName || (row as any).studentName || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-[#1D6FC2]">
                          {row.criterionCode ? `TC${row.criterionCode}` : 'Hoạt động'}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === 'VALID' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                            </span>
                          )}
                          {row.status === 'ERROR' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              <XCircle className="h-3 w-3" /> Lỗi
                            </span>
                          )}
                          {(row.status === 'SKIPPED' || (row as any).status === 'IGNORED') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                              <AlertCircle className="h-3 w-3" /> Bỏ qua
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.reason ? (
                            <span className={row.status === 'ERROR' ? 'text-rose-700 font-medium' : 'text-slate-600'}>
                              {row.reason}
                            </span>
                          ) : (
                            <span className="text-slate-400">Đầy đủ căn cứ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: LỊCH SỬ CÁC LÔ ĐÃ NHẬP */}
      {activeTab === 'BATCH_HISTORY' && (
        <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
            <div>
              <h2 className="text-sm font-bold font-heading text-[#0A0A0A]">
                Danh sách các lô căn cứ trong kỳ
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                Theo dõi lịch sử nhập, số lượng bản ghi và thực hiện thu hồi lô khi có sai sót dữ liệu.
              </p>
            </div>
            <button
              type="button"
              onClick={loadBatches}
              disabled={loadingBatches}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8EC] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loadingBatches ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>

          {loadingBatches ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1D6FC2] mb-2" />
              Đang tải danh sách lô căn cứ...
            </div>
          ) : batches.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Chưa có lô căn cứ nào được nhập trong kỳ này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] text-[11px] font-bold text-[#475569] uppercase border-b border-[#E8E8EC]">
                  <tr>
                    <th className="px-3 py-2.5">Mã lô</th>
                    <th className="px-3 py-2.5">Loại căn cứ</th>
                    <th className="px-3 py-2.5">Nội dung / Nguồn</th>
                    <th className="px-3 py-2.5 text-center">Số bản ghi</th>
                    <th className="px-3 py-2.5">Người nhập</th>
                    <th className="px-3 py-2.5">Ngày nhập</th>
                    <th className="px-3 py-2.5 text-center">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {batches.map((batch) => {
                    const isRevoked = batch.status === 'REVOKED';
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono text-[11px] font-semibold text-slate-800">
                          {batch.id.substring(0, 8)}…
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-slate-900 block">
                            {batch.type === 'ACADEMIC'
                              ? 'Học vụ & Kỷ luật'
                              : batch.type === 'ACTIVITY'
                              ? 'Điểm danh hoạt động'
                              : 'Ban cán sự / CLB'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {batch.activity?.name ? (
                            <span className="font-medium text-[#1D6FC2]">{batch.activity.name}</span>
                          ) : (
                            batch.source || 'File tải lên'
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-slate-900">
                          {batch.validRows ?? batch.recordCount ?? 0}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {batch.creator?.fullName || 'Cán bộ Khoa'}
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {new Date(batch.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {isRevoked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                              <XCircle className="h-3 w-3" /> Đã thu hồi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Có hiệu lực
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewBatchDetails(batch.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              <Eye className="h-3.5 w-3.5" /> Chi tiết
                            </button>
                            {!isRevoked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokingBatch(batch);
                                  setRevokeReason('');
                                  setRevokeError('');
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition"
                              >
                                Thu hồi lô
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal Xem chi tiết lô */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Chi tiết lô căn cứ: {selectedBatchDetails.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Loại: {selectedBatchDetails.type} · {selectedBatchDetails.validRows ?? selectedBatchDetails.recordCount ?? 0} bản ghi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Nguồn dữ liệu:</span>
                  <span className="font-semibold text-slate-800">{selectedBatchDetails.source || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Người nhập:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedBatchDetails.creator?.fullName || selectedBatchDetails.importedBy?.fullName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ngày nhập:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedBatchDetails.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Trạng thái:</span>
                  <span className="font-semibold text-slate-800">{selectedBatchDetails.status}</span>
                </div>
              </div>

              {selectedBatchDetails.status === 'REVOKED' && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 space-y-1 text-rose-800">
                  <div className="font-semibold">Lô đã bị thu hồi:</div>
                  <div>Lý do: {selectedBatchDetails.revokeReason || '—'}</div>
                  <div className="text-[11px] text-rose-600">
                    Thu hồi lúc: {selectedBatchDetails.revokedAt ? new Date(selectedBatchDetails.revokedAt).toLocaleString('vi-VN') : '—'}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thu hồi lô */}
      {revokingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertCircle className="h-5 w-5" />
              Xác nhận thu hồi lô căn cứ
            </div>
            <p className="text-xs text-slate-600">
              Hành động này sẽ vô hiệu hóa toàn bộ các căn cứ trong lô{' '}
              <strong className="font-mono text-slate-900">{revokingBatch.id.substring(0, 8)}…</strong> và tự động tính toán lại điểm gợi ý của các sinh viên liên quan.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 block">
                Lý do thu hồi (Tối thiểu 5 ký tự) *
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ví dụ: Nhầm lẫn file điểm rèn luyện của học kỳ trước..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>

            {revokeError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {revokeError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRevoking}
                onClick={() => setRevokingBatch(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRevoking || revokeReason.trim().length < 5}
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white disabled:opacity-40"
              >
                {isRevoking ? 'Đang thu hồi...' : 'Xác nhận thu hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ImportGroundingData;
