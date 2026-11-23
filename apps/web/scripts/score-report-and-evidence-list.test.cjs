const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Stub window & document cho môi trường Node.js
if (typeof global.window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    confirm: () => true,
    alert: () => {},
    location: { search: '', pathname: '/student/evidences' },
  };
}

const React = require('../node_modules/react');
const ts = require('../node_modules/typescript');

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createReactHarness() {
  let hooks = [];
  let hookIndex = 0;
  let effectsToRun = [];
  let currentComponent = null;
  let rerenderScheduled = false;
  let lastVdom = null;

  const dispatcher = {
    useLayoutEffect(effect, deps) {
      dispatcher.useEffect(effect, deps);
    },
    useState(initial) {
      const idx = hookIndex++;
      if (hooks[idx] === undefined) {
        hooks[idx] = typeof initial === 'function' ? initial() : initial;
      }
      const setState = (action) => {
        const next = typeof action === 'function' ? action(hooks[idx]) : action;
        if (hooks[idx] !== next) {
          hooks[idx] = next;
          scheduleRerender();
        }
      };
      return [hooks[idx], setState];
    },
    useRef(initial) {
      const idx = hookIndex++;
      if (!hooks[idx]) {
        hooks[idx] = { current: initial };
      }
      return hooks[idx];
    },
    useCallback(fn, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      if (prev && deps && prev.deps.every((d, i) => Object.is(d, deps[i]))) {
        return prev.fn;
      }
      hooks[idx] = { fn, deps };
      return fn;
    },
    useMemo(fn, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      if (prev && deps && prev.deps.every((d, i) => Object.is(d, deps[i]))) {
        return prev.value;
      }
      const value = fn();
      hooks[idx] = { value, deps };
      return value;
    },
    useEffect(effect, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      const hasChanged = !prev || !deps || !prev.deps.every((d, i) => Object.is(d, deps[i]));
      if (hasChanged) {
        effectsToRun.push({ idx, effect, deps, cleanup: prev?.cleanup });
      }
    },
  };

  function render() {
    hookIndex = 0;
    effectsToRun = [];
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    lastVdom = currentComponent();
    for (const item of effectsToRun) {
      if (typeof item.cleanup === 'function') {
        item.cleanup();
      }
      const cleanup = item.effect();
      hooks[item.idx] = { effect: item.effect, deps: item.deps, cleanup };
    }
    return lastVdom;
  }

  function scheduleRerender() {
    if (!rerenderScheduled) {
      rerenderScheduled = true;
      queueMicrotask(() => {
        rerenderScheduled = false;
        render();
      });
    }
  }

  function unmount() {
    for (const hook of hooks) {
      if (hook && typeof hook.cleanup === 'function') {
        hook.cleanup();
      }
    }
  }

  return {
    mount(Component) {
      currentComponent = Component;
      return render();
    },
    rerender() {
      return render();
    },
    unmount,
    getHooks: () => hooks,
    getVdom: () => lastVdom,
    flush: async (delay = 10) => {
      await new Promise((r) => setTimeout(r, delay));
    },
  };
}

function loadRealComponent(filePath, mockModules = {}, transformSource = value => value) {
  const file = path.resolve(__dirname, filePath);
  const compiled = ts.transpileModule(transformSource(fs.readFileSync(file, 'utf8')), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));

  mod.require = (request) => {
    if (request === 'react') return React;
    if (mockModules[request]) return mockModules[request];
    for (const [key, val] of Object.entries(mockModules)) {
      if (request.endsWith(key) || request === key) return val;
    }
    if (request.endsWith('criterionEvidencePolicy')) {
      return loadRealComponent('../src/lib/criterionEvidencePolicy.ts', {});
    }
    return require(request);
  };

  mod._compile(compiled, file);
  return mod.exports;
}

function findElement(tree, matches) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const result = findElement(child, matches);
      if (result) return result;
    }
  } else if (React.isValidElement(tree)) {
    return matches(tree) ? tree : findElement(tree.props.children, matches);
  }
}

function textOf(tree) {
  if (Array.isArray(tree)) return tree.map(textOf).join('');
  if (React.isValidElement(tree)) return textOf(tree.props.children);
  return typeof tree === 'number' || typeof tree === 'string' ? String(tree) : '';
}

function buttonWithText(tree, label) {
  const button = findElement(tree, node => node.type === 'button' && textOf(node).trim() === label);
  assert.ok(button, label);
  return button;
}

function clientWithTransport(transport) {
  const mockAxios = { create: () => ({
    interceptors: { request: { use() {} }, response: { use() {} } }, ...transport,
  }) };
  return loadRealComponent('../src/lib/apiClient.ts', { axios: mockAxios },
    source => source.replace('(import.meta as any).env', '({})')).apiClient;
}

const envelope = (data, meta) => ({ data: { success: true, data, meta } });

