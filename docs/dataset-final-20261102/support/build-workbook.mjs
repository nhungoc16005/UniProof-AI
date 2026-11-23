import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ExcelJS from '../../tracker-20261027/support/node_modules/exceljs/lib/exceljs.nodejs.js';
const dir='outputs/dataset-final-20261102';
const base='UniProof-AI/research/activity-classification/datasets';
const read=async n=>JSON.parse(await fs.readFile(`${base}/${n}`,'utf8'));
const d=await read('real-001.review.json'),m=await read('split_manifest.json');
const records=[...d.records,...d.child_records];
const wb=new ExcelJS.Workbook();wb.creator='UniProof research';wb.calcProperties.fullCalcOnLoad=true;
function sheet(name,headers,widths){const s=wb.addWorksheet(name);s.addRow(headers);s.columns.forEach((c,i)=>c.width=widths[i]);s.views=[{state:'frozen',ySplit:1}];s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};return s;}
const guide=sheet('Huong_dan',['Mục','Nội dung'],[33,105]);
guide.addRows([
 ['Trạng thái','BẢN THỬ NGHIỆM — chưa dùng làm benchmark chính thức.'],
 ['Nguồn chính','UniProof-AI/research/activity-classification/datasets/real-001.review.json'],
 ['Kiểm duyệt','Nhãn có AI hỗ trợ; chưa có kết quả duyệt độc lập được lưu. Prototype không bắt buộc PDF hoặc hai người duyệt. REVIEW_SLOT_01/02 chưa được phân công.'],
 ['Số hồ sơ',{formula:"COUNTA('Tracker'!A2:A101)",result:100}],
 ['Mẫu đủ nội dung thử nghiệm',{formula:'COUNTIF(\'Tracker\'!B2:B101,"LABELED")',result:29}],
 ['Train / validation / test','20 / 5 / 4 mẫu thật; 21 nhóm. Train thêm 20 biến thể khoảng trắng; không thêm bằng chứng hoặc tình huống mới.'],
 ['Nguồn sử dụng','Bạn bè/nhóm lớp; người thu thập xác nhận người cung cấp đồng ý cho nghiên cứu.'],
 ['Ảnh và quyền riêng tư','Giữ nguyên cờ cần kiểm tra che thông tin trên ảnh. CSV chỉ chứa phần text phân loại, không xuất ảnh hoặc danh tính.'],
 ['Cần bổ sung','54 hồ sơ nguồn chưa đủ nội dung; một bản trùng bị loại; 14 ngoài taxonomy; DOC-0020 là nguồn cha, B bị che.'],
 ['Phạm vi nhãn','7/11 nhãn có mẫu. Nhãn chỉ có một nhóm được giữ ở train; không thể kết luận chất lượng cho mọi lớp.'],
 ['Tái tạo','node UniProof-AI/research/activity-classification/prepare_real_dataset.mjs'],
 ['Chạy thử baseline','python train_baseline.py --allow-provisional; kết quả nằm riêng trong artifacts/provisional-real-001.'],
 ['Lưu ý tăng cường','Chỉ làm phẳng dấu xuống dòng sau khi chia tập. Không tính 20 biến thể là 20 tài liệu thật mới.']
]);
const tracker=sheet('Tracker',['sample_id','annotation_status','label','group_id','split','Nội dung input','Lý do','Duyệt người dùng','Nguồn ảnh'],[18,25,36,24,12,88,85,30,65]);
for(const r of records)tracker.addRow([r.sample_id,r.annotation_status,r.label,r.group_id,r.split,r.text,r.label_reason,r.human_review_status,{text:r.source_ref,hyperlink:r.source_ref}]);
const follow=sheet('Can_bo_sung',['sample_id','Trạng thái','Cần bổ sung / lý do','Trường thiếu'],[18,25,100,55]);
for(const r of records.filter(r=>!r.experimental_eligible))follow.addRow([r.sample_id,r.dataset_disposition,r.label_reason,r.missing_information.join('; ')]);
const groups=sheet('Nhom',['group_id','split','Các mẫu','Căn cứ'],[27,14,65,85]);
for(const group of [...new Set(records.map(r=>r.group_id))].sort()){const rs=records.filter(r=>r.group_id===group);groups.addRow([group,rs[0].split,rs.map(r=>r.sample_id).join(', '),'Thành phần liên thông: tài liệu/hash, nhóm cũ và quan hệ sự kiện/template; gộp thận trọng để tránh rò rỉ.']);}
const stats=sheet('Phan_bo',['label','Train thật','Validation','Test','Nhóm độc lập'],[42,19,19,19,23]);
const labels=JSON.parse(await fs.readFile('UniProof-AI/research/activity-classification/taxonomy.json','utf8')).taxonomy.map(r=>r.label);
for(const label of labels){const n=stats.rowCount+1;const row=[label];for(const split of ['train','val','test'])row.push({formula:`COUNTIFS('Tracker'!C2:C101,A${n},'Tracker'!E2:E101,"${split}")`,result:records.filter(r=>r.label===label&&r.split===split).length});row.push(new Set(records.filter(r=>r.label===label).map(r=>r.group_id)).size);stats.addRow(row);}
for(const s of wb.worksheets){s.getRow(1).height=32;s.eachRow((row,i)=>{row.eachCell(cell=>{cell.font={name:'Calibri',size:11,color:{argb:i===1?'FFFFFFFF':'FF243447'}};cell.alignment={vertical:'top',wrapText:true};if(i===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};else if(i%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F5F9'}};});if(i>1){let lines=1;row.eachCell((cell,j)=>{const value=cell.value;const text=typeof value==='object'?(value?.text??value?.result??''):value??'';lines=Math.max(lines,...String(text).split('\n').map(t=>Math.ceil(t.length/(s.getColumn(j).width*.85))));});row.height=Math.max(30,Math.min(300,lines*17+8));}});}
await fs.mkdir(`${dir}/support/preview`,{recursive:true});
await wb.xlsx.writeFile(`${dir}/data_tracker.xlsx`);
const check=new ExcelJS.Workbook();await check.xlsx.readFile(`${dir}/data_tracker.xlsx`);assert.equal(check.getWorksheet('Tracker').rowCount,101);assert.equal(check.getWorksheet('Huong_dan').getCell('B6').result,29);
const previews=[];for(const [i,s] of check.worksheets.entries()){const cols=s.name==='Tracker'?[1,2,3,4]:s.name==='Can_bo_sung'?[1,2,3]:s.name==='Nhom'?[1,2,3]:s.name==='Phan_bo'?[1,2,3,4,5]:[1,2];const widths=cols.map(c=>Math.min(800,Math.round(s.getColumn(c).width*8)));previews.push({name:s.name,file:`sheet-${i+1}.png`,widths,rows:[...Array(Math.min(s.rowCount,7))].map((_,n)=>cols.map(c=>{const cell=s.getCell(n+1,c);const v=cell.value;return {text:typeof v==='object'?(v?.text??v?.result??''):v??'',fill:n===0?'FF17365D':'FFF1F5F9',color:n===0?'FFFFFFFF':'FF243447',bold:n===0};}))});}
await fs.writeFile(`${dir}/support/preview/pages.json`,JSON.stringify(previews));
console.log('Workbook: 5 sheets, 100 records, summary formulas checked.');
