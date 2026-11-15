const { test } = require('node:test');
const assert = require('node:assert/strict');

// Harness mô phỏng chính xác logic hooks và lifecycle của EvidenceInspection.tsx
function createEvidenceInspectionHarness(apiClient) {
  const state = {
    id: undefined,
    data: null,
    error: '',
    loading: true,
  };
  const activeRequestIdRef = { current: 0 };

  const loadData = (targetId) => {
    const currentId = typeof targetId === 'string' ? targetId : state.id;
    if (!currentId) {
      state.data = null;
      state.loading = false;
      return Promise.resolve();
    }
    const requestId = ++activeRequestIdRef.current;
    state.loading = true;
    state.error = '';
    state.data = null; // Xóa dữ liệu cũ khi đổi hồ sơ hoặc bắt đầu tải mới

    return apiClient.getEvidenceById(currentId)
      .then((value) => {
        if (requestId === activeRequestIdRef.current) {
          state.data = value;
        }
      })
      .catch((err) => {
        if (requestId === activeRequestIdRef.current) {
          state.error = err?.message || 'Có lỗi xảy ra';
        }
      })
      .finally(() => {
        if (requestId === activeRequestIdRef.current) {
          state.loading = false;
        }
      });
  };

  const changeId = (newId) => {
    // Tương ứng useEffect cleanup khi dependency `id` thay đổi
    activeRequestIdRef.current++;
    state.id = newId;
    return loadData(newId);
  };

  return {
    getState: () => ({ ...state }),
    loadData,
    changeId,
    activeRequestIdRef,
  };
}

// Harness mô phỏng logic của ReviewDetail.tsx
function createReviewDetailHarness(apiClient) {
  const state = {
    id: 'evidence-1',
    evidence: null,
    loadError: '',
    isLoading: true,
  };

  const fetchEvidence = () => {
    if (state.id) {
      state.isLoading = true;
      state.loadError = '';
      return apiClient.getEvidenceById(state.id)
        .then((data) => {
          state.evidence = data;
          state.loadError = '';
          state.isLoading = false;
        })
        .catch(() => {
          state.loadError = 'Không tải được minh chứng.';
          state.isLoading = false;
        });
    }
    return Promise.resolve();
  };

  const setId = (newId) => {
    state.id = newId;
    return fetchEvidence();
  };

  return {
    getState: () => ({ ...state }),
    fetchEvidence,
    setId,
  };
}

test('EvidenceInspection: B trả trước, A trả sau -> màn hình vẫn giữ B, A bị bỏ qua', async () => {
  const delays = { 'evidence-A': 50, 'evidence-B': 10 };
  const apiClient = {
    getEvidenceById: (id) => new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id, declaredActivityName: `Hoạt động của ${id}` });
      }, delays[id] || 0);
    }),
  };

  const harness = createEvidenceInspectionHarness(apiClient);

  // 1. Mở hồ sơ A (chạy mất 50ms)
  const promiseA = harness.changeId('evidence-A');

  // 2. Ngay sau đó (chưa đầy 5ms), người dùng chuyển sang xem hồ sơ B
  await new Promise(r => setTimeout(r, 5));
  const promiseB = harness.changeId('evidence-B');

  // Đợi cả 2 promise hoàn tất (B sau 10ms, A sau 50ms)
  await Promise.all([promiseA, promiseB]);

  const state = harness.getState();
  assert.equal(state.id, 'evidence-B');
  assert.notEqual(state.data, null);
  assert.equal(state.data.id, 'evidence-B', 'Dữ liệu hiển thị phải là của B, không bị A đè lên');
  assert.equal(state.data.declaredActivityName, 'Hoạt động của evidence-B');
  assert.equal(state.loading, false);
  assert.equal(state.error, '');
});

