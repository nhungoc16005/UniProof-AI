export type NavigationItem = { label: string; path: string; matches?: string[]; tabs?: { label: string; path: string }[] };
export const roleNavigation: Record<string, NavigationItem[]> = {
  STAFF: [
    { label: 'Tổng quan Khoa', path: '/officer', matches: ['/officer', '/officer/reports', '/officer/students/legacy'] },
    { label: 'Thẩm định đánh giá', path: '/officer/evaluations', matches: ['/officer/evaluations', '/officer/students', '/officer/students-directory', '/officer/queue', '/officer/review'], tabs: [
      { label: 'Theo lớp', path: '/officer/evaluations' }, { label: 'Hàng đợi minh chứng & AI', path: '/officer/queue' },
    ] },
    { label: 'Phúc khảo', path: '/officer/appeals', matches: ['/officer/appeals'] },
    { label: 'Hoạt động & điểm danh', path: '/officer/activities', matches: ['/officer/activities', '/officer/external-activities'] },
    { label: 'Tiêu chí & quy chế', path: '/officer/criteria' },
  ],
  ADMIN: [
    { label: 'Bảng điều hành', path: '/admin' },
    { label: 'Tiếp nhận & Công bố', path: '/admin/results', matches: ['/admin/results', '/admin/reports', '/admin/evidence', '/admin/historical-results'], tabs: [
      { label: 'Tiếp nhận & công bố', path: '/admin/results' }, { label: 'Báo cáo kết quả', path: '/admin/reports' },
    ] },
    { label: 'Dữ liệu & Kỳ đánh giá', path: '/admin/terms', matches: ['/admin/terms', '/admin/criteria', '/admin/knowledge-base', '/admin/rules'], tabs: [
      { label: 'Kỳ đánh giá', path: '/admin/terms' }, { label: 'Bộ tiêu chí', path: '/admin/criteria' }, { label: 'Văn bản quy chế', path: '/admin/knowledge-base' },
    ] },
    { label: 'Quản lý tài khoản', path: '/admin/users', matches: ['/admin/users', '/admin/users/issues'], tabs: [
      { label: 'Tài khoản & đơn vị', path: '/admin/users' }, { label: 'Yêu cầu sửa thông tin', path: '/admin/users/issues' },
    ] },
    { label: 'Giám sát & Nhật ký', path: '/admin/monitoring', matches: ['/admin/monitoring', '/admin/audit-logs', '/admin/health'] },
  ],
};
export const matchesNavigation = (item: NavigationItem, pathname: string) =>
  (item.matches || [item.path]).some(path => pathname === path || (!['/admin', '/officer'].includes(path) && pathname.startsWith(path + '/')));
export function currentNavigation(role: string, pathname: string) {
  return [...(roleNavigation[role] || [])].reverse().find(item => matchesNavigation(item, pathname));
}
export function navigationHref(path: string, search: string, termId?: string, currentPath?: string) {
  const current = new URLSearchParams(search);
  const selectedTerm = current.get('termId') || termId;
  const returnTo = current.get('returnTo');
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    const target = new URL(returnTo, 'https://edupoint.invalid');
    if (target.pathname === path && (!target.searchParams.get('termId') || target.searchParams.get('termId') === selectedTerm)) {
      if (selectedTerm) target.searchParams.set('termId', selectedTerm);
      return target.pathname + target.search;
    }
  }
  const params = path === currentPath ? current : new URLSearchParams();
  if (selectedTerm) params.set('termId', selectedTerm);
  return path + (params.size ? '?' + params.toString() : '');
}
