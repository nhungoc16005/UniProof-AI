export type NavigationItem = { label: string; path: string; matches?: string[]; tabs?: { label: string; path: string }[]; description?: string };
export const roleNavigation: Record<string, NavigationItem[]> = {
  STAFF: [
    { label: 'Tổng quan Khoa', path: '/officer', matches: ['/officer', '/officer/reports', '/officer/students/legacy'] },
    { label: 'Xử lý đánh giá', path: '/officer/evaluations', matches: ['/officer/evaluations', '/officer/students', '/officer/students-directory', '/officer/queue', '/officer/review', '/officer/appeals'], description: 'Theo dõi lớp, hoàn thiện đánh giá, xác minh minh chứng và giải quyết phúc khảo.', tabs: [
      { label: 'Theo lớp', path: '/officer/evaluations' }, { label: 'Danh bạ sinh viên', path: '/officer/students-directory' }, { label: 'Phiếu đánh giá', path: '/officer/students' }, { label: 'Minh chứng', path: '/officer/queue' }, { label: 'Phúc khảo', path: '/officer/appeals' },
    ] },
    { label: 'Hoạt động & điểm danh', path: '/officer/activities', matches: ['/officer/activities', '/officer/external-activities'] },
    { label: 'Tiêu chí & quy chế', path: '/officer/criteria' },
  ],
  ADMIN: [
    { label: 'Tổng quan', path: '/admin' },
    { label: 'Kết quả rèn luyện', path: '/admin/results', matches: ['/admin/results', '/admin/reports', '/admin/evidence', '/admin/historical-results'], description: 'Tiếp nhận kết quả Khoa bàn giao, công bố và tra cứu kết quả của kỳ.', tabs: [
      { label: 'Tiếp nhận & công bố', path: '/admin/results' }, { label: 'Báo cáo kết quả', path: '/admin/reports' },
    ] },
    { label: 'Tài khoản & đơn vị', path: '/admin/users', matches: ['/admin/users'] },
    { label: 'Thiết lập đánh giá', path: '/admin/terms', matches: ['/admin/terms', '/admin/criteria', '/admin/knowledge-base', '/admin/rules'], description: 'Quản lý kỳ đánh giá, phiên bản bộ tiêu chí và văn bản làm căn cứ.', tabs: [
      { label: 'Kỳ đánh giá', path: '/admin/terms' }, { label: 'Bộ tiêu chí', path: '/admin/criteria' }, { label: 'Văn bản quy chế', path: '/admin/knowledge-base' },
    ] },
    { label: 'Giám sát & nhật ký', path: '/admin/monitoring', matches: ['/admin/monitoring', '/admin/audit-logs', '/admin/health'] },
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
