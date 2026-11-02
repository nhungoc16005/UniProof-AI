// Reuse the isolated PostgreSQL / Chrome harness without changing Backend files.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../../backend/test/browser-smoke.cjs');
let source = fs.readFileSync(filename, 'utf8')
  .replaceAll('Tổng quan đánh giá toàn trường', 'Tổng quan toàn trường')
  .replaceAll('Tổng quan đánh giá rèn luyện', 'Tổng quan đánh giá Khoa')
  .replaceAll('Báo cáo toàn trường', 'Báo cáo điểm rèn luyện toàn trường')
  .replaceAll('Báo cáo Khoa', 'Báo cáo điểm rèn luyện Khoa')
  .replaceAll("b.textContent.includes('Xuất Excel toàn bộ')", "b.textContent.includes('Xuất Excel kết quả')");
source = source.replace('rmSync(profile,{recursive:true,force:true})', 'rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100})');
const marker = "    await require('./ux-checks.cjs')";
if (!source.includes(marker)) throw new Error('Browser harness changed; review navigation smoke adapter');
source = source.replace(marker, `
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await login(admin);
    await visit('/admin/results?termId='+term.id,'Tiếp nhận & công bố');
    assert.equal(await evaluate('document.querySelectorAll("aside nav a").length'),5);
    assert.equal(await evaluate('document.querySelectorAll("main section nav a").length'),2);
    assert.ok(!await evaluate('document.querySelector("main").innerText.includes("Tiến độ theo Khoa")'));
    assert.ok(!await evaluate('Array.from(document.querySelectorAll("main button")).some(b=>b.textContent=== "Chốt kỳ")'));
    await evaluate('document.querySelector("main section nav a:nth-child(2)").click()');
    await wait(async()=>await evaluate('location.pathname === "/admin/reports"'));
    assert.equal(await evaluate('new URLSearchParams(location.search).get("termId")'),term.id);
    await evaluate('history.back()');
    await wait(async()=>await evaluate('location.pathname === "/admin/results"'));
    await evaluate('history.forward()');
    await wait(async()=>await evaluate('location.pathname === "/admin/reports"'));
    await send('Page.reload');
    await wait(async()=>await evaluate('document.querySelector("main section nav a[aria-current=page]")?.textContent.includes("Báo cáo kết quả")'));
    await visit('/admin/criteria?termId='+term.id,'Bộ tiêu chí');
    assert.equal(await evaluate('document.querySelectorAll("main section nav a").length'),3);
    const blockedTerm = await prisma.term.create({ data: { code: 'NAV'+require('node:crypto').randomUUID(), name: 'Navigation close blocker', startDate: new Date(Date.now()-86400000), endDate: new Date(Date.now()+86400000), submissionDeadline: new Date(Date.now()-60000), reviewDeadline: new Date(Date.now()+3600000), appealDeadline: new Date(Date.now()+7200000), status: 'REVIEWING', workflowEnabled: true } });
    await visit('/admin/terms?termId='+blockedTerm.id,'Kỳ đánh giá');
    await evaluate('Array.from(document.querySelectorAll("tr")).find(row=>row.innerText.includes("Navigation close blocker")).querySelector("button.text-rose-700").click()');
    await wait(async()=>await evaluate('document.body.innerText.includes("Chưa có danh sách đánh giá")'));
    assert.ok(await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Xác nhận Chốt sổ")).disabled'));
    console.log('PASS admin 5 menu items, grouped route tabs, reload and no duplicated progress');
    await login(staff);
    await visit('/officer/students?termId='+term.id,'Phiếu rèn luyện');
    assert.equal(await evaluate('document.querySelectorAll("aside nav a").length'),4);
    assert.equal(await evaluate('document.querySelectorAll("main section nav a").length'),3);
    if(evidence) {
      await visit('/officer/review/'+evidence.id+'?termId='+term.id,'Minh chứng');
      assert.ok(await evaluate('document.querySelector("main section nav a[aria-current=page]")?.textContent.includes("Minh chứng")'));
    }
    await visit('/officer/students/'+student.id+'/assessment?termId='+term.id+'&tab=appeals','Phúc khảo liên quan');
    await wait(async()=>await evaluate('!document.body.innerText.includes("Đang tải phúc khảo liên quan")'));
    await visit('/officer/activities?termId='+term.id+'&type=EXTERNAL','Nguồn ngoài trường');
    assert.ok(await evaluate('document.querySelector("a[aria-current=page][href*=EXTERNAL]") !== null'));
    await visit('/officer','Tổng quan đánh giá Khoa');
    assert.ok(!await evaluate('document.querySelector("main").innerText.includes("Phân bố xếp loại rèn luyện")'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await visit('/officer/appeals?termId='+term.id,'Phúc khảo');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
    console.log('PASS faculty 4 menu items, detail active tab, related appeals, activity deep link and mobile');

    await require(path.resolve(__dirname, '../../web/scripts/faculty-charts.checks.cjs'))({prisma,send,evaluate,login,visit,ws,wait,pause,staff,admin});
` + marker);
if (process.env.FACULTY_CHARTS_ONLY === '1') {
  const start = source.indexOf('    await login(admin);');
  const end = source.indexOf(marker);
  source = source.slice(0, start) + "    await require(path.resolve(__dirname, '../../web/scripts/faculty-charts.checks.cjs'))({prisma,send,evaluate,login,visit,ws,wait,pause,staff,admin});\n" + source.slice(end);
  source = source.replace(/^    await require\('\.\/ux-checks\.cjs'\).*$/m, '');
}
const runner = new Module(filename, module);
runner.filename = filename;
runner.paths = Module._nodeModulePaths(path.dirname(filename));
runner._compile(source, filename);
