const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { evaluateRubricCriterion } = require('../src/criteria/rubric-scoring');
const { DUT_RUBRIC_CRITERIA, assertDutRubricTotals } = require('../src/criteria/dut-rubric');
const { validateScoringConfig } = require('../src/criteria/criteria.service');
const { validateVerifiedData, AssessmentsService } = require('../src/assessments/assessments.service');
const { HttpExceptionFilter } = require('../src/common/filters/http-exception.filter');
const { BadRequestException } = require('@nestjs/common');

// =====================================================================
// ĐỢT 4 TEST SUITE TOÀN DIỆN: BL-003, BL-004, BL-017
// =====================================================================

describe('BL-003: Cấu hình baseScore tiêu chí 2 & Validator scoringConfig', () => {
  const criterion2 = DUT_RUBRIC_CRITERIA.find((c) => c.code === '2');

  test('DUT_RUBRIC_CRITERIA tiêu chí 2 đã có baseScore: 3 và tổng điểm khung I đúng 20', () => {
    assert.ok(criterion2, 'Phải tìm thấy tiêu chí 2 trong DUT_RUBRIC_CRITERIA');
    assert.equal(criterion2.scoringConfig.baseScore, 3, 'Tiêu chí 2 phải có baseScore là 3');
    assert.doesNotThrow(() => assertDutRubricTotals(), 'assertDutRubricTotals không được ném lỗi');
  });

  test('Ca 1: Không vi phạm (0 vắng không lý do, 0 vắng có lý do, 0 trễ hạn) -> 3 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 0,
      excusedAbsences: 0,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 3);
  });

  test('Ca 2: Vắng không lý do 1 lần -> 1 điểm (3 - 1*2 = 1)', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 1,
      excusedAbsences: 0,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 1);
  });

  test('Ca 3: Vắng có lý do 1 lần -> 3 điểm (lần 1 không trừ)', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 0,
      excusedAbsences: 1,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 3);
  });

  test('Ca 4: Vắng có lý do 2 lần -> 2 điểm (trừ 1 điểm từ lần thứ 2)', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 0,
      excusedAbsences: 2,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 2);
  });

  test('Ca 5: Trễ hạn nội dung nhóm (missedGroupDeadlines > 0) -> trừ hết điểm (0 điểm)', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 0,
      excusedAbsences: 0,
      missedGroupDeadlines: 1,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 0);
  });

  test('Ca 6: Điểm trừ vượt trần (vắng không lý do 3 lần -> 3 - 6 = -3) -> giới hạn 0 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion2.maxScore, criterion2.scoringConfig, {
      unexcusedAbsences: 3,
      excusedAbsences: 0,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 0);
  });

  test('Cấu hình thiếu baseScore trong DB cũ -> trả NEEDS_VERIFICATION rõ ràng, không crash', () => {
    const badConfig = {
      kind: 'group_penalty',
      requiredData: ['unexcusedAbsences', 'excusedAbsences', 'missedGroupDeadlines'],
      unexcusedPenalty: 2,
      excusedPenaltyFromSecond: 1,
    };
    const evalResult = evaluateRubricCriterion(3, badConfig, {
      unexcusedAbsences: 0,
      excusedAbsences: 0,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'NEEDS_VERIFICATION');
    assert.equal(evalResult.suggestedScore, null);
    assert.match(evalResult.reason, /thiếu hoặc sai baseScore/i);
  });

  test('Validator validateScoringConfig từ chối lưu rubric nếu group_penalty hoặc attendance_penalty thiếu baseScore', () => {
    // Thiếu baseScore trong group_penalty
    assert.throws(
      () => {
        validateScoringConfig('2', 3, {
          kind: 'group_penalty',
          requiredData: ['unexcusedAbsences', 'excusedAbsences', 'missedGroupDeadlines'],
          unexcusedPenalty: 2,
          excusedPenaltyFromSecond: 1,
        });
      },
      (err) => err instanceof BadRequestException && /baseScore là số không âm/i.test(err.message),
    );

    // baseScore âm
    assert.throws(
      () => {
        validateScoringConfig('1', 6, {
          kind: 'attendance_penalty',
          requiredData: ['examBans', 'classWarnings'],
          baseScore: -5,
          examBanPenalty: 3,
          warningPenalty: 1,
        });
      },
      (err) => err instanceof BadRequestException && /baseScore là số không âm/i.test(err.message),
    );
  });

  test('Điểm 1: all_conditions thiếu communityViolations trong requiredData bị validateScoringConfig từ chối', () => {
    assert.throws(
      () => {
        validateScoringConfig('11', 10, {
          kind: 'all_conditions',
          requiredData: ['healthInsurance', 'residenceDeclaration'], // thiếu communityViolations
          passScore: 10,
          failScore: 0,
        });
      },
      (err) => err instanceof BadRequestException && /thiếu requiredData 'communityViolations'/i.test(err.message),
    );
  });

  test('Điểm 1: Cấu hình all_conditions cũ thiếu khai báo nhưng data thiếu communityViolations -> trả NEEDS_VERIFICATION, không cho 10 điểm', () => {
    // Giả lập cấu hình cũ trong DB chỉ có healthInsurance và residenceDeclaration
    const badOldConfig = {
      kind: 'all_conditions',
      requiredData: ['healthInsurance', 'residenceDeclaration'],
      passScore: 10,
      failScore: 0,
    };
    // Truyền dữ liệu thiếu communityViolations
    const evalResult = evaluateRubricCriterion(10, badOldConfig, {
      healthInsurance: true,
      residenceDeclaration: true,
    });
    assert.equal(evalResult.status, 'NEEDS_VERIFICATION', 'Phải trả NEEDS_VERIFICATION khi thiếu số vi phạm');
    assert.equal(evalResult.suggestedScore, null);
    assert.match(evalResult.reason, /communityViolations/i);
  });

  test('Điểm 1: Dữ liệu null hoặc undefined cho trường bắt buộc của công thức đều trả NEEDS_VERIFICATION', () => {
    const validConfig = DUT_RUBRIC_CRITERIA.find((c) => c.code === '11').scoringConfig;
    // communityViolations = null
    const evalNull = evaluateRubricCriterion(10, validConfig, {
      healthInsurance: true,
      residenceDeclaration: true,
      communityViolations: null,
    });
    assert.equal(evalNull.status, 'NEEDS_VERIFICATION');
    assert.equal(evalNull.suggestedScore, null);

    // healthInsurance = undefined
    const evalUndefined = evaluateRubricCriterion(10, validConfig, {
      healthInsurance: undefined,
      residenceDeclaration: true,
      communityViolations: 0,
    });
    assert.equal(evalUndefined.status, 'NEEDS_VERIFICATION');
    assert.equal(evalUndefined.suggestedScore, null);
  });

  test('Điểm 2: Cấu hình cũ lỗi tiers: [null] trong activity_threshold không làm evaluator crash', () => {
    const brokenConfig = {
      kind: 'activity_threshold',
      requiredData: ['verifiedActivityCount'],
      tiers: [null],
    };
    const evalResult = evaluateRubricCriterion(5, brokenConfig, { verifiedActivityCount: 2 });
    assert.equal(evalResult.status, 'NEEDS_VERIFICATION');
    assert.equal(evalResult.suggestedScore, null);
    assert.match(evalResult.reason, /cấu hình tiêu chí không hợp lệ/i);
  });

  test('Điểm 2: Cấu hình cũ lỗi tiers: [null] trong community_activity_tier không làm evaluator crash', () => {
    const brokenConfig = {
      kind: 'community_activity_tier',
      requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
      tiers: [null],
    };
    const evalResult = evaluateRubricCriterion(10, brokenConfig, {
      verifiedActivityCount: 2,
      convertedCommunityPoints: 10,
    });
    assert.equal(evalResult.status, 'NEEDS_VERIFICATION');
    assert.equal(evalResult.suggestedScore, null);
    assert.match(evalResult.reason, /cấu hình tiêu chí không hợp lệ/i);
  });

  test('Đối chứng đỏ: Cấu hình cũ không có baseScore nếu tính theo công thức cũ sẽ ra NaN', () => {
    const oldConfigWithoutBaseScore = {
      kind: 'group_penalty',
      requiredData: ['unexcusedAbsences', 'excusedAbsences', 'missedGroupDeadlines'],
      unexcusedPenalty: 2,
      excusedPenaltyFromSecond: 1,
    };
    const naiveCalc = Number(oldConfigWithoutBaseScore.baseScore) - 0 * 2;
    assert.ok(Number.isNaN(naiveCalc), 'Code cũ không có baseScore tính ra NaN');
  });
});

