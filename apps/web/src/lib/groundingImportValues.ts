// Preserve blank and invalid values; the server validates the original input.
export function parseBooleanVal(val: unknown): boolean | string | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  if (typeof val === 'boolean') return val;
  const str = String(val).trim().toUpperCase();
  if (['CO', 'CÓ', 'TRUE', '1', 'YES', 'DAT', 'ĐẠT'].includes(str)) return true;
  if (['KHONG', 'KHÔNG', 'FALSE', '0', 'NO', 'CHUA', 'CHƯA'].includes(str)) return false;
  return String(val).trim();
}

export function parseNonNegativeInteger(val: unknown): number | string | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  if (typeof val === 'boolean') return String(val);
  const num = Number(val);
  return Number.isInteger(num) && num >= 0 ? num : String(val).trim();
}

export function parseAcademicTier(val: unknown): string | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const str = String(val).trim().toUpperCase();
  if (['XUAT_SAC', 'XUẤT SẮC', 'EXCELLENT'].includes(str)) return 'EXCELLENT';
  if (['GIOI', 'GIỎI', 'GOOD'].includes(str)) return 'GOOD';
  if (['KHA', 'KHÁ', 'ABOVE_AVERAGE'].includes(str)) return 'ABOVE_AVERAGE';
  if (['TRUNG_BINH', 'TRUNG BÌNH', 'AVERAGE'].includes(str)) return 'AVERAGE';
  if (['YEU', 'YẾU', 'KEM', 'KÉM', 'BELOW_AVERAGE'].includes(str)) return 'BELOW_AVERAGE';
  return str;
}