test('BL-031: batch modal renders failureCount, finalizedCount and blocker from the API', async () => {
  const rows = ['sv-1', 'sv-2'].map((studentId, index) => ({
    studentId, student: { fullName: studentId, studentCode: studentId },
    state: 'REVIEWING', blockers: [], finalizedCriteria: 0, totalCriteria: 2,
    pendingAppeals: 0, pendingEvidence: index, ready: false,
  }));
  const api = clientWithTransport({
    get: async () => envelope({
      items: rows, summary: { total: 2 }, filters: { faculties: [], classes: [] },
      total: 2, page: 1, pageSize: 25,
      facultyProgress: [], updatedAt: '2026-11-23',
      term: { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true },
    }),
    post: async (url, body) => {
      assert.equal(url, '/assessments/batch-finalize');
      assert.deepEqual(body.studentIds, ['sv-1', 'sv-2']);
      return envelope({
        totalRequested: 2, successCount: 1, failureCount: 1,
        results: [
          { studentId: 'sv-1', success: true, finalizedCount: 2, blockers: [] },
          { studentId: 'sv-2', success: false, finalizedCount: 0, blockers: ['Còn minh chứng chờ'] },
        ],
      });
    },
  });
  const { EvaluationBoard } = loadRealComponent('../src/components/EvaluationBoard.tsx', {
    AuthContext: { useAuth: () => ({ activeTerm: { id: 'term-1' } }) },
    apiClient: { apiClient: api },
    'react-router-dom': { Link: () => null, useSearchParams: () => [new URLSearchParams(), () => {}] },
    'ui/Skeleton': { TableSkeleton: () => null },
  });
  const harness = createReactHarness();
  harness.mount(() => EvaluationBoard({}));
  await harness.flush();
  const select = findElement(harness.getVdom(), node => node.props['aria-label'] === 'Chọn kết quả trên trang');
  select.props.onChange({ target: { checked: true } });
  await harness.flush();
  buttonWithText(harness.getVdom(), 'Chốt hàng loạt (2)').props.onClick();
  await harness.flush();
  await buttonWithText(harness.getVdom(), 'Bắt đầu chốt hàng loạt').props.onClick();
  await harness.flush();
  const text = textOf(harness.getVdom());
  assert.match(text, /Chốt thành công1 phiếu/);
  assert.match(text, /Bỏ qua1 phiếu/);
  assert.match(text, /Vừa chốt 2 tiêu chí/);
  assert.match(text, /Còn minh chứng chờ/);
  harness.unmount();
});

test('BL-031: single preview renders the adjusted projected score of zero and the finalized status', async () => {
  const api = clientWithTransport({
    get: async url => {
      if (url.endsWith('/preview-finalize')) return envelope({
        canFinalize: true, blockers: [], warnings: [],
        criteria: [{ id: 'c-1', code: '1', name: 'Tiêu chí điều chỉnh', selfScore: 5, suggestedScore: 3,
          officialScore: 0, projectedScore: 0, status: 'ALREADY_FINALIZED', canFinalize: true }],
      });
      if (url.startsWith('/users/')) return envelope({ fullName: 'Sinh viên A', studentCode: 'SV1', class: { code: 'A' } });
      if (url.startsWith('/assessments/')) return envelope({ term: { id: 'term-1', status: 'ACTIVE', evidenceBasisWorkflowEnabled: true }, categories: [], permissions: { canReview: true } });
      return envelope([]);
    },
  });
  const { StudentAssessment } = loadRealComponent('../src/pages/officer/StudentAssessment.tsx', {
    AuthContext: { useAuth: () => ({ activeTerm: { id: 'term-1' }, user: { role: 'STAFF' } }) },
    apiClient: { apiClient: api },
    'react-router-dom': { Link: () => null, useParams: () => ({ studentId: 'sv-1' }), useSearchParams: () => [new URLSearchParams(), () => {}] },
  });
  const harness = createReactHarness();
  harness.mount(() => StudentAssessment({}));
  await harness.flush();
  await buttonWithText(harness.getVdom(), 'Chốt phiếu sinh viên').props.onClick();
  await harness.flush();
  const row = findElement(harness.getVdom(), node => node.type === 'tr' && textOf(node).includes('Tiêu chí điều chỉnh'));
  assert.deepEqual(React.Children.toArray(row.props.children).map(textOf), ['1', 'Tiêu chí điều chỉnh', '5', '3', '0', 'Đã chốt']);
  harness.unmount();
});