describe('BL-004: Đồng bộ kiểu leadershipRole boolean giữa Web & Backend', () => {
  const criterion14 = DUT_RUBRIC_CRITERIA.find((c) => c.code === '14');
  const criterion16 = DUT_RUBRIC_CRITERIA.find((c) => c.code === '16');

  test('Tiêu chí 14: leadershipRole = true, collectiveApprovalPercent = 95, advisorConfirmation = true -> 4 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion14.maxScore, criterion14.scoringConfig, {
      leadershipRole: true,
      collectiveApprovalPercent: 95,
      advisorConfirmation: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 4);
  });

  test('Tiêu chí 14: Đúng 90% (collectiveApprovalPercent = 90.0) -> 0 điểm (yêu cầu trên 90%)', () => {
    const evalResult = evaluateRubricCriterion(criterion14.maxScore, criterion14.scoringConfig, {
      leadershipRole: true,
      collectiveApprovalPercent: 90.0,
      advisorConfirmation: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 0);
  });

  test('Tiêu chí 14: 90.1% (> 90%) -> 4 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion14.maxScore, criterion14.scoringConfig, {
      leadershipRole: true,
      collectiveApprovalPercent: 90.1,
      advisorConfirmation: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 4);
  });

  test('Tiêu chí 14: leadershipRole = false -> 0 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion14.maxScore, criterion14.scoringConfig, {
      leadershipRole: false,
      collectiveApprovalPercent: 95,
      advisorConfirmation: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 0);
  });

  test('Tiêu chí 16: leadershipRole = true và institutionAwardEvidence = true -> 3 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion16.maxScore, criterion16.scoringConfig, {
      leadershipRole: true,
      institutionAwardEvidence: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 3);
  });

  test('Tiêu chí 16: leadershipRole = false -> 0 điểm', () => {
    const evalResult = evaluateRubricCriterion(criterion16.maxScore, criterion16.scoringConfig, {
      leadershipRole: false,
      institutionAwardEvidence: true,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 0);
  });

  test('Chuỗi string "true" cho leadershipRole bị backend validator từ chối với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(criterion14.scoringConfig, {
          leadershipRole: 'true',
          collectiveApprovalPercent: 95,
          advisorConfirmation: true,
        }, 4);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        const fieldErr = resp.details.fields.find((f) => f.field === 'leadershipRole');
        assert.ok(fieldErr, 'Phải có lỗi cho trường leadershipRole');
        return true;
      },
    );
  });

  test('Điểm 5: Render component thật CriterionCard từ StudentAssessment.tsx — Thao tác Có/Không gửi đúng boolean', async () => {
    const ts = require(path.resolve(__dirname, '../../web/node_modules/typescript'));
    const React = require(path.resolve(__dirname, '../../web/node_modules/react'));
    if (!React.default) React.default = React;
    const sourcePath = path.resolve(__dirname, '../../web/src/pages/officer/StudentAssessment.tsx');
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');

    const transpiled = ts.transpileModule(sourceCode, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
      fileName: sourcePath,
    }).outputText;

    let capturedPayload = null;
    const mockApiClient = {
      verifyCriterion: async (studentId, termId, criterionId, body) => {
        capturedPayload = body;
        return { success: true };
      },
    };

    const moduleObj = { exports: {} };
    const sandboxContext = vm.createContext({
      require: (id) => {
        if (id === 'react') return React;
        if (id.includes('apiClient')) return { apiClient: mockApiClient };
        if (id.includes('AuthContext')) return { useAuth: () => ({ user: { id: 'staff-1', role: 'STAFF' } }) };
        if (id.includes('lucide-react')) return new Proxy({}, { get: () => (props) => React.createElement('span', props) });
        if (id === 'react-router-dom') return { Link: (props) => React.createElement('a', props), useParams: () => ({}), useSearchParams: () => [new URLSearchParams(), () => {}] };
        return {};
      },
      module: moduleObj,
      exports: moduleObj.exports,
      console,
      setTimeout,
      clearTimeout,
    });
    vm.runInContext(transpiled, sandboxContext);

    const { CriterionCard } = moduleObj.exports;
    assert.equal(typeof CriterionCard, 'function', 'Phải export CriterionCard từ StudentAssessment.tsx');

    // Tạo mini React dispatcher để render và invoke action của component thật
    let stateSlots = [];
    let stateIdx = 0;
    const currentDispatcher = {
      useState: (init) => {
        const i = stateIdx++;
        if (stateSlots[i] === undefined) {
          stateSlots[i] = typeof init === 'function' ? init() : init;
        }
        const setter = (val) => {
          stateSlots[i] = typeof val === 'function' ? val(stateSlots[i]) : val;
        };
        return [stateSlots[i], setter];
      },
      useEffect: (fn) => fn(),
      useRef: (init) => ({ current: init }),
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
    };

    const origDispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current;
    if (React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher) {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = currentDispatcher;
    }

    const testCriterion = {
      id: 'crit-14',
      code: '14',
      name: 'Hoàn thành tốt nhiệm vụ cán bộ lớp',
      maxScore: 4,
      scoringConfig: {
        kind: 'leadership_duty',
        requiredData: ['leadershipRole', 'collectiveApprovalPercent', 'advisorConfirmation'],
        passScore: 4,
      },
    };

    const props = {
      studentId: 'student-1',
      termId: 'term-1',
      criterion: testCriterion,
      assessment: {
        id: 'asmt-1',
        verifiedData: {},
        verificationNote: 'Căn cứ quyết định BCH',
      },
      readOnly: false,
      onSaved: async () => {},
    };

    function findNodes(node, predicate, acc = []) {
      if (!node) return acc;
      if (Array.isArray(node)) {
        for (const child of node) findNodes(child, predicate, acc);
        return acc;
      }
      if (typeof node === 'object') {
        if (predicate(node)) acc.push(node);
        if (node.props?.children) findNodes(node.props.children, predicate, acc);
      }
      return acc;
    }

    // Render 1
    stateSlots = [];
    stateIdx = 0;
    let rendered = CriterionCard(props);

    // Tìm select của leadershipRole (select đầu tiên) và chọn "Có" (value = 'true')
    const selects = findNodes(rendered, (n) => n.type === 'select');
    assert.ok(selects.length >= 1, 'Phải render các dropdown select');
    selects[0].props.onChange({ target: { value: 'true' } });

    // Rerender lần 2 với state mới sau onChange
    stateIdx = 0;
    rendered = CriterionCard(props);

    // Tìm nút lưu và click
    const saveButtons = findNodes(rendered, (n) => n.type === 'button');
    assert.ok(saveButtons.length >= 1, 'Phải render nút lưu trong component');
    await saveButtons[0].props.onClick();

    assert.ok(capturedPayload, 'Phải ghi nhận payload gửi verifyCriterion');
    assert.strictEqual(capturedPayload.data.leadershipRole, true, 'leadershipRole phải là boolean true');
    assert.strictEqual(typeof capturedPayload.data.leadershipRole, 'boolean', 'Kiểu dữ liệu gửi đi BẮT BUỘC là boolean');

    if (origDispatcher) {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = origDispatcher;
    }
  });
});