test('EvidenceInspection: Khi đổi sang hồ sơ B, dữ liệu cũ của A bị xóa ngay lập tức', async () => {
  let resolveA;
  const apiClient = {
    getEvidenceById: (id) => new Promise((resolve) => {
      if (id === 'evidence-A') {
        resolveA = () => resolve({ id: 'evidence-A', declaredActivityName: 'A' });
      } else {
        setTimeout(() => resolve({ id: 'evidence-B', declaredActivityName: 'B' }), 10);
      }
    }),
  };

  const harness = createEvidenceInspectionHarness(apiClient);

  // Mở A và chờ A tải xong
  const promiseA = harness.changeId('evidence-A');
  resolveA();
  await promiseA;

  assert.equal(harness.getState().data?.id, 'evidence-A');

  // Chuyển sang B
  const promiseB = harness.changeId('evidence-B');

  // Kiểm tra ngay lập tức: data cũ của A phải bị xóa (null) và loading bật lại
  const intermediateState = harness.getState();
  assert.equal(intermediateState.data, null, 'Data phải là null trong khi đang tải B');
  assert.equal(intermediateState.loading, true, 'Loading phải bật true khi tải hồ sơ mới');

  await promiseB;
  assert.equal(harness.getState().data?.id, 'evidence-B');
});

test('EvidenceInspection: Tải lại lần 1 trễ, tải lại lần 2 trả nhanh -> kết quả lần 1 bị bỏ qua', async () => {
  let callCount = 0;
  const apiClient = {
    getEvidenceById: () => {
      callCount++;
      const currentCall = callCount;
      return new Promise((resolve) => {
        // Lần 1 trễ 40ms, lần 2 trễ 10ms
        const delay = currentCall === 1 ? 40 : 10;
        setTimeout(() => {
          resolve({ id: 'evidence-1', version: currentCall });
        }, delay);
      });
    },
  };

  const harness = createEvidenceInspectionHarness(apiClient);
  await harness.changeId('evidence-1'); // Tải ban đầu xong (version 1)

  // Gọi thử tải lại lần 1 (sẽ là call 2, delay 40ms)
  const retry1 = harness.loadData();
  // Ngay sau 5ms, bấm thử tải lại lần 2 (sẽ là call 3, delay 10ms)
  await new Promise(r => setTimeout(r, 5));
  const retry2 = harness.loadData();

  await Promise.all([retry1, retry2]);

  const finalState = harness.getState();
  assert.equal(finalState.data?.version, 3, 'Phải hiển thị dữ liệu của lần tải lại mới nhất (call 3)');
});

test('EvidenceInspection: Lỗi của request cũ về muộn không ghi đè vào hồ sơ mới', async () => {
  const apiClient = {
    getEvidenceById: (id) => new Promise((resolve, reject) => {
      if (id === 'evidence-A') {
        setTimeout(() => reject(new Error('Lỗi mạng tại hồ sơ A')), 40);
      } else {
        setTimeout(() => resolve({ id: 'evidence-B' }), 10);
      }
    }),
  };

  const harness = createEvidenceInspectionHarness(apiClient);
  const pA = harness.changeId('evidence-A');
  await new Promise(r => setTimeout(r, 5));
  const pB = harness.changeId('evidence-B');

  await Promise.allSettled([pA, pB]);

  const state = harness.getState();
  assert.equal(state.data?.id, 'evidence-B');
  assert.equal(state.error, '', 'Lỗi từ A về muộn không được ghi vào error của B');
});

test('ReviewDetail: Xóa thông báo lỗi sau khi thử lại thành công', async () => {
  let shouldFail = true;
  const apiClient = {
    getEvidenceById: (id) => new Promise((resolve, reject) => {
      if (shouldFail) {
        reject(new Error('Mạng chập chờn'));
      } else {
        resolve({ id, declaredActivityName: 'Minh chứng hợp lệ' });
      }
    }),
  };

  const harness = createReviewDetailHarness(apiClient);

  // Lần 1: fetch thất bại
  await harness.fetchEvidence();
  let state = harness.getState();
  assert.equal(state.loadError, 'Không tải được minh chứng.', 'Phải hiển thị thông báo lỗi khi tải thất bại');
  assert.equal(state.evidence, null);

  // Lần 2: mạng phục hồi, bấm "Thử tải lại"
  shouldFail = false;
  await harness.fetchEvidence();

  state = harness.getState();
  assert.equal(state.loadError, '', 'Thông báo lỗi phải được xóa sạch sau khi thử lại thành công');
  assert.notEqual(state.evidence, null);
  assert.equal(state.evidence.id, 'evidence-1');
});