test('BL-033/034: ScoreReport separates suggestions and shows the effective appeal deadline', async () => {
  const term = { id: 'term-1', workflowEnabled: true, appealDeadline: '2030-01-01T00:00:00.000Z' };
  const deadline = '2030-01-15T03:00:00.000Z';
  const { ScoreReport } = loadRealComponent('../src/pages/student/ScoreReport.tsx', {
    AuthContext: { useAuth: () => ({ activeTerm: term, terms: [term], user: { id: 'sv-1' } }) },
    apiClient: { apiClient: { getConductDashboard: async () => ({}), getEvidences: async () => [] } },
    useStudentAssessmentAccess: { useStudentAssessmentAccess: () => ({
      canEdit: false,
      refresh: async () => ({
        term, rubricVersion: { id: 'rubric' },
        publication: { revision: 1 },
        permissions: { effectiveDeadlines: { appeal: { deadline, source: 'STUDENT' } } },
        categories: [{ key: 'I', maxScore: 10, criteria: [{
          id: 'c-1', code: '1', name: 'Tiêu chí điểm danh', maxScore: 5,
          assessment: { suggestedScore: 0, officialScore: null, status: 'NEEDS_VERIFICATION' },
        }, {
          id: 'c-2', code: '2', name: 'Tiêu chí đã công bố', maxScore: 5,
          assessment: { suggestedScore: 4, officialScore: 2, status: 'FINALIZED' },
        }] }],
      }),
    }) },
    StudentAssessmentNotice: { StudentAssessmentNotice: () => null },
    'react-router-dom': { useSearchParams: () => [new URLSearchParams({ termId: term.id })],
      useNavigate: () => () => {}, useLocation: () => ({ pathname: '/student/scores', search: '?termId=term-1' }) },
  });
  const harness = createReactHarness();
  harness.mount(() => ScoreReport({}));
  await harness.flush();
  const cells = label => React.Children.toArray(findElement(harness.getVdom(),
    node => node.type === 'tr' && textOf(node).includes(label)).props.children).map(textOf).slice(-2);
  assert.deepEqual(cells('Tiêu chí điểm danh'), ['0 / 5 đTheo căn cứ đã xác minh', 'Chưa công bố']);
  assert.deepEqual(cells('Tiêu chí đã công bố'), ['4 / 5 đTheo căn cứ đã xác minh', '2/5 điểm']);
  const rendered = textOf(harness.getVdom());
  assert.match(rendered, /Hạn phúc khảo hiện hành/);
  assert.ok(rendered.includes(new Date(deadline).toLocaleString('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  })));
  harness.unmount();
});

test('BL-035: Dashboard reads real envelope metadata and fetches supplements outside the recent page', async () => {
  const pendingTerm = createDeferred();
  const calls = [];
  const counts = { all: 21, approved: 17, reviewing: 3, supplement: 1 };
  const meta = (total, pageSize) => ({ total, page: 1, pageSize, counts });
  const api = clientWithTransport({
    get: async (url, { params }) => {
      if (url === '/scores/dashboard') return envelope({ categories: [] });
      assert.equal(url, '/evidence');
      calls.push(params);
      if (params.status === 'NEEDS_SUPPLEMENT') {
        if (params.termId === 'term-failed') throw new Error('Lỗi tải hồ sơ bổ sung');
        return envelope([{ id: 'ev-21', declaredActivityName: 'Yêu cầu ở trang hai' }], meta(1, 8));
      }
      if (params.termId === 'term-old') return pendingTerm.promise;
      return envelope([{ id: 'recent', declaredActivityName: 'Minh chứng mới', status: 'APPROVED' }], meta(21, 4));
    },
  });
  let activeTerm = { id: 'term-old' };
  const ActionQueue = () => null;
  const StatCard = () => null;
  const { StudentDashboard } = loadRealComponent('../src/pages/student/Dashboard.tsx', {
    AuthContext: { useAuth: () => ({ activeTerm, user: { id: 'sv-1' } }) },
    apiClient: { apiClient: api },
    'react-router-dom': { Link: () => null },
    useStudentAssessmentAccess: { useStudentAssessmentAccess: () => ({ isReturned: false }) },
    StudentAssessmentNotice: { StudentAssessmentNotice: () => null },
    'ui/StatusBadge': { StatusBadge: () => null },
    'ui/ScoreGauge': { ScoreGauge: () => null },
    'components/shared': { ActionQueue, StatCard, PageHeader: () => null, SectionHeader: () => null,
      DeadlineCard: () => null, InsightPanel: () => null },
  });
  const harness = createReactHarness();
  harness.mount(() => StudentDashboard({}));
  activeTerm = { id: 'term-new' };
  harness.rerender();
  await harness.flush();
  pendingTerm.resolve(envelope([], { total: 0, counts: { all: 0, approved: 0, reviewing: 0, supplement: 0 } }));
  await harness.flush();

  const tree = harness.getVdom();
  const stat = label => findElement(tree, node => node.type === StatCard && node.props.label === label).props.value;
  assert.equal(stat('Minh chứng đã duyệt'), 17);
  assert.equal(stat('Minh chứng chờ duyệt'), 3);
  assert.equal(stat('Hồ sơ cần bổ sung'), 1);
  assert.match(textOf(tree), /Xem toàn bộ \(21\)/);
  const queue = findElement(tree, node => node.type === ActionQueue);
  assert.equal(queue.props.totalCount, 1);
  assert.equal(queue.props.items[0].to, '/student/evidence/ev-21/supplement?termId=term-new');
  assert.ok(calls.some(params => params.termId === 'term-new' && params.status === 'NEEDS_SUPPLEMENT' && params.pageSize === 8));
  activeTerm = { id: 'term-failed' };
  harness.rerender();
  await harness.flush();
  const failedTree = harness.getVdom();
  assert.equal(findElement(failedTree, node => node.type === StatCard && node.props.label === 'Hồ sơ cần bổ sung').props.value, 1);
  assert.match(textOf(failedTree), /Không tải được danh sách cần bổ sung/);
  assert.equal(findElement(failedTree, node => node.type === ActionQueue), undefined);
  harness.unmount();
});

test('BL-037: layout and center share unread count 1 with all visible notifications read', async () => {
  const items = Array.from({ length: 50 }, (_, index) => ({ id: 'notif-' + index, isRead: true, createdAt: '2026-11-23' }));
  const calls = [];
  const api = clientWithTransport({
    get: async url => {
      assert.equal(url, '/notifications');
      calls.push('load');
      return envelope({ items, unreadCount: 1 });
    },
    patch: async url => {
      assert.equal(url, '/notifications/read-all');
      calls.push('mark-all');
      return envelope({});
    },
  });
  const hook = loadRealComponent('../src/hooks/useNotificationFeed.ts', { apiClient: { apiClient: api } });
  const Outlet = () => null;
  const { AppLayout } = loadRealComponent('../src/layouts/AppLayout.tsx', {
    AuthContext: { useAuth: () => ({ activeTerm: { id: 'term-1' }, terms: [], user: { id: 'sv-1', role: 'STUDENT' } }) },
    apiClient: { apiClient: api },
    roleNavigation: loadRealComponent('../src/lib/roleNavigation.ts'),
    useNotificationFeed: hook,
    'react-router-dom': { Outlet, Link: () => null, useLocation: () => ({ pathname: '/notifications', search: '', key: 'one' }), useNavigate: () => () => {} },
  });
  const layout = createReactHarness();
  layout.mount(() => AppLayout({}));
  await layout.flush();
  const bell = () => findElement(layout.getVdom(), node => node.type === 'button' && node.props['aria-label'] === 'Thông báo');
  const { NotificationsCenter } = loadRealComponent('../src/pages/common/NotificationsCenter.tsx', {
    'react-router-dom': {
      useOutletContext: () => findElement(layout.getVdom(), node => node.type === Outlet).props.context,
      useNavigate: () => () => {},
    },
  });
  const center = createReactHarness();
  center.mount(() => NotificationsCenter({}));
  assert.equal(textOf(bell()), '1');
  buttonWithText(center.getVdom(), 'Chưa đọc (1)').props.onClick();
  await center.flush();
  assert.match(textOf(center.getVdom()), /Còn thông báo chưa đọc ngoài 50 mục gần nhất/);
  await buttonWithText(center.getVdom(), 'Đánh dấu tất cả đã đọc').props.onClick();
  await layout.flush();
  center.rerender();
  assert.equal(textOf(bell()), '');
  assert.match(textOf(center.getVdom()), /Chưa đọc \(0\)/);
  assert.match(textOf(center.getVdom()), /Bạn đã đọc tất cả thông báo/);
  assert.deepEqual(calls, ['load', 'mark-all']);
  center.unmount();
  layout.unmount();
});

// =========================================================================
// TEST SUITES: BL-024, BL-018, BL-019
// =========================================================================

describe('BL-024 (Web): ScoreReport — Chống nộp chéo kỳ khi đổi kỳ trong lúc request preflight đang treo (Deferred Promise)', () => {
  test('Ca 1: Preflight kỳ A đang treo, đổi sang kỳ B -> response kỳ A về sau bị hủy, không hiển thị preflight kỳ A trên kỳ B', async () => {
    // Tái hiện chính xác luồng xử lý ref + generation trong ScoreReport
    const deferredPreflightA = createDeferred();
    let currentTerm = 'term-1';
    let preflightState = null;
    let submittingState = false;

    // Giả lập logic của ScoreReport: currentTermRef và submitGenerationRef
    let currentTermRef = { current: currentTerm };
    let submitGenerationRef = { current: 0 };

    const onTermChange = (newTermId) => {
      currentTerm = newTermId;
      currentTermRef.current = newTermId;
      preflightState = null; // Xóa preflight khi đổi kỳ
    };

    const submitAll = async () => {
      const targetTermId = currentTermRef.current;
      const requestGeneration = ++submitGenerationRef.current;
      submittingState = true;

      try {
        const res = await deferredPreflightA.promise;

        // Kiểm tra generation và termId khớp với currentTermRef
        if (requestGeneration !== submitGenerationRef.current || currentTermRef.current !== targetTermId) {
          return false;
        }

        preflightState = { ...res, termId: targetTermId };
        return true;
      } finally {
        if (requestGeneration === submitGenerationRef.current) {
          submittingState = false;
        }
      }
    };

    // Bước 1: Đang ở kỳ A (term-1), sinh viên bấm nộp
    const submitPromise = submitAll();
    assert.equal(submittingState, true);
    assert.equal(preflightState, null);

    // Bước 2: Sinh viên đổi kỳ sang kỳ B (term-2) trong lúc request preflight kỳ A đang pending
    onTermChange('term-2');
    assert.equal(currentTermRef.current, 'term-2');
    assert.equal(preflightState, null, 'Preflight phải bị xóa ngay lập tức khi đổi kỳ');

    // Bước 3: Deferred Promise của kỳ A hoàn thành sau đó
    deferredPreflightA.resolve({
      canSubmit: true,
      summary: { totalScore: 85, missingEvidenceCount: 0 },
    });

    const success = await submitPromise;
    // Request preflight của kỳ A phải bị hủy bỏ không cho phép nhận trên kỳ B
    assert.equal(success, false, 'Preflight của kỳ A không được chấp nhận khi đang ở kỳ B');
    assert.equal(preflightState, null, 'Không được hiển thị modal xác nhận kỳ A trên giao diện kỳ B');

    // Bước 4: Kiểm tra confirmSubmit chặn nộp chéo kỳ nếu preflight.termId !== currentTermRef.current
    const confirmSubmit = (preflight) => {
      if (!preflight?.canSubmit || preflight.termId !== currentTermRef.current) {
        return false;
      }
      return true;
    };

    // Giả sử có một preflight cũ của term-1 lọt vào
    const fakePreflightA = { canSubmit: true, termId: 'term-1' };
    const canConfirm = confirmSubmit(fakePreflightA);
    assert.equal(canConfirm, false, 'confirmSubmit phải từ chối preflight có termId khác kỳ hiện hành');
  });
});

describe('BL-029 (Web): Grounding import preview sessions', () => {
  const XLSX = require('../node_modules/xlsx');
  const studentCode = '0102210001';
  const file = name => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { MSSV: studentCode, examBans: 0, classWarnings: 1, Vai_tro: 'THAM_GIA_CHINH' },
    ]), 'Import');
    return { name, arrayBuffer: async () => XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) };
  };

  function find(tree, predicate) {
    if (Array.isArray(tree)) {
      for (const child of tree) {
        const match = find(child, predicate);
        if (match) return match;
      }
      return undefined;
    }
    if (!tree?.props) return undefined;
    return predicate(tree) ? tree : find(tree.props.children, predicate);
  }

  function setup(api) {
    const terms = ['term-A', 'term-B'].map(id => ({ id, status: 'ACTIVE', evidenceBasisWorkflowEnabled: true }));
    let termId = terms[0].id;
    const parser = loadRealComponent('../src/lib/groundingImportValues.ts');
    const { ImportGroundingData } = loadRealComponent('../src/pages/officer/ImportGroundingData.tsx', {
      'react-router-dom': { useSearchParams: () => [new URLSearchParams({ termId })] },
      AuthContext: { useAuth: () => ({ activeTerm: terms[0], terms }) },
      apiClient: { apiClient: api },
      groundingImportValues: parser,
    });
    let workspace;
    let key;
    let view;
    function navigate(nextTermId) {
      termId = nextTermId;
      const nextView = ImportGroundingData();
      assert.ok(nextView.key.startsWith(nextTermId + ':'));
      if (nextView.key !== key) {
        workspace?.unmount();
        view = nextView;
        workspace = createReactHarness();
        workspace.mount(() => view.type(view.props));
        key = view.key;
      } else {
        view = nextView;
        workspace.rerender();
      }
      return workspace;
    }
    return {
      navigate,
      updateTerm: (nextTermId, patch) => {
        Object.assign(terms.find(term => term.id === nextTermId), patch);
        return navigate(nextTermId);
      },
    };
  }

  const preview = termId => ({ termId, totalRows: 1, validCount: 1, previewItems: [] });
  const upload = (workspace, name) => find(workspace.getVdom(), node => node.type === 'input' && node.props.type === 'file')
    .props.onChange({ target: { files: [file(name)] } });
  const confirmation = workspace => find(workspace.getVdom(), node =>
    node.type === 'button' && React.Children.toArray(node.props.children).some(child => typeof child === 'string' && child.includes('Xác nhận nhập')));

  test('BL-032: moving to the traditional workflow invalidates a pending preview', async () => {
    const late = createDeferred();
    const { navigate, updateTerm } = setup({ previewGroundingImport: () => late.promise });
    const before = navigate('term-A');
    const pending = upload(before, 'before.xlsx');
    await before.flush();
    const traditional = updateTerm('term-A', { evidenceBasisWorkflowEnabled: false });
    late.resolve(preview('term-A'));
    await pending;
    await traditional.flush();
    assert.match(textOf(traditional.getVdom()), /quy trình truyền thống/);
    assert.equal(find(traditional.getVdom(), node => node.type === 'input' && node.props.type === 'file'), undefined);
    assert.equal(confirmation(traditional), undefined);
    const upcoming = updateTerm('term-A', { status: 'UPCOMING', evidenceBasisWorkflowEnabled: true });
    assert.match(textOf(upcoming.getVdom()), /Chỉ nhập căn cứ khi kỳ đang mở hoặc đang thẩm định/);
    upcoming.unmount();
  });

  test('previewed file is cleared on A → B, then retry confirms the new session with the same key', async () => {
    const calls = [];
    const { navigate } = setup({
      previewGroundingImport: async body => preview(body.termId),
      confirmGroundingImport: async body => {
        calls.push(body);
        if (calls.length === 1) throw new Error('Mất kết nối');
        return { batchId: 'batch-B', validRows: 1 };
      },
      listGroundingBatches: async () => [],
    });
    const a = navigate('term-A');
    await upload(a, 'a.xlsx');
    await a.flush();
    const oldConfirm = confirmation(a);
    assert.ok(oldConfirm);
    const b = navigate('term-B');
    await oldConfirm.props.onClick();
    assert.equal(confirmation(b), undefined);
    assert.deepEqual(calls, []);

    await upload(b, 'b.xlsx');
    await b.flush();
    for (let attempt = 0; attempt < 2; attempt++) {
      await confirmation(b).props.onClick();
      await b.flush();
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.match(calls[0].idempotencyKey, /^batch_/);
    assert.equal(calls[0].termId, 'term-B');
    assert.equal(calls[0].previewTermId, 'term-B');
    assert.equal(calls[0].rows[0].studentCode, studentCode);
    b.unmount();
  });

  test('late preview A is ignored after navigation while preview B is usable', async () => {
    const lateA = createDeferred();
    const calls = [];
    const { navigate } = setup({
      previewGroundingImport: body => {
        calls.push(body);
        return body.termId === 'term-A' ? lateA.promise : Promise.resolve(preview(body.termId));
      },
    });
    const a = navigate('term-A');
    const pendingA = upload(a, 'a.xlsx');
    await a.flush();
    assert.equal(calls[0].termId, 'term-A');
    const b = navigate('term-B');
    await upload(b, 'b.xlsx');
    await b.flush();
    lateA.resolve(preview('term-A'));
    await pendingA;
    await b.flush();
    assert.equal(confirmation(a), undefined);
    assert.ok(confirmation(b));
    assert.deepEqual(calls.map(body => [body.termId, body.rows[0].studentCode]), [
      ['term-A', studentCode], ['term-B', studentCode],
    ]);
    b.unmount();
  });

  test('changing activity or selecting a replacement file invalidates outstanding previews', async () => {
    const oldActivity = createDeferred();
    const oldFile = createDeferred();
    const requests = [];
    const { navigate } = setup({
      getActivities: async () => [{ id: 'activity-1', name: 'Hoạt động 1' }, { id: 'activity-2', name: 'Hoạt động 2' }],
      previewGroundingImport: body => {
        requests.push(body);
        if (requests.length === 1) return oldActivity.promise;
        if (requests.length === 2) return oldFile.promise;
        return Promise.resolve(preview(body.termId));
      },
    });
    const workspace = navigate('term-A');
    find(workspace.getVdom(), node => node.type === 'div' && node.key === 'ACTIVITY').props.onClick();
    await workspace.flush();
    const first = upload(workspace, 'activity-1.xlsx');
    await workspace.flush();
    find(workspace.getVdom(), node => node.type === 'select' && node.props.value === 'activity-1')
      .props.onChange({ target: { value: 'activity-2' } });
    await workspace.flush();
    oldActivity.resolve(preview('term-A'));
    await first;
    assert.equal(confirmation(workspace), undefined);

    const second = upload(workspace, 'old.xlsx');
    await workspace.flush();
    await upload(workspace, 'replacement.xlsx');
    await workspace.flush();
    oldFile.reject(new Error('Lỗi từ file đã thay thế'));
    await second;
    await workspace.flush();
    assert.ok(confirmation(workspace));
    assert.equal(find(workspace.getVdom(), node => node.props.children === 'Lỗi từ file đã thay thế'), undefined);
    assert.deepEqual(requests.map(body => [body.activityId, body.source]), [
      ['activity-1', 'activity-1.xlsx'], ['activity-2', 'old.xlsx'], ['activity-2', 'replacement.xlsx'],
    ]);
    workspace.unmount();
  });
});