describe('BL-017: Validation dữ liệu xác minh đầu vào & Loại bỏ ép 0 sai lệch', () => {
  const criterion1 = DUT_RUBRIC_CRITERIA.find((c) => c.code === '1');

  test('Bộ đếm âm (ví dụ: unexcusedAbsences = -2) bị từ chối với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(null, { unexcusedAbsences: -2 }, 3);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'unexcusedAbsences'));
        return true;
      },
    );
  });

  test('Bộ đếm là số thập phân (ví dụ: examBans = 1.5) bị từ chối với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(null, { examBans: 1.5 }, 6);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'examBans'));
        return true;
      },
    );
  });

  test('Bộ đếm là chuỗi rác (ví dụ: classWarnings = "abc") bị từ chối với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(null, { classWarnings: 'abc' }, 6);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'classWarnings'));
        return true;
      },
    );
  });

  test('Bộ đếm là boolean (ví dụ: classWarnings = true) bị từ chối với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(null, { classWarnings: true }, 6);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'classWarnings'));
        return true;
      },
    );
  });

  test('Điểm 3: Validation enum từ chối mảng (ví dụ: awardTier = ["PARTICIPATED"]) với HTTP 400', () => {
    const configAward = DUT_RUBRIC_CRITERIA.find((c) => c.code === '5').scoringConfig;
    assert.throws(
      () => {
        validateVerifiedData(configAward, { awardTier: ['PARTICIPATED'] }, 3);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'awardTier'));
        return true;
      },
    );
  });

  test('Điểm 3: Validation enum từ chối object hoặc mảng cho academicTier với HTTP 400', () => {
    assert.throws(
      () => {
        validateVerifiedData(null, { academicTier: ['EXCELLENT'] }, 5);
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        const resp = err.getResponse();
        assert.equal(resp.code, 'INVALID_VERIFICATION_DATA');
        assert.ok(resp.details.fields.some((f) => f.field === 'academicTier'));
        return true;
      },
    );
  });

  test('Điểm 3: Evaluator từ chối tính điểm khi awardTier hoặc academicTier là mảng/object', () => {
    const configAward = DUT_RUBRIC_CRITERIA.find((c) => c.code === '5').scoringConfig;
    const evalAward = evaluateRubricCriterion(3, configAward, { awardTier: ['PARTICIPATED'] });
    assert.equal(evalAward.status, 'NEEDS_VERIFICATION');
    assert.equal(evalAward.suggestedScore, null);

    const configAcademic = DUT_RUBRIC_CRITERIA.find((c) => c.code === '3').scoringConfig;
    const evalAcademic = evaluateRubricCriterion(5, configAcademic, {
      academicTier: ['EXCELLENT'],
      academicWarning: false,
      improvedFromPreviousTerm: true,
    });
    assert.equal(evalAcademic.status, 'NEEDS_VERIFICATION');
    assert.equal(evalAcademic.suggestedScore, null);
  });

  test('Điểm 4: Mã lỗi qua HttpExceptionFilter thật trả đúng contract { error: { code: "INVALID_VERIFICATION_DATA" } }', () => {
    let capturedException = null;
    try {
      validateVerifiedData(null, { unexcusedAbsences: -5 }, 3);
    } catch (err) {
      capturedException = err;
    }
    assert.ok(capturedException, 'Phải ném exception');

    let responseStatus = null;
    let responseBody = null;
    const mockResponse = {
      status(s) {
        responseStatus = s;
        return this;
      },
      json(b) {
        responseBody = b;
        return this;
      },
    };
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/api/assessments/students/s1/t1/c1/verification' }),
      }),
    };

    const filter = new HttpExceptionFilter();
    filter.catch(capturedException, mockHost);

    assert.equal(responseStatus, 400);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.error.code, 'INVALID_VERIFICATION_DATA', 'Mã lỗi qua filter thật phải là INVALID_VERIFICATION_DATA');
    assert.equal(responseBody.error.message, 'Dữ liệu xác minh không hợp lệ');
    assert.ok(Array.isArray(responseBody.error.details.fields));
    assert.equal(responseBody.error.details.fields[0].field, 'unexcusedAbsences');
  });

  test('Điểm 5: Gọi verifyCriterion thật với DB doubles — request invalid KHÔNG ghi DB/audit, request valid ghi đúng', async () => {
    let upsertCalled = false;
    let auditLogCalled = false;

    const mockPrisma = {
      criterion: {
        findFirst: async () => ({
          id: 'crit-2',
          code: '2',
          maxScore: 3,
          rubricVersionId: 'rub-1',
          scoringConfig: {
            kind: 'group_penalty',
            requiredData: ['unexcusedAbsences', 'excusedAbsences', 'missedGroupDeadlines'],
            baseScore: 3,
            unexcusedPenalty: 2,
            excusedPenaltyFromSecond: 1,
          },
        }),
      },
      term: {
        findUnique: async () => ({ id: 'term-1', status: 'ACTIVE' }),
      },
      criterionAssessment: {
        findUnique: async () => null,
        upsert: async () => {
          upsertCalled = true;
          return { id: 'asmt-1', suggestedScore: 3 };
        },
      },
      assessmentSubmission: {
        count: async () => 1,
        findUnique: async () => ({ status: 'SUBMITTED', rubricVersionId: 'rub-1' }),
      },
      auditLog: {
        create: async () => {
          auditLogCalled = true;
          return { id: 'audit-1' };
        },
      },
    };

    const mockWorkflow = {
      scope: async () => {},
      ensureWritable: async () => {},
      edit: async (staff, studentId, termId, fn) => fn(mockPrisma),
    };
    const mockDeadlines = {
      resolve: async () => null,
    };

    const service = new AssessmentsService(mockPrisma, mockWorkflow, mockDeadlines);
    const staff = { id: 'staff-1', role: 'STAFF', facultyId: 'FAC_IT' };

    // Ca 1: Gửi request invalid (unexcusedAbsences = -2)
    upsertCalled = false;
    auditLogCalled = false;
    await assert.rejects(
      async () => {
        await service.verifyCriterion(staff, 'student-1', 'term-1', 'crit-2', {
          data: { unexcusedAbsences: -2, excusedAbsences: 0, missedGroupDeadlines: 0 },
          note: 'Căn cứ vi phạm',
        });
      },
      (err) => err instanceof BadRequestException && err.getResponse().code === 'INVALID_VERIFICATION_DATA',
    );
    assert.equal(upsertCalled, false, 'Không được gọi upsert DB khi dữ liệu xác minh invalid');
    assert.equal(auditLogCalled, false, 'Không được ghi audit log khi dữ liệu xác minh invalid');

    // Ca 2: Gửi request valid
    upsertCalled = false;
    auditLogCalled = false;
    const res = await service.verifyCriterion(staff, 'student-1', 'term-1', 'crit-2', {
      data: { unexcusedAbsences: 0, excusedAbsences: 0, missedGroupDeadlines: 0 },
      note: 'Căn cứ chính xác',
    });
    assert.ok(res);
    assert.equal(upsertCalled, true, 'Phải ghi DB khi dữ liệu hợp lệ');
    assert.equal(auditLogCalled, true, 'Phải ghi audit log khi dữ liệu hợp lệ');
  });

  test('Tỷ lệ bình chọn vượt 100% (105) hoặc âm (-5) bị từ chối', () => {
    assert.throws(
      () => validateVerifiedData(null, { collectiveApprovalPercent: 105 }, 4),
      (err) => err instanceof BadRequestException && err.getResponse().code === 'INVALID_VERIFICATION_DATA',
    );
    assert.throws(
      () => validateVerifiedData(null, { collectiveApprovalPercent: -5 }, 4),
      (err) => err instanceof BadRequestException && err.getResponse().code === 'INVALID_VERIFICATION_DATA',
    );
  });

  test('Tỷ lệ bình chọn có số thập phân hợp lệ (95.5%) được chấp nhận', () => {
    assert.doesNotThrow(() => {
      validateVerifiedData(null, { collectiveApprovalPercent: 95.5 }, 4);
    });
  });

  test('Điểm quy đổi cộng đồng là số thập phân không âm (7.5 điểm) được chấp nhận', () => {
    assert.doesNotThrow(() => {
      validateVerifiedData(null, { convertedCommunityPoints: 7.5, verifiedActivityCount: 2 }, 10);
    });
  });

  test('Điểm chính thức vượt quá maxScore bị từ chối', () => {
    assert.throws(
      () => validateVerifiedData(null, { officialScore: 11 }, 10),
      (err) => err instanceof BadRequestException && err.getResponse().code === 'INVALID_VERIFICATION_DATA',
    );
  });

  test('Dữ liệu hợp lệ với số 0 (ví dụ examBans: 0, classWarnings: 0) tính đúng điểm tối đa', () => {
    assert.doesNotThrow(() => {
      validateVerifiedData(criterion1.scoringConfig, { examBans: 0, classWarnings: 0 }, 6);
    });
    const evalResult = evaluateRubricCriterion(criterion1.maxScore, criterion1.scoringConfig, {
      examBans: 0,
      classWarnings: 0,
    });
    assert.equal(evalResult.status, 'READY_FOR_REVIEW');
    assert.equal(evalResult.suggestedScore, 6);
  });

  test('Evaluator từ chối ép 0 khi gặp dữ liệu vi phạm sai kiểu (không nuốt lỗi)', () => {
    // Trường hợp dữ liệu trong DB cũ có unexcusedAbsences = -5
    const evalResult = evaluateRubricCriterion(3, DUT_RUBRIC_CRITERIA.find((c) => c.code === '2').scoringConfig, {
      unexcusedAbsences: -5,
      excusedAbsences: 0,
      missedGroupDeadlines: 0,
    });
    assert.equal(evalResult.status, 'NEEDS_VERIFICATION');
    assert.equal(evalResult.suggestedScore, null);
    assert.match(evalResult.reason, /không hợp lệ/i);
  });

  test('Đối chứng đỏ: Hàm Math.max(0, Number(data[key]) || 0) cũ nuốt chuỗi rác thành 0 vi phạm và cho điểm tối đa', () => {
    const brokenCount = (data, key) => Math.max(0, Number(data[key]) || 0);
    // Chuỗi rác "vi-pham-nghiem-trong"
    const countGarbage = brokenCount({ examBans: 'vi-pham-nghiem-trong' }, 'examBans');
    assert.equal(countGarbage, 0, 'Code cũ ép chuỗi rác thành 0!');

    // Số âm -10
    const countNegative = brokenCount({ examBans: -10 }, 'examBans');
    assert.equal(countNegative, 0, 'Code cũ ép số âm thành 0!');
  });
});
