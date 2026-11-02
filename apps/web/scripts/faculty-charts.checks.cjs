const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
const { writeFileSync } = require('node:fs');

module.exports = async ({ prisma, send, evaluate, login, visit, ws, wait, pause, staff, admin }) => {
  const id = randomUUID().slice(0, 8);
  const dates = { startDate: new Date(Date.now()-86400000), endDate: new Date(Date.now()+86400000), submissionDeadline: new Date(Date.now()+3600000), reviewDeadline: new Date(Date.now()+7200000), appealDeadline: new Date(Date.now()+14400000) };
  const term = await prisma.term.create({ data: { ...dates, code: 'CHART'+id, name: 'Kỳ biểu đồ '+id, status: 'ACTIVE', workflowEnabled: true } });
  const empty = await prisma.term.create({ data: { ...dates, code: 'EMPTYCHART'+id, name: 'Kỳ biểu đồ rỗng '+id, status: 'ACTIVE', workflowEnabled: true } });
  const rubric = await prisma.rubricVersion.create({ data: { termId: term.id, status: 'PUBLISHED', categories: { create: { code: 'I', name: 'Nhóm kiểm thử', maxScore: 100, position: 1 } } }, include: { categories: true } });
  const criterion = await prisma.criterion.create({ data: { code: 'I.1', name: 'Tiêu chí biểu đồ', description: 'Dữ liệu tổng hợp chỉ dùng trong database kiểm thử.', maxScore: 100, rubricVersionId: rubric.id, categoryId: rubric.categories[0].id, scoringConfig: { kind: 'manual_verified', requiredData: ['officialScore'] } } });
  const classes = [];
  for (let i = 0; i < 9; i++) classes.push(await prisma.class.create({ data: { code: 'Chart'+id+'-'+i, name: 'Lớp biểu đồ '+i, cohort: 'K26', facultyId: staff.facultyId } }));
  const states = ['NOT_SUBMITTED','STUDENT_RETURNED','REVIEWING','FACULTY_RETURNED','READY','SENT','PUBLISHED','NOT_SUBMITTED_RECORDED'];
  const users = Array.from({ length: 108 }, (_, i) => ({ id: randomUUID(), email: 'charts-'+randomUUID()+'@test.invalid', fullName: 'Biểu đồ SV '+i, role: 'STUDENT', classId: classes[i % 9].id, isFirstLogin: false }));
  await prisma.user.createMany({ data: users });
  await prisma.assessmentHandoff.createMany({ data: users.map((user, i) => {
    const state = i < 100 ? 'NOT_SUBMITTED' : states[i - 100];
    return { studentId: user.id, termId: term.id, rubricVersionId: rubric.id, classId: user.classId, facultyId: staff.facultyId, status: state === 'FACULTY_RETURNED' ? 'RETURNED' : state === 'NOT_SUBMITTED_RECORDED' ? 'EXCLUDED' : ['SENT','PUBLISHED'].includes(state) ? 'SENT' : 'WORKING', revision: 1, ...(['SENT','PUBLISHED'].includes(state) ? { snapshot: { totalScore: 88 } } : {}) };
  }) });
  for (let i = 100; i < 108; i++) {
    const state = states[i - 100], user = users[i];
    if (['STUDENT_RETURNED','REVIEWING','READY','SENT','PUBLISHED'].includes(state)) await prisma.assessmentSubmission.create({ data: { studentId: user.id, termId: term.id, rubricVersionId: rubric.id, status: state === 'STUDENT_RETURNED' ? 'RETURNED' : 'SUBMITTED', returnReason: state === 'STUDENT_RETURNED' ? 'Cần bổ sung' : null } });
    if (state === 'READY') await prisma.criterionAssessment.create({ data: { studentId: user.id, termId: term.id, criterionId: criterion.id, officialScore: 80, status: 'FINALIZED', verificationNote: 'Đã xác minh', finalReviewerId: staff.id } });
    if (state === 'PUBLISHED') await prisma.assessmentPublication.create({ data: { studentId: user.id, termId: term.id, rubricVersionId: rubric.id, revision: 1, snapshot: { totalScore: 88 }, publishedById: admin.id } });
  }
  await prisma.evidence.createMany({ data: ['APPROVED','APPROVED','APPROVED','REJECTED','NEEDS_SUPPLEMENT','NEEDS_HUMAN_REVIEW'].map(status => ({ studentId: users[0].id, termId: term.id, evidenceType: 'GIAY_XAC_NHAN', declaredActivityName: 'Kiểm thử donut', status })) });

  const q = async selector => evaluate('Boolean(document.querySelector('+JSON.stringify(selector)+'))');
  const open = async chosen => { await login(staff, chosen); await visit('/officer?termId='+chosen.id, 'Tổng quan đánh giá Khoa'); };
  const chartReady = () => wait(() => q('[data-testid=faculty-state-chart]'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await open(term); await chartReady(); await wait(() => q('[data-testid=faculty-evidence-donut] svg'));
  const counts = await evaluate('Array.from(document.querySelectorAll("[data-testid=faculty-state-chart] li strong")).map(el=>Number(el.textContent))');
  assert.deepEqual(counts, [101,1,1,1,1,1,1,1]);
  assert.equal(counts.reduce((a,b)=>a+b,0),108);
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=faculty-class-chart] div[role=img]").length'),8);
  await evaluate('Array.from(document.querySelectorAll("button")).find(el=>el.textContent.includes("Xem tất cả 9 lớp")).click()');
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=faculty-class-chart] div[role=img]").length'),9);
  await evaluate('Array.from(document.querySelectorAll("button")).find(el=>el.textContent==="Xem dạng bảng").click()');
  const totalInTable = await evaluate('Array.from(document.querySelectorAll("[data-testid=faculty-class-chart] tbody tr")).reduce((n,row)=>n+Number(row.querySelector("td").textContent),0)');
  assert.equal(totalInTable,108);
  await evaluate('Array.from(document.querySelectorAll("button")).find(el=>el.textContent==="Xem biểu đồ").click()');
  assert.equal(await evaluate('document.querySelector("[data-testid=faculty-evidence-donut] svg").getAttribute("aria-label")'), 'Đã duyệt: 3 (50%); Từ chối: 1 (16,7%); Chưa có quyết định cuối: 2 (33,3%)');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(path.join(os.tmpdir(),'edupoint-faculty-charts-desktop.png'),Buffer.from(screenshot.data,'base64'));
  console.log('PASS 108 students, all 8 states, 9 classes, table toggle and 3-part donut from real API');

  // Native details works by keyboard; links carry the selected term and class.
  await evaluate('document.querySelector("[data-testid=faculty-class-chart] summary").focus()');
  assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(async()=>await evaluate('document.querySelector("[data-testid=faculty-class-chart] details").open'));
  const linked = await evaluate('document.querySelector("[data-testid=faculty-state-chart] li:first-child a").getAttribute("href")');
  assert.equal(new URL(linked,'http://local').searchParams.get('termId'),term.id);
  assert.equal(new URL(linked,'http://local').searchParams.get('state'),'NOT_SUBMITTED');
  await evaluate('document.querySelector("[data-testid=faculty-state-chart] li:first-child a").click()');
  await wait(async()=>await evaluate('location.pathname === "/officer/students"'));
  assert.equal(await evaluate('new URLSearchParams(location.search).get("state")'),'NOT_SUBMITTED');
  console.log('PASS keyboard details and chart drill-down preserve filters');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await open(term); await chartReady(); await wait(() => q('[data-testid=faculty-evidence-donut] svg'));
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
  const mobile = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  writeFileSync(path.join(os.tmpdir(),'edupoint-faculty-charts-mobile.png'),Buffer.from(mobile.data,'base64'));
  console.log('PASS charts fit 390px without page overflow');

  await open(empty); await chartReady();
  await wait(async()=>await evaluate('document.body.innerText.includes("Chưa có minh chứng trong kỳ này")'));
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=faculty-evidence-donut] svg").length'),0);
  assert.ok(!await evaluate('document.querySelector("main").innerText.includes("NaN")'));
  console.log('PASS empty term has explicit empty states, no artificial donut');

  // Fail a real second page, retaining independently fetched summary and evidence.
  let failed = false;
  const listener = async event => {
    const data = JSON.parse(event.data);
    if (data.method !== 'Fetch.requestPaused') return;
    const request = data.params, url = new URL(request.request.url);
    if (!failed && url.pathname.endsWith('/evaluation-workflow/'+term.id) && url.searchParams.get('page') === '2') { failed = true; await send('Fetch.failRequest',{requestId:request.requestId,errorReason:'Failed'}); }
    else await send('Fetch.continueRequest',{requestId:request.requestId});
  };
  ws.addEventListener('message', listener);
  await send('Fetch.enable',{patterns:[{urlPattern:'*evaluation-workflow/'+term.id+'*',requestStage:'Request'}]});
  await open(term);
  await wait(async()=>await evaluate('document.querySelector("section[aria-label=\\"Thống kê tiến độ lớp\\"]")?.innerText.includes("Thử lại")'));
  assert.ok(failed);
  assert.ok(!await q('[data-testid=faculty-class-chart]'));
  await wait(() => q('[data-testid=faculty-evidence-donut] svg'));
  assert.ok(await q('[aria-label="Thống kê chính của Khoa"]'));
  await send('Fetch.disable'); ws.removeEventListener('message', listener);
  await evaluate('document.querySelector("section[aria-label=\\"Thống kê tiến độ lớp\\"] button").click()');
  await chartReady();
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-testid=faculty-state-chart] li strong")).map(el=>Number(el.textContent))'),[101,1,1,1,1,1,1,1]);
  console.log('PASS failed pagination hides partial charts; independent donut remains and retry recovers');

  // Hold the old response, switch to another term, then release it.
  let held;
  const hold = async event => {
    const data = JSON.parse(event.data); if (data.method !== 'Fetch.requestPaused') return;
    const request = data.params, url = new URL(request.request.url);
    if (!held && url.pathname.endsWith('/evaluation-workflow/'+term.id) && url.searchParams.get('page') === '2') held = request.requestId;
    else await send('Fetch.continueRequest',{requestId:request.requestId});
  };
  ws.addEventListener('message',hold);
  await send('Fetch.enable',{patterns:[{urlPattern:'*evaluation-workflow/'+term.id+'*',requestStage:'Request'}]});
  await open(term); await wait(()=>held);
  await evaluate('(()=>{const select=document.querySelector("select[title=\\"Chọn kỳ học đánh giá\\"]");select.value='+JSON.stringify(empty.id)+';select.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await wait(async()=>await evaluate('new URLSearchParams(location.search).get("termId") === '+JSON.stringify(empty.id)));
  await send('Fetch.continueRequest',{requestId:held}); await send('Fetch.disable'); ws.removeEventListener('message',hold);
  await wait(async()=>await evaluate('document.body.innerText.includes("Chưa có phiếu để thống kê trong kỳ này")'));
  await pause(300);
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=faculty-state-chart] li").length'),0);
  console.log('PASS late old-term responses cannot overwrite new-term charts');

  await prisma.term.update({where:{id:term.id},data:{status:'CLOSED'}});
  await open(term); await chartReady();
  assert.ok(await evaluate('document.body.innerText.includes("Kỳ đã chốt. Số liệu được hiển thị để tra cứu")'));
  console.log('PASS CLOSED dashboard uses read-only deadline/status messaging');
};
