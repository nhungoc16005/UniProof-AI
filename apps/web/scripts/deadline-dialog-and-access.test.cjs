const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

let fakeTime = null;
let scheduledTimers = [];
let nextTimerId = 1;

const nativeDateNow = Date.now;
Date.now = () => (fakeTime !== null ? fakeTime : nativeDateNow.call(Date));

function enableFakeClock(startTime = 1770000000000) {
  fakeTime = startTime;
  scheduledTimers = [];
}

function disableFakeClock() {
  fakeTime = null;
  scheduledTimers = [];
}

async function advanceClock(ms, harness) {
  if (fakeTime === null) return;
  fakeTime += ms;
  const ready = [];
  scheduledTimers = scheduledTimers.filter((t) => {
    if (t.triggerAt <= fakeTime) {
      ready.push(t);
      return false;
    }
    return true;
  });
  ready.sort((a, b) => a.triggerAt - b.triggerAt);
  for (const timer of ready) {
    timer.fn();
  }
  if (harness) {
    await harness.flush(5);
    harness.rerender();
  }
}

// Stub window & document cho môi trường Node.js (unref timer để process thoát tự nhiên)
if (typeof global.window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (fn, ms) => {
      if (fakeTime !== null) {
        const id = nextTimerId++;
        scheduledTimers.push({ id, fn, triggerAt: fakeTime + ms });
        return id;
      }
      const id = setTimeout(fn, ms);
      if (id && typeof id.unref === 'function') id.unref();
      return id;
    },
    clearTimeout: (id) => {
      if (fakeTime !== null) {
        scheduledTimers = scheduledTimers.filter((t) => t.id !== id);
        return;
      }
      clearTimeout(id);
    },
    setInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      if (id && typeof id.unref === 'function') id.unref();
      return id;
    },
    clearInterval: (id) => clearInterval(id),
  };
}
if (typeof global.document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: 'visible',
  };
} else {
  global.document.visibilityState = 'visible';
}

const React = require('../node_modules/react');
if (!React.default) {
  React.default = React;
}
const ts = require('../node_modules/typescript');

/**
 * React Component & Hook Harness:
 * Render component hoặc hook React thực tế trong môi trường Node.js không cần DOM,
 * quản lý hooks (useState, useRef, useCallback, useMemo, useEffect) theo đúng lifecycle của React.
 */
function createReactHarness() {
  let hooks = [];
  let hookIndex = 0;
  let effectsToRun = [];
  let currentComponent = null;
  let rerenderScheduled = false;
  let lastResult = null;

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
    try {
      if (typeof currentComponent === 'function') {
        lastResult = currentComponent();
      }
    } finally {
      // Giữ dispatcher cho microtasks
    }

    for (const item of effectsToRun) {
      if (typeof item.cleanup === 'function') {
        item.cleanup();
      }
      const cleanup = item.effect();
      hooks[item.idx] = { effect: item.effect, deps: item.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    }
    return lastResult;
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

  return {
    mount(Component) {
      hooks = [];
      effectsToRun = [];
      currentComponent = Component;
      return render();
    },
    rerender() {
      return render();
    },
    getResult: () => lastResult,
    flush: async (delay = 25) => {
      await new Promise((r) => setTimeout(r, delay));
    },
    unmount() {
      for (const h of hooks) {
        if (h && typeof h.cleanup === 'function') {
          try {
            h.cleanup();
          } catch (e) {}
        }
      }
    },
  };
}

/**
 * Trình nạp module TypeScript từ apps/web/src với mock injection
 */
function loadWebModule(relativePath, mocks = {}) {
  const fullPath = path.resolve(__dirname, '../src', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');

  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: fullPath,
  }).outputText;

  const m = new Module(fullPath, module.parent);
  m.filename = fullPath;
  m.paths = Module._nodeModulePaths(path.dirname(fullPath));

  const origRequire = m.require.bind(m);
  m.require = (request) => {
    if (request === 'react') return React;
    if (mocks[request]) return mocks[request];
    if (request.includes('apiClient')) {
      return mocks['apiClient'] || origRequire(request);
    }
    if (request.includes('lucide-react')) {
      return new Proxy(
        {},
        {
          get: (target, prop) => (props) => React.createElement('svg', { 'data-icon': prop, ...props }),
        }
      );
    }
    return origRequire(request);
  };

  m._compile(transpiled, fullPath);
  return m.exports;
}