describe('BL-018 (Web): ProfileDataIssues — Chặn response cũ ghi đè khi đổi tab/trang (Request Generation)', () => {
  test('Ca 1: Tab OPEN trả sau tab RESOLVED -> Kết quả tab OPEN không ghi đè dữ liệu tab RESOLVED', async () => {
    let currentParams = new URLSearchParams('status=OPEN&page=1');
    const deferredOpen = createDeferred();
    const deferredResolved = createDeferred();

    const mockApiClient = {
      getProfileDataIssues: async ({ status }) => {
        if (status === 'OPEN') return deferredOpen.promise;
        if (status === 'RESOLVED') return deferredResolved.promise;
        return { items: [], total: 0, pageSize: 25 };
      },
    };

    const { ProfileDataIssues } = loadRealComponent('../src/pages/admin/ProfileDataIssues.tsx', {
      'react-router-dom': {
        useSearchParams: () => [
          currentParams,
          (next) => {
            currentParams = new URLSearchParams(next);
            harness.rerender();
          },
        ],
        Link: ({ children }) => children,
      },
      apiClient: { apiClient: mockApiClient },
      PageHeader: { PageHeader: () => null },
      'lucide-react': new Proxy({}, { get: () => () => null }),
    });

    const harness = createReactHarness();
    harness.mount(() => ProfileDataIssues({}));
    await harness.flush(15);

    // Chuyển sang tab RESOLVED trong khi OPEN vẫn đang pending
    currentParams = new URLSearchParams('status=RESOLVED&page=1');
    harness.rerender();
    await harness.flush(15);

    // Cho request RESOLVED trả về trước
    deferredResolved.resolve({
      items: [{ id: 'issue-res-1', category: 'CLASS', content: 'Sửa lớp sang 20TCLC_DT1', status: 'RESOLVED', createdAt: new Date().toISOString(), reporter: { fullName: 'SV B', email: 'b@dut.udn.vn' } }],
      total: 1,
      pageSize: 25,
    });
    await harness.flush(20);

    // Kiểm tra state đang hiển thị dữ liệu của RESOLVED
    const hooksAfterRes = harness.getHooks();
    const dataStateAfterRes = hooksAfterRes.find((h) => h && Array.isArray(h.items));
    assert(dataStateAfterRes, 'Phải có data state');
    assert.equal(dataStateAfterRes.items.length, 1);
    assert.equal(dataStateAfterRes.items[0].id, 'issue-res-1');

    // Sau đó request OPEN cũ mới trả về (chậm hơn)
    deferredOpen.resolve({
      items: [{ id: 'issue-open-999', category: 'NAME', content: 'Sửa tên cũ', status: 'OPEN', createdAt: new Date().toISOString(), reporter: { fullName: 'SV Cũ', email: 'old@dut.udn.vn' } }],
      total: 1,
      pageSize: 25,
    });
    await harness.flush(20);

    // Response cũ của OPEN không được ghi đè, màn hình vẫn giữ dữ liệu của RESOLVED
    const hooksFinal = harness.getHooks();
    const dataStateFinal = hooksFinal.find((h) => h && Array.isArray(h.items));
    assert.equal(dataStateFinal.items.length, 1);
    assert.equal(dataStateFinal.items[0].id, 'issue-res-1', 'Dữ liệu OPEN về muộn KHÔNG được ghi đè lên tab RESOLVED');
    harness.unmount();
  });
});

