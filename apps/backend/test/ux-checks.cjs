const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const path = require('node:path');

// Real API/database data; CDP only holds/fails requests to exercise network UX.
module.exports = async function uxChecks({ prisma, send, evaluate, login, visit, ws, api, profile, wait, pause, sourceTerm, admin, staff }) {
  let mode = 'pass';
  let match = () => false;
  const held = new Set();
  const onMessage = event => {
    const data = JSON.parse(event.data);
    if (data.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = data.params;
    if (match(request) && mode === 'hold') { held.add(requestId); return; }
    const command = match(request) && mode === 'fail'
      ? send('Fetch.failRequest', { requestId, errorReason: 'Failed' })
      : send('Fetch.continueRequest', { requestId });
    command.catch(() => undefined);
  };
  ws.addEventListener('message', onMessage);
  await send('Fetch.enable', { patterns: [{ urlPattern: api + '/*', requestStage: 'Request' }] });
  const release = async () => { mode = 'pass'; for (const requestId of held) await send('Fetch.continueRequest', { requestId }); held.clear(); };
  const text = () => evaluate('document.body.innerText');
  const focus = () => evaluate("window.dispatchEvent(new Event('focus'))");
  const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const clickText = (label, root = 'document') => evaluate(`Array.from(${root}.querySelectorAll('button,a')).find(el=>el.textContent.trim() === ${JSON.stringify(label)}).click()`);
  try {
    const suffix = randomUUID().slice(0,8);
    const future = offset => new Date(Date.now() + offset);
    const emptyTerm = await prisma.term.create({ data: { code: 'UXEMPTY'+suffix, name: 'Kỳ UX chưa có danh sách', startDate: new Date(), endDate: future(86400000), submissionDeadline: future(3600000), reviewDeadline: future(7200000), appealDeadline: future(86400000), status: 'UPCOMING' } });
    await login(admin, emptyTerm);
    match = req => new URL(req.url).pathname === `/api/evaluation-workflow/${emptyTerm.id}`;
    mode = 'hold';
    await send('Page.navigate', { url: await evaluate('location.origin') + '/admin/results?termId='+emptyTerm.id });
    await wait(async()=> (await text()).includes('Đang tải danh sách phiếu…'));
    assert.ok(await evaluate("!!document.querySelector('input[aria-label=\"Tìm sinh viên\"]')"));
    assert.ok(!(await text()).includes('Chưa có danh sách đánh giá cho kỳ này'));
    await release();
    await wait(async()=> (await text()).includes('Chưa có danh sách đánh giá cho kỳ này'));
    assert.ok(await evaluate("!!Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='Quản lý kỳ đánh giá')"));
    console.log('PASS Admin initial skeleton and uninitialized roster guidance');

    await login(staff, emptyTerm);
    await visit('/officer/students?termId='+emptyTerm.id, 'Chưa có danh sách đánh giá cho kỳ này');
    assert.ok((await text()).includes('liên hệ Phòng CTSV'));
    assert.equal(await evaluate('document.querySelectorAll("table").length'),0);
    console.log('PASS Faculty empty roster explains CTSV contact without blank table');

    await login(staff, sourceTerm);
    await visit('/officer/students?termId='+sourceTerm.id, 'Phiếu rèn luyện');
    await wait(async()=>await evaluate('document.querySelectorAll("tbody tr").length > 0'));
    match = req => new URL(req.url).pathname === `/api/evaluation-workflow/${sourceTerm.id}`;
    mode = 'hold';
    await setInput('input[aria-label="Tìm sinh viên"]','zz-no-ux-result');
    await wait(async()=> (await text()).includes('Đang tải danh sách phiếu…'));
    assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'),0);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Tìm sinh viên"]').value`),'zz-no-ux-result');
    await release();
    await wait(async()=> (await text()).includes('Không tìm thấy phiếu phù hợp'));
    await clickText('Xóa bộ lọc');
    await wait(async()=> await evaluate('document.querySelectorAll("tbody tr").length > 0'));
    assert.equal(await evaluate('new URLSearchParams(location.search).get("termId")'),sourceTerm.id);
    assert.equal(await evaluate('new URLSearchParams(location.search).has("q")'),false);
    console.log('PASS filtering hides stale rows, clear filters preserves selected term');

    mode = 'fail';
    await setInput('input[aria-label="Tìm sinh viên"]','network-ux-error');
    await wait(async()=> (await text()).includes('Không tải được danh sách phiếu'));
    assert.ok(!(await text()).includes('Không tìm thấy phiếu phù hợp'));
    assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'),0);
    mode = 'pass';
    await clickText('Thử lại');
    await wait(async()=> (await text()).includes('Không tìm thấy phiếu phù hợp'));
    console.log('PASS request failure is distinct from empty results and retry recovers');

    // Record the actual 60-second registration; speed its callbacks up only in test.
    const timerScript = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__uxRunPoll=false;window.__uxIntervals=[];const nativeInterval=window.setInterval;window.setInterval=(fn,delay,...args)=>{window.__uxIntervals.push(delay);return delay===60000?nativeInterval(()=>{if(window.__uxRunPoll)fn(...args)},100):nativeInterval(fn,delay,...args)};` });
    const user = await prisma.user.create({ data: { email: randomUUID()+'@test.invalid', fullName: 'Sinh viên UX', studentCode: 'UX'+suffix, role: 'STUDENT', classId: (await prisma.class.findFirstOrThrow({where:{facultyId:staff.facultyId}})).id, isFirstLogin: false } });
    const term = await prisma.term.create({ data: { code:'UX'+suffix, name:'Kỳ kiểm tra UX', startDate:new Date(),endDate:future(86400000),submissionDeadline:future(3600000),reviewDeadline:future(7200000),appealDeadline:future(86400000),status:'ACTIVE' } });
    const rubric=await prisma.rubricVersion.create({data:{termId:term.id,status:'PUBLISHED',categories:{create:{code:'I',name:'Tiêu chí UX',position:1,maxScore:100}}},include:{categories:true}});
    const criterion=await prisma.criterion.create({data:{rubricVersionId:rubric.id,categoryId:rubric.categories[0].id,code:'2.1',name:'Tiêu chí kiểm tra UX',description:'Kiểm tra phiếu bị trả',maxScore:100,scoringConfig:{kind:'manual_verified',requiredData:['officialScore']}}});
    await prisma.assessmentHandoff.create({data:{studentId:user.id,termId:term.id,rubricVersionId:rubric.id,classId:user.classId,facultyId:staff.facultyId}});
    await prisma.criterionAssessment.create({data:{studentId:user.id,termId:term.id,criterionId:criterion.id,selfScore:35}});
    const submission=await prisma.assessmentSubmission.create({data:{studentId:user.id,termId:term.id,rubricVersionId:rubric.id,status:'DRAFT'}});
    await login(user,term);
    match=req=>req.method==='GET' && new URL(req.url).pathname==='/api/assessments/me';
    await visit('/student/scores','Phiếu đánh giá rèn luyện');
    const scoreSelector='input[aria-label="Điểm tự đánh giá tiêu chí 2.1"]';
    await wait(async()=> await evaluate(`!document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    assert.ok(await evaluate('window.__uxIntervals.includes(60000)'));

    await prisma.term.update({where:{id:term.id},data:{submissionDeadline:future(-1000)}});
    await focus();
    await wait(async()=> (await text()).includes('Đã hết hạn nộp đánh giá và minh chứng'));
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await prisma.term.update({where:{id:term.id},data:{status:'REVIEWING'}});
    await focus();
    await wait(async()=> (await text()).includes('Kỳ đánh giá đã đóng cổng tiếp nhận phiếu mới'));
    console.log('PASS ACTIVE expired and REVIEWING ordinary submissions are read-only');

    const reason='Tiêu chí 2.1 thiếu giấy xác nhận, vui lòng bổ sung';
    await prisma.assessmentSubmission.update({where:{id:submission.id},data:{status:'RETURNED',returnReason:reason,returnedAt:new Date()}});
    await focus();
    await wait(async()=> (await text()).includes('Bị trả phiếu — cần chỉnh sửa'));
    assert.ok((await text()).includes(reason));
    assert.ok((await text()).includes('Riêng phiếu bị trả này vẫn được sửa'));
    assert.ok(await evaluate(`!document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await visit('/student','Sửa & Nộp lại');
    const href=await evaluate("Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='Sửa & Nộp lại').getAttribute('href')");
    assert.equal(new URL(href,'http://test').searchParams.get('termId'),term.id);
    await clickText('Sửa & Nộp lại');
    await wait(async()=> await evaluate(`!!document.querySelector(${JSON.stringify(scoreSelector)}) && !document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await setInput(scoreSelector,'47');
    await clickText('Minh chứng (0)');
    await setInput('input[placeholder="Ví dụ: Ngày Chủ nhật xanh"]','Minh chứng đang nhập chưa lưu');
    const unsavedFile=path.join(profile,'ux-unsaved.pdf');writeFileSync(unsavedFile,'%PDF-1.4\nUX unsaved file');
    const dom=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});
    await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[unsavedFile]});
    await focus();await pause(300);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).value`),'47');
    assert.equal(await evaluate('document.querySelector("input[type=file]").files[0].name'),'ux-unsaved.pdf');
    assert.equal(await evaluate(`document.querySelector('input[placeholder="Ví dụ: Ngày Chủ nhật xanh"]').value`),'Minh chứng đang nhập chưa lưu');
    console.log('PASS return reason, resubmit CTA and refresh preserve unsaved score/text/file');

    mode='fail';await focus();
    await wait(async()=> (await text()).includes('Không xác minh được quyền chỉnh sửa'));
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    assert.ok(await evaluate('document.querySelector("input[type=file]").matches(":disabled")'));
    mode='pass';await clickText('Thử lại',"document.querySelector('[role=dialog]')");
    await wait(async()=>await evaluate(`!document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    assert.equal(await evaluate('document.querySelector("input[type=file]").files[0].name'),'ux-unsaved.pdf');
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).value`),'47');
    await evaluate(`document.querySelector('button[aria-label="Đóng popup"]').click()`);
    console.log('PASS access failure locks all writes; retry restores access without losing drafts');

    await clickText('Nộp lại phiếu');
    await wait(async()=> (await text()).includes('Đã nộp phiếu và'));
    assert.ok(!(await text()).includes('Bị trả phiếu — cần chỉnh sửa'));
    assert.equal((await prisma.criterionAssessment.findFirst({where:{studentId:user.id,termId:term.id}})).selfScore,47);
    assert.equal((await prisma.assessmentSubmission.findUnique({where:{id:submission.id}})).status,'SUBMITTED');
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    console.log('PASS resubmission clears return badge and locks submitted sheet');

    await prisma.assessmentSubmission.update({where:{id:submission.id},data:{status:'RETURNED',returnReason:reason}});
    await prisma.term.update({where:{id:term.id},data:{reviewDeadline:future(1800)}});
    await focus();await wait(async()=> await evaluate(`!document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await setInput(scoreSelector,'61');
    await wait(async()=> (await text()).includes('đã hết hạn nộp lại'));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).value`),'61');
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    console.log('PASS returned-sheet deadline automatically locks without clearing entered scores');

    await prisma.term.update({where:{id:term.id},data:{reviewDeadline:future(7200000)}});
    await focus();
    await wait(async()=> await evaluate(`!document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await prisma.term.update({where:{id:term.id},data:{status:'CLOSED'}});
    await evaluate('window.__uxRunPoll=true');
    await wait(async()=> (await text()).includes('Kỳ đánh giá đã đóng cổng tiếp nhận. Phiếu chỉ được xem.'));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).value`),'61');
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(scoreSelector)}).disabled`));
    await evaluate('window.__uxRunPoll=false');
    await visit('/student','Bị trả phiếu — cần chỉnh sửa');
    assert.ok(await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Sửa & Nộp lại').disabled"));
    assert.ok((await text()).includes(reason));
    console.log('PASS periodic access refresh detects CLOSED; dashboard preserves reason and disables CTA');
    await prisma.assessmentSubmission.update({where:{id:submission.id},data:{status:'SUBMITTED'}});
    await visit('/student/scores','Kỳ đánh giá đã đóng cổng tiếp nhận. Phiếu chỉ được xem.');
    assert.ok(!(await text()).includes('Phiếu đã nộp và đang chờ cán bộ xử lý'));
    console.log('PASS CLOSED message takes precedence over submitted-sheet pending message');

    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:timerScript.identifier});
  } finally {
    await release();
    await send('Fetch.disable');
    ws.removeEventListener('message',onMessage);
  }
};
