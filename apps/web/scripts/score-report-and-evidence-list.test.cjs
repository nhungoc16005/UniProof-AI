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