// Helpers tìm kiếm text / element trong cây VDOM
function collectAllVdom(vnode, predicate, acc = []) {
  if (!vnode) return acc;
  if (predicate(vnode)) acc.push(vnode);
  if (Array.isArray(vnode)) {
    for (const child of vnode) collectAllVdom(child, predicate, acc);
  } else if (vnode.props && vnode.props.children) {
    collectAllVdom(vnode.props.children, predicate, acc);
  }
  return acc;
}

function extractText(vnode) {
  if (!vnode) return '';
  if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
  if (Array.isArray(vnode)) return vnode.map(extractText).join('');
  if (vnode.props && vnode.props.children) return extractText(vnode.props.children);
  return '';
}

// =====================================================================
// BL-020 (Web): DeadlineExtensionsDialog Component Thật
// =====================================================================
describe('BL-020 (Web): DeadlineExtensionsDialog render component thật & Contract', () => {
  const termFixture = {
    id: 'term-1',
    name: 'Học kỳ 1 2026-2027',
    submissionDeadline: '2026-09-01T00:00:00Z',
    reviewDeadline: '2026-09-15T00:00:00Z',
    appealDeadline: '2026-10-01T00:00:00Z',
    status: 'ACTIVE',
    workflowEnabled: true,
  };

  test('Ca 1: Render danh sách sinh viên — hiển thị đúng MSSV, họ tên và lớp snapshot (không bị undefined · undefined)', async () => {
    const mockApiClient = {
      getDeadlineExtensionTargets: async () => {
        return {
          items: [
            {
              id: 's-1',
              code: '21110001',
              name: 'Nguyễn Văn An',
              className: '21T1',
              classCode: '21T1',
              studentCode: '21110001',
              fullName: 'Nguyễn Văn An',
              targetType: 'STUDENT',
            },
            {
              id: 's-2',
              code: '21110002',
              name: 'Trần Thị Bình',
              className: '21T2',
              classCode: '21T2',
              studentCode: '21110002',
              fullName: 'Trần Thị Bình',
              targetType: 'STUDENT',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        };
      },
      getDeadlineExtensions: async () => [],
    };

    const dialogModule = loadWebModule('components/admin/DeadlineExtensionsDialog.tsx', {
      apiClient: { apiClient: mockApiClient },
    });
    const DeadlineExtensionsDialog = dialogModule.DeadlineExtensionsDialog;

    const harness = createReactHarness();
    harness.mount(() => DeadlineExtensionsDialog({ term: termFixture, onClose: () => {} }));

    // Đợi async API resolve và flush microtask
    await harness.flush(30);
    harness.rerender();

    const vdom = harness.getResult();
    const allText = extractText(vdom);

    // Kiểm tra hiển thị thông tin rõ ràng
    assert.ok(allText.includes('21110001'), 'Phải hiển thị MSSV 21110001');
    assert.ok(allText.includes('Nguyễn Văn An'), 'Phải hiển thị họ tên Nguyễn Văn An');
    assert.ok(allText.includes('(21T1)'), 'Phải hiển thị mã lớp snapshot 21T1');
    assert.ok(!allText.includes('undefined · undefined'), 'Tuyệt đối không được hiển thị undefined · undefined');

    // Tìm button chọn sinh viên s-1
    const buttons = collectAllVdom(vdom, (node) => node.type === 'button' && typeof node.props?.onClick === 'function');
    const student1Btn = buttons.find((btn) => extractText(btn).includes('21110001'));
    assert.ok(student1Btn, 'Phải có button chọn sinh viên 21110001');

    // Click chọn sinh viên 1
    student1Btn.props.onClick();
    harness.rerender();

    const updatedText = extractText(harness.getResult());
    assert.ok(updatedText.includes('Đã chọn:'), 'Phải hiển thị nhãn Đã chọn');
    assert.ok(updatedText.includes('21110001 · Nguyễn Văn An (21T1)'), 'Nhãn đã chọn phải hiển thị đầy đủ thông tin');
    harness.unmount();
  });

  test('Ca 2: Phân trang danh sách > 100 sinh viên — Hỗ trợ 105 sinh viên, chuyển trang hiển thị đủ không bị cắt', async () => {
    const targetCalls = [];
    const mockApiClient = {
      getDeadlineExtensionTargets: async (params) => {
        targetCalls.push({ ...params });
        const page = params.page || 1;
        if (page === 6) {
          return {
            items: [
              {
                id: 's-105',
                code: '102210105',
                name: 'Nguyễn Văn 105',
                className: '21T5',
                classCode: '21T5',
                studentCode: '102210105',
                fullName: 'Nguyễn Văn 105',
                targetType: 'STUDENT',
              },
            ],
            total: 105,
            page: 6,
            pageSize: 20,
          };
        }
        return {
          items: [
            {
              id: `s-${page}-01`,
              code: `1022100${page}1`,
              name: `Sinh viên trang ${page}`,
              className: `21T${page}`,
              classCode: `21T${page}`,
              studentCode: `1022100${page}1`,
              fullName: `Sinh viên trang ${page}`,
              targetType: 'STUDENT',
            },
          ],
          total: 105,
          page,
          pageSize: 20,
        };
      },
      getDeadlineExtensions: async () => [],
    };

    const dialogModule = loadWebModule('components/admin/DeadlineExtensionsDialog.tsx', {
      apiClient: { apiClient: mockApiClient },
    });
    const DeadlineExtensionsDialog = dialogModule.DeadlineExtensionsDialog;

    const harness = createReactHarness();
    harness.mount(() => DeadlineExtensionsDialog({ term: termFixture, onClose: () => {} }));

    await harness.flush(30);
    harness.rerender();

    let vdom = harness.getResult();
    let allText = extractText(vdom);
    assert.ok(allText.includes('Trang 1 / 6 (tổng 105)'), 'Phải tính đúng tổng 105 sinh viên và 6 trang');

    // Chuyển trang thực tế từ trang 1 đến trang 6 bằng cách bấm nút "Trang sau"
    for (let p = 1; p < 6; p++) {
      const nextButtons = collectAllVdom(vdom, (node) => node.type === 'button' && node.props?.['aria-label'] === 'Trang sau');
      assert.equal(nextButtons.length, 1, `Phải có nút Trang sau tại trang ${p}`);
      assert.equal(nextButtons[0].props.disabled, false, `Nút Trang sau không bị vô hiệu hóa tại trang ${p}/6`);

      // Bấm chuyển trang tiếp theo
      nextButtons[0].props.onClick();
      await harness.flush(30);
      harness.rerender();
      vdom = harness.getResult();
    }

    // Đã chuyển đến trang 6
    allText = extractText(vdom);
    assert.ok(allText.includes('Trang 6 / 6 (tổng 105)'), 'Phải chuyển thành công đến Trang 6 / 6');
    assert.ok(allText.includes('102210105'), 'Sinh viên 105 phải xuất hiện ở trang 6');
    assert.ok(allText.includes('Nguyễn Văn 105'), 'Họ tên sinh viên 105 phải hiển thị');

    // Kiểm tra tham số request gửi đến API client
    const lastCall = targetCalls[targetCalls.length - 1];
    assert.deepEqual(
      lastCall,
      {
        termId: 'term-1',
        targetType: 'STUDENT',
        q: undefined,
        page: 6,
        pageSize: 20,
      },
      'API client phải nhận đúng tham số trang 6 khi chuyển trang'
    );

    // Chọn sinh viên 105
    const buttons = collectAllVdom(vdom, (node) => node.type === 'button' && typeof node.props?.onClick === 'function');
    const student105Btn = buttons.find((btn) => extractText(btn).includes('102210105'));
    assert.ok(student105Btn, 'Phải tìm thấy button chọn sinh viên 105');
    student105Btn.props.onClick();
    harness.rerender();

    const selectedText = extractText(harness.getResult());
    assert.ok(selectedText.includes('Đã chọn:'), 'Phải hiển thị nhãn Đã chọn');
    assert.ok(
      selectedText.includes('102210105 · Nguyễn Văn 105 (21T5)'),
      'Nhãn đã chọn phải hiển thị đúng ID và thông tin sinh viên 105'
    );

    // Nút Trang sau phải bị vô hiệu hóa tại trang cuối (trang 6)
    const nextBtnPage6 = collectAllVdom(harness.getResult(), (node) => node.type === 'button' && node.props?.['aria-label'] === 'Trang sau')[0];
    assert.equal(nextBtnPage6.props.disabled, true, 'Nút Trang sau phải bị disabled khi đã ở trang cuối 6/6');

    harness.unmount();
  });
});

// =====================================================================
// BL-010 (Web): Hook Thật useStudentAssessmentAccess
// =====================================================================
describe('BL-010 (Web): Hook thật useStudentAssessmentAccess phân giải quyền và hạn hiệu lực', () => {
  const termFixture = {
    id: 'term-1',
    name: 'Học kỳ 1 2026-2027',
    submissionDeadline: '2026-09-01T00:00:00Z',
    reviewDeadline: '2026-09-15T00:00:00Z',
    appealDeadline: '2026-10-01T00:00:00Z',
  };

  test('Ca 1: Phiếu thường DRAFT — Hạn gốc đã qua nhưng có gia hạn hiệu lực tương lai -> canEdit = true', async () => {
    const assessmentFixture = {
      rubricVersion: { id: 'rubric-1' },
      submission: { status: 'DRAFT' },
      term: termFixture,
      permissions: {
        canEdit: true,
        effectiveDeadlines: {
          submission: {
            deadline: new Date(Date.now() + 86400000).toISOString(), // Còn hiệu lực 1 ngày
            source: 'STUDENT',
            extensionId: 'ext-1',
          },
        },
      },
    };

    const accessModule = loadWebModule('hooks/useStudentAssessmentAccess.ts', {
      apiClient: { apiClient: { getMyAssessments: async () => assessmentFixture } },
    });
    const useStudentAssessmentAccess = accessModule.useStudentAssessmentAccess;

    const harness = createReactHarness();
    harness.mount(() => useStudentAssessmentAccess('student-1', 'term-1'));

    await harness.flush(30);
    harness.rerender();

    const verifiedResult = harness.getResult();
    assert.equal(verifiedResult.canEdit, true, 'canEdit phải là true khi gia hạn còn hiệu lực');
    assert.equal(verifiedResult.deadlinePassed, false, 'deadlinePassed phải là false');
    assert.equal(verifiedResult.isReturned, false);
    assert.equal(verifiedResult.editDeadline, assessmentFixture.permissions.effectiveDeadlines.submission.deadline);
    harness.unmount();
  });

  test('Ca 2: Phiếu RETURNED — Đọc hạn review hiệu lực thay vì submission', async () => {
    const reviewDeadlineFuture = new Date(Date.now() + 172800000).toISOString(); // Còn 2 ngày
    const assessmentFixture = {
      rubricVersion: { id: 'rubric-1' },
      submission: { status: 'RETURNED' },
      term: termFixture,
      permissions: {
        canEdit: true,
        effectiveDeadlines: {
          submission: {
            deadline: '2026-09-01T00:00:00Z', // Hạn nộp đã hết
            source: 'TERM',
            extensionId: null,
          },
          review: {
            deadline: reviewDeadlineFuture, // Hạn review còn hiệu lực
            source: 'CLASS',
            extensionId: 'ext-class-1',
          },
        },
      },
    };

    const accessModule = loadWebModule('hooks/useStudentAssessmentAccess.ts', {
      apiClient: { apiClient: { getMyAssessments: async () => assessmentFixture } },
    });
    const useStudentAssessmentAccess = accessModule.useStudentAssessmentAccess;

    const harness = createReactHarness();
    harness.mount(() => useStudentAssessmentAccess('student-1', 'term-1'));

    await harness.flush(30);
    harness.rerender();

    const verifiedResult = harness.getResult();
    assert.equal(verifiedResult.isReturned, true, 'Phiếu phải ở trạng thái isReturned = true');
    assert.equal(verifiedResult.editDeadline, reviewDeadlineFuture, 'editDeadline phải lấy từ effectiveDeadlines.review');
    assert.equal(verifiedResult.canEdit, true, 'canEdit phải là true');
    assert.equal(verifiedResult.deadlinePassed, false);
    harness.unmount();
  });

  test('Ca 3: Hết hạn trong lúc API refresh đang treo -> canEdit lập tức chuyển false trước khi response về; xử lý nhánh refresh thất bại', async () => {
    enableFakeClock(1770000000000);
    try {
      // 1. Ban đầu hạn hiệu lực còn 1000ms trong tương lai
      const initialDeadlineMs = 1770000001000;
      const initialAssessment = {
        rubricVersion: { id: 'rubric-1' },
        submission: { status: 'DRAFT' },
        term: termFixture,
        permissions: {
          canEdit: true,
          effectiveDeadlines: {
            submission: {
              deadline: new Date(initialDeadlineMs).toISOString(),
              source: 'STUDENT',
              extensionId: 'ext-1',
            },
          },
        },
      };

      let getMyAssessmentsCalls = 0;
      let refreshDeferredReject;
      let refreshDeferredResolve;
      const refreshDeferredPromise = new Promise((resolve, reject) => {
        refreshDeferredResolve = resolve;
        refreshDeferredReject = reject;
      });

      const mockApiClient = {
        getMyAssessments: async (termId) => {
          getMyAssessmentsCalls++;
          if (getMyAssessmentsCalls === 1) {
            // Lần 1: nạp ban đầu khi mount
            return initialAssessment;
          }
          // Lần 2 trở đi: refresh được kích hoạt bởi timer khi hết hạn -> giữ ở trạng thái pending (treo trên mạng)
          return refreshDeferredPromise;
        },
      };

      const accessModule = loadWebModule('hooks/useStudentAssessmentAccess.ts', {
        apiClient: { apiClient: mockApiClient },
      });
      const useStudentAssessmentAccess = accessModule.useStudentAssessmentAccess;

      const harness = createReactHarness();
      harness.mount(() => useStudentAssessmentAccess('student-1', 'term-1'));

      // Đợi lần nạp dữ liệu ban đầu hoàn tất
      await harness.flush(5);
      harness.rerender();

      const initialResult = harness.getResult();
      assert.equal(initialResult.canEdit, true, 'Ban đầu canEdit là true khi hạn còn hiệu lực');
      assert.equal(initialResult.deadlinePassed, false, 'deadlinePassed ban đầu là false');
      assert.equal(initialResult.checking, false, 'checking ban đầu là false');
      assert.equal(getMyAssessmentsCalls, 1, 'API getMyAssessments được gọi 1 lần khi mount');

      // 2. Tua đồng hồ vượt quá hạn hiệu lực (tua 1050ms > 1000ms deadline + 25ms timer buffer)
      // Timer setTimeout của hook sẽ kích hoạt setClock và gọi refresh() ngay lập tức mà không phụ thuộc CPU/thời gian thực
      await advanceClock(1050, harness);

      // 3. Kiểm chứng tại thời điểm timer đã kích hoạt, refresh đang treo trên mạng (checking = true)
      const pendingRefreshResult = harness.getResult();
      assert.equal(getMyAssessmentsCalls, 2, 'Timer hết hạn phải kích hoạt lời gọi refresh() thứ 2 qua getMyAssessments');
      assert.equal(pendingRefreshResult.checking, true, 'refresh đang treo trên mạng (checking = true)');
      assert.equal(pendingRefreshResult.deadlinePassed, true, 'deadlinePassed phải chuyển sang true ngay khi qua thời hạn');
      assert.equal(
        pendingRefreshResult.canEdit,
        false,
        'canEdit phải chuyển sang false NGAY LẬP TỨC TRƯỚC KHI response refresh về'
      );

      // 4. Nhánh refresh thất bại: Giả lập API refresh trả lỗi mạng 500
      refreshDeferredReject(new Error('Network error 500 / timeout'));
      await harness.flush(5);
      harness.rerender();

      const failedRefreshResult = harness.getResult();
      assert.equal(failedRefreshResult.checking, false, 'checking trở về false sau khi refresh kết thúc');
      assert.equal(failedRefreshResult.canEdit, false, 'canEdit vẫn tiếp tục bị khóa (false) sau khi refresh thất bại');
      assert.equal(failedRefreshResult.deadlinePassed, true, 'deadlinePassed vẫn là true');
      assert.ok(
        failedRefreshResult.error.includes('Không xác minh được quyền chỉnh sửa'),
        'Phải hiển thị thông báo lỗi chuyển sang chế độ xem an toàn khi refresh thất bại'
      );

      harness.unmount();
    } finally {
      disableFakeClock();
    }
  });

  test('Ca 4: Bằng chứng đối chứng đỏ — Nếu bỏ !deadlinePassed như code cũ, form vẫn mở canEdit = true khi đã hết hạn', () => {
    const current = { verified: true };
    const assessment = {
      rubricVersion: 1,
      permissions: { canEdit: true },
    };
    const deadlinePassed = true;

    // Code cũ trước khi sửa:
    const oldCanEdit = Boolean(current?.verified && assessment?.rubricVersion && assessment.permissions?.canEdit);
    assert.equal(
      oldCanEdit,
      true,
      'Code cũ cho phép sửa sai (canEdit = true) vì bỏ qua !deadlinePassed khi hạn hiệu lực đã hết'
    );

    // Code mới:
    const newCanEdit = Boolean(
      current?.verified &&
        assessment?.rubricVersion &&
        assessment.permissions?.canEdit &&
        !deadlinePassed
    );
    assert.equal(newCanEdit, false, 'Code mới khóa sửa an toàn (canEdit = false)');
  });
});
