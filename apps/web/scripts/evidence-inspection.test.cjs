const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Cung cấp stub window cho môi trường Node.js (dành cho hotkey addEventListener trong ReviewDetail)
if (typeof global.window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

const React = require('../node_modules/react');
const ts = require('../node_modules/typescript');

/**
 * Deferred Promise hỗ trợ điều khiển thủ công thời điểm resolve/reject
 */
function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * React Component Harness:
 * Render component React thực tế của ứng dụng trong môi trường Node.js không cần DOM,
 * quản lý hooks (useState, useRef, useCallback, useMemo, useEffect) theo đúng lifecycle của React.
 */
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
    }
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
      await new Promise(r => setTimeout(r, delay));
    }
  };
}

/**
 * Duyệt đệ quy cây VDOM tìm node thỏa mãn điều kiện
 */
function findInVdom(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const res = findInVdom(child, predicate);
      if (res) return res;
    }
  }
  if (node && typeof node === 'object' && node.props) {
    if (node.props.children) {
      const res = findInVdom(node.props.children, predicate);
      if (res) return res;
    }
  }
  return null;
}

/**
 * Nạp component thực tế từ TypeScript source file kèm module mock giả lập
 */
function loadRealComponent(filePath, mockModules = {}) {
  const file = path.resolve(__dirname, filePath);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true
    }
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
// TEST SUITE: Component thực tế EvidenceInspection & ReviewDetail
// =========================================================================

test('EvidenceInspection (component thật): B trả trước, A trả sau -> màn hình vẫn giữ B, A bị bỏ qua', async () => {
  let currentParams = { id: 'evidence-A' };
  const deferredA = createDeferred();
  const deferredB = createDeferred();

  const mockApiClient = {
    getEvidenceById: (id) => {
      if (id === 'evidence-A') return deferredA.promise;
      if (id === 'evidence-B') return deferredB.promise;
      return Promise.reject(new Error('Unknown id: ' + id));
    }
  };

  const { EvidenceInspection } = loadRealComponent('../src/components/EvidenceInspection.tsx', {
    'react-router-dom': {
      useParams: () => currentParams,
      useSearchParams: () => [new URLSearchParams()],
      Link: ({ children }) => React.createElement('a', null, children)
    },
    '../lib/apiClient': { apiClient: mockApiClient },
    './EvaluationBoard': { errorMessage: (e) => e?.message || 'Có lỗi xảy ra' },
    './ui/StatusBadge': { StatusBadge: () => null }
  });

  const harness = createReactHarness();

  // 1. Mount component thật với ID = evidence-A (đang chờ Deferred A)
  harness.mount(EvidenceInspection);

  // 2. Người dùng chuyển route sang xem evidence-B (đang chờ Deferred B)
  currentParams = { id: 'evidence-B' };
  harness.rerender();

  // 3. Điều khiển thủ công: Cho Deferred B hoàn thành TRƯỚC
  deferredB.resolve({
    id: 'evidence-B',
    declaredActivityName: 'Hoạt động của B',
    files: []
  });
  await harness.flush();

  let titleNode = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(titleNode?.props?.children, 'Hoạt động của B', 'Màn hình phải hiển thị nội dung hồ sơ B');

  // 4. Bây giờ mới cho Deferred A hoàn thành SAU
  deferredA.resolve({
    id: 'evidence-A',
    declaredActivityName: 'Hoạt động của A cũ bị trễ',
    files: []
  });
  await harness.flush();

  // 5. Kiểm tra: Component thật phải drop phản hồi của A, giữ nguyên B
  titleNode = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(
    titleNode?.props?.children,
    'Hoạt động của B',
    'Phản hồi muộn của hồ sơ A không được ghi đè lên hồ sơ B'
  );
  harness.unmount();
});

test('EvidenceInspection (component thật): Khi đổi sang hồ sơ B, dữ liệu cũ của A bị xóa ngay lập tức', async () => {
  let currentParams = { id: 'evidence-A' };
  let deferredA = createDeferred();
  let deferredB = createDeferred();

  const mockApiClient = {
    getEvidenceById: (id) => {
      if (id === 'evidence-A') return deferredA.promise;
      if (id === 'evidence-B') return deferredB.promise;
      return Promise.reject(new Error('Unknown id'));
    }
  };

  const { EvidenceInspection } = loadRealComponent('../src/components/EvidenceInspection.tsx', {
    'react-router-dom': {
      useParams: () => currentParams,
      useSearchParams: () => [new URLSearchParams()],
      Link: ({ children }) => React.createElement('a', null, children)
    },
    '../lib/apiClient': { apiClient: mockApiClient },
    './EvaluationBoard': { errorMessage: (e) => e?.message || 'Có lỗi' },
    './ui/StatusBadge': { StatusBadge: () => null }
  });

  const harness = createReactHarness();
  harness.mount(EvidenceInspection);

  // Cho A tải xong
  deferredA.resolve({ id: 'evidence-A', declaredActivityName: 'Hoạt động A' });
  await harness.flush();

  let title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(title?.props?.children, 'Hoạt động A');

  // Đổi sang B
  currentParams = { id: 'evidence-B' };
  harness.rerender();
  await harness.flush();

  // Kiểm tra: dữ liệu cũ của A phải bị xóa (không còn h2), hiển thị trạng thái đang tải
  title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(title, null, 'Dữ liệu của A phải bị xóa ngay lập tức khi chuyển sang B');

  const loadingText = findInVdom(harness.getVdom(), n => n?.props?.role === 'status');
  assert.notEqual(loadingText, null, 'Phải hiển thị trạng thái đang tải hồ sơ B');

  // Cho B giải quyết xong
  deferredB.resolve({ id: 'evidence-B', declaredActivityName: 'Hoạt động B' });
  await harness.flush();

  title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(title?.props?.children, 'Hoạt động B');
  harness.unmount();
});