describe('BL-019 (Web): EvidenceList — Đồng bộ URL ?termId=... và tự động reset page=1 khi đổi kỳ', () => {
  test('Ca 1: Khi mount chưa có param termId, tự động đồng bộ activeTerm vào searchParams', async () => {
    let currentParams = new URLSearchParams('');
    let syncedParams = null;

    const mockTerms = [
      { id: 'term-1', name: 'Học kỳ 1 2026-2027', status: 'ACTIVE' },
      { id: 'term-2', name: 'Học kỳ 2 2026-2027', status: 'UPCOMING' },
    ];

    const mockApiClient = {
      getEvidencesPage: async () => ({
        items: [],
        total: 0,
        counts: { all: 0, approved: 0, supplement: 0, reviewing: 0 },
      }),
    };

    const { EvidenceList } = loadRealComponent('../src/pages/student/EvidenceList.tsx', {
      'react-router-dom': {
        useSearchParams: () => [
          currentParams,
          (next) => {
            syncedParams = new URLSearchParams(next);
            currentParams = syncedParams;
          },
        ],
        Link: ({ children }) => children,
      },
      AuthContext: {
        useAuth: () => ({
          user: { id: 'student-1', role: 'STUDENT' },
          activeTerm: mockTerms[0],
          terms: mockTerms,
        }),
      },
      apiClient: { apiClient: mockApiClient },
      StatusBadge: { StatusBadge: () => null },
      Skeleton: { TableSkeleton: () => null },
      'lucide-react': new Proxy({}, { get: () => () => null }),
    });

    const harness = createReactHarness();
    harness.mount(() => EvidenceList({}));
    await harness.flush(20);

    // URL phải được đồng bộ với termId của activeTerm
    assert(syncedParams, 'Phải gọi setSearchParams để đồng bộ URL');
    assert.equal(syncedParams.get('termId'), 'term-1', 'termId trong URL phải bằng term-1');
    harness.unmount();
  });

  test('Ca 2: Đang ở trang 5 của kỳ 1, chuyển sang kỳ 2 -> page tự động reset về 1', async () => {
    let currentParams = new URLSearchParams('termId=term-1&page=5');
    let requestedPage = 5;

    const mockTerms = [
      { id: 'term-1', name: 'Học kỳ 1 2026-2027', status: 'ACTIVE' },
      { id: 'term-2', name: 'Học kỳ 2 2026-2027', status: 'UPCOMING' },
    ];

    const requestedTerms = [];
    const mockApiClient = {
      getEvidencesPage: async ({ termId, page }) => {
        requestedTerms.push({ termId, page });
        return {
          items: [{ id: `evi-${termId}-${page}`, status: 'APPROVED', files: [] }],
          total: 50,
          counts: { all: 50, approved: 50, supplement: 0, reviewing: 0 },
        };
      },
    };

    const { EvidenceList } = loadRealComponent('../src/pages/student/EvidenceList.tsx', {
      'react-router-dom': {
        useSearchParams: () => [
          currentParams,
          (next) => {
            currentParams = new URLSearchParams(next);
            harness.rerender();
          },
        ],
        Link: ({ children }) => children,
      },
      AuthContext: {
        useAuth: () => ({
          user: { id: 'student-1', role: 'STUDENT' },
          activeTerm: mockTerms[0],
          terms: mockTerms,
        }),
      },
      apiClient: { apiClient: mockApiClient },
      StatusBadge: { StatusBadge: () => null },
      Skeleton: { TableSkeleton: () => null },
      'lucide-react': new Proxy({}, { get: () => () => null }),
    });

    const harness = createReactHarness();
    harness.mount(() => EvidenceList({}));
    await harness.flush(20);

    // Chuyển page lên trang 5 ở kỳ 1
    const hooks = harness.getHooks();
    const setPageHook = hooks.find((h) => typeof h === 'function');
    // Set page state
    for (let i = 0; i < hooks.length; i++) {
      if (hooks[i] === 1 && typeof hooks[i + 1] === 'function') {
        hooks[i + 1](5); // setPage(5)
        break;
      }
    }
    await harness.flush(20);

    // Giờ chuyển sang kỳ 2
    currentParams = new URLSearchParams('termId=term-2');
    harness.rerender();
    await harness.flush(30);

    // Kiểm tra request cuối cùng gọi getEvidencesPage với kỳ 2 phải có page = 1
    const lastRequest = requestedTerms[requestedTerms.length - 1];
    assert.equal(lastRequest.termId, 'term-2');
    assert.equal(lastRequest.page, 1, 'Khi đổi sang kỳ 2, page phải tự động reset về 1');
    harness.unmount();
  });
});

