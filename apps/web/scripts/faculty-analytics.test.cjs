const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/lib/facultyAnalytics.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = new Module(file, module); loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file)); loaded._compile(compiled, file);
const { aggregateFacultyClasses, aggregateClassWorkflow, countFacultyStates, validateFacultyRows, percentage, facultyStates } = loaded.exports;
const row = (id, state, classId = 'A', pendingEvidence = 0) => ({ studentId: id, state, classId, pendingEvidence, pendingAppeals: 0, class: { id: classId, code: classId } });
const summary = { notSubmitted: 101, reviewing: 1, returned: 2, ready: 1, sent: 2, published: 1, recordedNotSubmitted: 1 };
const rows = [...Array.from({ length: 100 }, (_, i) => row('n' + i, 'NOT_SUBMITTED')), ...facultyStates.map((state, i) => row('s' + i, state.key, 'B'))];
test('all pages and all 8 states are counted once, including zero and excluded', () => {
  const counts = countFacultyStates(rows);
  assert.equal(rows.length, 108);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), rows.length);
  assert.equal(counts.NOT_SUBMITTED, 101); assert.equal(counts.SENT + counts.PUBLISHED, 2);
  assert.equal(counts.STUDENT_RETURNED, 1); assert.equal(counts.FACULTY_RETURNED, 1);
  assert.equal(counts.NOT_SUBMITTED_RECORDED, 1);
  assert.doesNotThrow(() => validateFacultyRows(rows, { total: 108, summary }));
});
test('five stacked class groups sum to actual enrollment, not the visible page', () => {
  const classes = aggregateFacultyClasses(rows);
  for (const cls of classes) assert.equal(cls.notSubmitted + cls.processing + cls.ready + cls.handedOver + cls.recorded, cls.total);
  assert.equal(classes[0].code, 'A'); assert.equal(classes[0].total, 100);
  const b = classes.find(cls => cls.id === 'B');
  assert.equal(b.total, 8); assert.equal(b.processing, 3); assert.equal(b.handedOver, 2); assert.equal(b.published, 1);
  assert.equal(b.rate, 25); assert.equal(b.remaining, 5);
});
test('class priority compares outstanding rates before raw headcount', () => {
  const classes = aggregateFacultyClasses([row('a', 'NOT_SUBMITTED'), ...Array.from({ length: 9 }, (_, i) => row('p' + i, 'PUBLISHED')), row('b', 'NOT_SUBMITTED', 'B')]);
  assert.equal(classes[0].id, 'B'); assert.equal(classes[1].id, 'A');
});
test('partial, duplicate and concurrently changed pages cannot produce a complete chart', () => {
  assert.throws(() => validateFacultyRows(rows.slice(0, 100), { total: 108, summary }), /chưa tải đủ/);
  assert.throws(() => validateFacultyRows([...rows.slice(0, 107), rows[0]], { total: 108, summary }), /chưa tải đủ/);
  assert.throws(() => validateFacultyRows(rows, { total: 108, summary: { ...summary, ready: 2 } }), /Trạng thái phiếu thay đổi/);
  assert.throws(() => countFacultyStates([row('bad', 'UNKNOWN')]), /chưa được hỗ trợ/);
});
test('empty and all-published classes have finite percentages', () => {
  assert.equal(percentage(0, 0), 0); assert.equal(aggregateFacultyClasses([]).length, 0);
  assert.equal(Object.values(countFacultyStates([])).reduce((a, b) => a + b, 0), 0);
  const [cls] = aggregateFacultyClasses([row('p', 'PUBLISHED')]);
  assert.equal(cls.rate, 100); assert.equal(cls.remaining, 0);
});
test('workflow class summary uses terminal states for progress and prioritizes actionable work', () => {
  const classes = aggregateClassWorkflow([
    row('r1', 'READY', 'A'), row('r2', 'SENT', 'A'), row('r3', 'PUBLISHED', 'A'), row('r4', 'NOT_SUBMITTED_RECORDED', 'A'),
    row('b1', 'REVIEWING', 'B', 2), row('b2', 'FACULTY_RETURNED', 'B'),
    row('c1', 'STUDENT_RETURNED', 'C', 1),
  ], { B: 1 }, { B: 2 });
  const a = classes.find(cls => cls.id === 'A');
  const b = classes.find(cls => cls.id === 'B');
  const c = classes.find(cls => cls.id === 'C');
  assert.equal(a.processedRate, 100); assert.equal(a.status, 'READY');
  assert.equal(b.status, 'NEEDS_ACTION'); assert.equal(b.openWork, 6);
  assert.equal(c.status, 'WAITING');
  assert.equal(classes[0].id, 'B');
});