test('EvidenceInspection (component thật): Thử tải lại thủ công - retry 2 hoàn thành trước, retry 1 trả về sau không ghi đè', async () => {
  let callCount = 0;
  let retryDeferred1 = null;
  let retryDeferred2 = null;

  const mockApiClient = {
    getEvidenceById: (id) => {
      callCount++;
      if (callCount === 1) {
        // Tải ban đầu: có tệp chưa ký để component hiển thị nút "Thử tải lại"
        return Promise.resolve({
          id,
          declaredActivityName: 'Bản ban đầu',
          files: [{ id: 'f1', fileName: 'minh-chung.pdf', fileUrl: 'evidence/1.pdf', signedUrlAvailable: false }]
        });
      }
      if (callCount === 2) {
        retryDeferred1 = createDeferred();
        return retryDeferred1.promise;
      }
      if (callCount === 3) {
        retryDeferred2 = createDeferred();
        return retryDeferred2.promise;
      }
      return Promise.reject(new Error('Unexpected call'));
    }
  };

  const { EvidenceInspection } = loadRealComponent('../src/components/EvidenceInspection.tsx', {
    'react-router-dom': {
      useParams: () => ({ id: 'ev-test-1' }),
      useSearchParams: () => [new URLSearchParams()],
      Link: ({ children }) => React.createElement('a', null, children)
    },
    '../lib/apiClient': { apiClient: mockApiClient },
    './EvaluationBoard': { errorMessage: (e) => e?.message || 'Có lỗi' },
    './ui/StatusBadge': { StatusBadge: () => null }
  });

  const harness = createReactHarness();
  harness.mount(EvidenceInspection);
  await harness.flush();

  // Tìm nút "Thử tải lại" trong VDOM render thực tế của component
  const retryBtn = findInVdom(harness.getVdom(), n => n?.type === 'button' && JSON.stringify(n).includes('Thử tải lại'));
  assert.notEqual(retryBtn, null, 'Component phải render nút Thử tải lại khi có tệp chưa ký URL');

  // 1. Người dùng bấm "Thử tải lại" lần 1 (request đang chờ xử lý trên mạng)
  retryBtn.props.onClick();
  assert.equal(callCount, 2, 'API phải được gọi cho lần thử tải lại 1');

  // 2. Người dùng sốt ruột bấm tiếp "Thử tải lại" lần 2 (request 2 cũng được gửi đi)
  retryBtn.props.onClick();
  assert.equal(callCount, 3, 'API phải được gọi cho lần thử tải lại 2');

  // 3. Điều khiển thủ công: Cho retry 2 hoàn thành TRƯỚC với dữ liệu mới
  retryDeferred2.resolve({
    id: 'ev-test-1',
    declaredActivityName: 'Bản tải lại v2 (mới nhất)',
    files: [{ id: 'f1', fileName: 'minh-chung.pdf', fileUrl: 'https://storage/signed-v2.pdf', signedUrlAvailable: true }]
  });
  await harness.flush();

  let title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(title?.props?.children, 'Bản tải lại v2 (mới nhất)', 'Màn hình phải cập nhật dữ liệu của retry 2');

  // 4. Bây giờ mới cho retry 1 hoàn thành SAU với dữ liệu cũ
  retryDeferred1.resolve({
    id: 'ev-test-1',
    declaredActivityName: 'Bản tải lại v1 (cũ bị trễ)',
    files: [{ id: 'f1', fileName: 'minh-chung.pdf', fileUrl: 'evidence/1.pdf', signedUrlAvailable: false }]
  });
  await harness.flush();

  // 5. Kiểm tra: Dữ liệu trên màn hình VẪN PHẢI GIỮ bản v2, không bị bản v1 cũ đè lên
  title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(
    title?.props?.children,
    'Bản tải lại v2 (mới nhất)',
    'Phản hồi của lần thử tải lại cũ trả về sau tuyệt đối không được ghi đè dữ liệu mới'
  );
  harness.unmount();
});

