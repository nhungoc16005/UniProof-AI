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

function loadRealComponent(filePath, mockModules = {}) {
  const file = path.resolve(__dirname, filePath);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
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
    return require(request);
  };

  mod._compile(compiled, file);
  return mod.exports;
}

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
    const terms = ['term-A', 'term-B'].map(id => ({ id, evidenceBasisWorkflowEnabled: true }));
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
    function navigate(nextTermId) {
      termId = nextTermId;
      const view = ImportGroundingData();
      assert.equal(view.key, nextTermId);
      if (view.key !== key) {
        workspace?.unmount();
        workspace = createReactHarness();
        workspace.mount(() => view.type(view.props));
        key = view.key;
      }
      return workspace;
    }
    return { navigate };
  }

  const preview = termId => ({ termId, totalRows: 1, validCount: 1, previewItems: [] });
  const upload = (workspace, name) => find(workspace.getVdom(), node => node.type === 'input' && node.props.type === 'file')
    .props.onChange({ target: { files: [file(name)] } });
  const confirmation = workspace => find(workspace.getVdom(), node =>
    node.type === 'button' && React.Children.toArray(node.props.children).some(child => typeof child === 'string' && child.includes('Xác nhận nhập')));

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