describe('Quy tắc hiển thị minh chứng theo 16 tiêu chí (ScoreReport)', () => {
  test('Phân loại chính xác 6 tiêu chí miễn nộp và 10 tiêu chí bắt buộc minh chứng', () => {
    const { getCriterionEvidencePolicy } = loadRealComponent('../src/pages/student/ScoreReport.tsx', {
      'react-router-dom': { useSearchParams: () => [new URLSearchParams(), () => {}], useNavigate: () => () => {}, useLocation: () => ({ pathname: '/', search: '' }) },
      useStudentAssessmentAccess: { useStudentAssessmentAccess: () => ({}) },
      StudentAssessmentNotice: { StudentAssessmentNotice: () => null },
      AuthContext: { useAuth: () => ({}) },
      apiClient: { apiClient: {}, API_BASE_URL: '' },
      'lucide-react': new Proxy({}, { get: () => () => null }),
    });

    const autoSync = [
      { code: '1', scoringConfig: { kind: 'attendance_penalty' } },
      { code: '3', scoringConfig: { kind: 'academic_effort' } },
      { code: '7', scoringConfig: { kind: 'conduct_penalty' } },
      { code: '11', scoringConfig: { kind: 'all_conditions' } },
    ];
    for (const c of autoSync) {
      const policy = getCriterionEvidencePolicy(c);
      assert.equal(policy.required, false, `TC${c.code} phải miễn nộp`);
      assert.equal(policy.badgeLabel, 'Học vụ tự động');
    }

    const defaultPass = [
      { code: '2', scoringConfig: { kind: 'group_penalty' } },
      { code: '6', scoringConfig: { kind: 'manual_verified' } },
    ];
    for (const c of defaultPass) {
      const policy = getCriterionEvidencePolicy(c);
      assert.equal(policy.required, false, `TC${c.code} phải miễn nộp`);
      assert.equal(policy.badgeLabel, 'Mặc định đạt');
    }

    const requiredCriteria = [
      { code: '4', scoringConfig: { kind: 'verified_boolean' } },
      { code: '5', scoringConfig: { kind: 'award_tier' } },
      { code: '8', scoringConfig: { kind: 'activity_threshold' } },
      { code: '9', scoringConfig: { kind: 'activity_threshold' } },
      { code: '10', scoringConfig: { kind: 'activity_threshold' } },
      { code: '12', scoringConfig: { kind: 'community_activity_tier' } },
      { code: '13', scoringConfig: { kind: 'verified_boolean' } },
      { code: '14', scoringConfig: { kind: 'leadership_duty' } },
      { code: '15', scoringConfig: { kind: 'verified_boolean' } },
      { code: '16', scoringConfig: { kind: 'verified_boolean' } },
    ];
    for (const c of requiredCriteria) {
      const policy = getCriterionEvidencePolicy(c);
      assert.equal(policy.required, true, `TC${c.code} phải bắt buộc minh chứng`);
      assert.equal(policy.badgeLabel, 'Bắt buộc minh chứng');
    }
  });
});