test('EvidenceInspection (component thật): Lỗi mạng của request A cũ về muộn không ghi đè vào hồ sơ B', async () => {
  let currentParams = { id: 'evidence-A' };
  const deferredA = createDeferred();
  const deferredB = createDeferred();

  const mockApiClient = {
    getEvidenceById: (id) => {
      if (id === 'evidence-A') return deferredA.promise;
      if (id === 'evidence-B') return deferredB.promise;
      return Promise.reject(new Error('Unknown'));
    }
  };

  const { EvidenceInspection } = loadRealComponent('../src/components/EvidenceInspection.tsx', {
    'react-router-dom': {
      useParams: () => currentParams,
      useSearchParams: () => [new URLSearchParams()],
      Link: ({ children }) => React.createElement('a', null, children)
    },
    '../lib/apiClient': { apiClient: mockApiClient },
    './EvaluationBoard': { errorMessage: (e) => e?.message || 'Có lỗi' },
    './ui/StatusBadge': { StatusBadge: () => null }
  });

  const harness = createReactHarness();
  harness.mount(EvidenceInspection);

  // Đổi sang B
  currentParams = { id: 'evidence-B' };
  harness.rerender();

  // B trả về thành công
  deferredB.resolve({ id: 'evidence-B', declaredActivityName: 'Hoạt động B' });
  await harness.flush();

  // Sau đó A bị lỗi mạng
  deferredA.reject(new Error('Mạng đứt tại hồ sơ A'));
  await harness.flush();

  // Màn hình vẫn hiển thị B và không có alert error
  const title = findInVdom(harness.getVdom(), n => n?.type === 'h2');
  assert.equal(title?.props?.children, 'Hoạt động B');

  const alertNode = findInVdom(harness.getVdom(), n => n?.props?.role === 'alert');
  assert.equal(alertNode, null, 'Lỗi của hồ sơ A cũ không được hiển thị trên hồ sơ B');
  harness.unmount();
});

test('ReviewDetail (component thật): Sau khi thử tải lại thành công, thông báo lỗi loadError được xóa sạch hoàn toàn', async () => {
  let shouldFail = false;

  const mockApiClient = {
    getEvidenceById: async (id) => {
      if (shouldFail) throw new Error('Mạng bị ngắt');
      return {
        id,
        declaredActivityName: 'Minh chứng duyệt ' + id,
        studentId: 'student-1',
        termId: 'term-1',
        status: 'SUBMITTED',
        files: [{ id: 'f1', fileUrl: 'evidence/test.pdf', signedUrlAvailable: false }]
      };
    },
    getRubric: async () => ({ id: 'r1', categories: [] })
  };

  const { ReviewDetail } = loadRealComponent('../src/pages/officer/ReviewDetail.tsx', {
    'react-router-dom': {
      useParams: () => ({ id: 'ev-review-1' }),
      useNavigate: () => () => {},
      useSearchParams: () => [new URLSearchParams()],
      Link: ({ children }) => React.createElement('a', null, children)
    },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '../../lib/apiClient': { apiClient: mockApiClient },
    '../../components/ui/StatusBadge': { StatusBadge: () => null },
    '../../components/ui/VerificationBadge': { VerificationBadge: () => null, TwoQuestionsVerification: () => null },
    '../../components/ui/ConfidenceBar': { ConfidenceBar: () => null }
  });

  const harness = createReactHarness();

  // 1. Tải ban đầu thành công (có file chưa ký, hiển thị nút "Thử tải lại")
  harness.mount(ReviewDetail);
  await harness.flush();

  let alertNode = findInVdom(harness.getVdom(), n => n?.props?.role === 'alert');
  assert.equal(alertNode, null, 'Ban đầu không có thông báo lỗi');

  const retryBtn = findInVdom(harness.getVdom(), n => n?.type === 'button' && JSON.stringify(n).includes('Thử tải lại'));
  assert.notEqual(retryBtn, null, 'Màn hình cán bộ phải hiển thị nút Thử tải lại khi có tệp chưa ký');

  // 2. Mạng bị ngắt, người dùng bấm "Thử tải lại" -> thất bại
  shouldFail = true;
  retryBtn.props.onClick();
  await harness.flush();

  alertNode = findInVdom(harness.getVdom(), n => n?.props?.role === 'alert');
  assert.notEqual(alertNode, null, 'Phải hiển thị alert cảnh báo lỗi sau khi thử tải lại thất bại');
  assert.equal(alertNode?.props?.children, 'Không tải được minh chứng.');

  // 3. Mạng phục hồi, người dùng bấm "Thử tải lại" lần nữa -> thành công
  shouldFail = false;
  retryBtn.props.onClick();
  await harness.flush();

  // 4. Kiểm tra: setLoadError('') đã được gọi, thông báo lỗi phải biến mất hoàn toàn
  alertNode = findInVdom(harness.getVdom(), n => n?.props?.role === 'alert');
  assert.equal(alertNode, null, 'Thông báo lỗi phải được xóa sạch hoàn toàn sau khi thử tải lại thành công');

  harness.unmount();
});
