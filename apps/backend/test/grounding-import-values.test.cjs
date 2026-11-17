const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../web/node_modules/typescript');

require('../node_modules/ts-node').register({ project: path.join(__dirname, '../tsconfig.json') });
const { validateVerifiedData } = require('../src/assessments/assessments.service');
const source = fs.readFileSync(path.join(__dirname, '../../web/src/lib/groundingImportValues.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });

test('Excel blank values stay missing and valid values preserve their meaning', () => {
  assert.equal(exported.parseBooleanVal(' '), undefined);
  assert.equal(exported.parseNonNegativeInteger(''), undefined);
  assert.equal(exported.parseAcademicTier(''), undefined);
  assert.equal(exported.parseBooleanVal('KHÔNG'), false);
  assert.equal(exported.parseBooleanVal('CÓ'), true);
  assert.equal(exported.parseNonNegativeInteger('0'), 0);
  assert.equal(exported.parseAcademicTier('GIỎI'), 'GOOD');
});

test('invalid spreadsheet values reach backend validation without being converted into safe defaults', () => {
  assert.throws(() => validateVerifiedData({}, { tuitionCompliance: exported.parseBooleanVal('khong ro') }, 15));
  assert.throws(() => validateVerifiedData({}, { examBans: exported.parseNonNegativeInteger('-1') }, 6));
  assert.throws(() => validateVerifiedData({}, { examBans: exported.parseNonNegativeInteger(true) }, 6));
  assert.throws(() => validateVerifiedData({}, { academicTier: exported.parseAcademicTier('khong ro') }, 5));
});
