# TRƯỜNG ĐẠI HỌC BÁCH KHOA
# KHOA CÔNG NGHỆ THÔNG TIN

**BÁO CÁO ĐỒ ÁN [BỔ SUNG TÊN HỌC PHẦN]**

# XÂY DỰNG HỆ THỐNG HỖ TRỢ ĐÁNH GIÁ ĐIỂM RÈN LUYỆN SINH VIÊN EDUPOINT

- Giảng viên hướng dẫn: [Bổ sung]
- Sinh viên thực hiện: [Bổ sung họ tên, mã sinh viên, lớp của từng thành viên]
- Nhóm: [Bổ sung]
- Đà Nẵng, [tháng/năm]

**BẢN THẢO:** Nội dung được xây dựng theo cấu trúc báo cáo mẫu và đối chiếu tài liệu, mã nguồn EduPoint. Các phần trong ngoặc vuông cần nhóm bổ sung, xác minh hoặc thay thế trước khi nộp. Tên đề tài, học phần, thành viên và giảng viên trên bìa cần được xác nhận lại.

\newpage

# MỞ ĐẦU

Đánh giá kết quả rèn luyện là một nội dung trong công tác quản lý và hỗ trợ sinh viên tại cơ sở giáo dục đại học. Quy trình này có sự tham gia của sinh viên, đơn vị phụ trách tại khoa và bộ phận quản trị. Trong mỗi kỳ đánh giá, người tham gia cần theo dõi bộ tiêu chí, khai báo thông tin, cung cấp căn cứ, xem xét kết quả và xử lý những trường hợp cần điều chỉnh hoặc phúc khảo.

Khi thông tin được trao đổi qua nhiều tệp và kênh khác nhau, việc tổng hợp có thể mất thời gian và khó truy vết. Bài toán không chỉ là cộng điểm: hệ thống còn cần phân biệt điểm sinh viên tự đánh giá với điểm do cán bộ chốt, quản lý dữ liệu theo từng kỳ, kiểm soát quyền truy cập và lưu lịch sử kết quả đã công bố.

Từ bối cảnh đó, đề tài xây dựng hệ thống EduPoint nhằm hỗ trợ quy trình đánh giá điểm rèn luyện trên nền tảng web. Hệ thống tổ chức các chức năng theo vai trò sinh viên, cán bộ khoa và quản trị viên; hỗ trợ quản lý kỳ đánh giá, tiêu chí, minh chứng, căn cứ, hoạt động, chấm điểm, công bố và phúc khảo. Những nội dung cần người có thẩm quyền xác nhận không được xem là quyết định tự động của hệ thống.

Báo cáo gồm năm chương: tổng quan đề tài; cơ sở lý thuyết; phân tích và thiết kế hệ thống; triển khai và đánh giá kết quả; kết luận và hướng phát triển.

# 1. TỔNG QUAN ĐỀ TÀI

## 1.1. Đặt vấn đề

Trong quá trình đánh giá điểm rèn luyện, dữ liệu liên quan đến một sinh viên có thể đến từ nhiều nguồn: tự khai báo, minh chứng do sinh viên cung cấp, kết quả học vụ, danh sách hoạt động và xác nhận của cán bộ. Không phải tiêu chí nào cũng có cùng loại căn cứ. Có trường hợp sinh viên có thể đính kèm tệp; có trường hợp cần căn cứ tổng hợp hoặc thông tin do đơn vị quản lý cung cấp.

Nếu chỉ sử dụng các bảng tính riêng lẻ, cán bộ phải đối chiếu nhiều nguồn, kiểm tra trùng lặp và tổng hợp kết quả thủ công. Việc thay đổi dữ liệu hoặc gửi lại một kết quả cũng đòi hỏi xác định rõ phiên bản nào là bản được công bố. Mặt khác, dữ liệu điểm và minh chứng có tính cá nhân, vì vậy cần giới hạn quyền truy cập theo vai trò, đơn vị và kỳ đánh giá.

EduPoint được xây dựng để hỗ trợ các bước trên trong một hệ thống thống nhất, đồng thời giữ vai trò quyết định của người có thẩm quyền đối với việc xác minh và chốt điểm.

## 1.2. Mục tiêu đề tài

Mục tiêu tổng quát là xây dựng ứng dụng web hỗ trợ quản lý quy trình đánh giá điểm rèn luyện sinh viên theo kỳ. Các mục tiêu cụ thể gồm:

1. Quản lý tài khoản, đơn vị, lớp, kỳ đánh giá và bộ tiêu chí.
2. Hỗ trợ sinh viên tự đánh giá, cung cấp minh chứng và theo dõi trạng thái hồ sơ.
3. Hỗ trợ cán bộ khoa xem xét, xác minh căn cứ, quản lý hoạt động và chốt điểm theo phạm vi được phân quyền.
4. Hỗ trợ quản trị viên tiếp nhận, công bố kết quả và quản lý vòng đời kỳ đánh giá.
5. Hỗ trợ xử lý phúc khảo, ghi nhận lịch sử và tra cứu báo cáo.
6. Nghiên cứu khả năng nhập căn cứ từ tệp và hỗ trợ các thao tác theo lô nhằm giảm công việc lặp lại.

## 1.3. Đối tượng và phạm vi nghiên cứu

**Đối tượng sử dụng:** sinh viên (`STUDENT`), cán bộ khoa (`STAFF`) và quản trị viên (`ADMIN`). Đây là các vai trò có trong mô hình hiện tại. Các chức danh như lớp trưởng hoặc giảng viên phụ trách chưa được xem là một vai trò tài khoản độc lập trong phạm vi báo cáo.

**Đối tượng nghiên cứu:** quy trình đánh giá rèn luyện theo kỳ; cách quản lý tiêu chí và căn cứ; tổ chức dữ liệu hồ sơ, điểm, minh chứng và kết quả; các phương pháp phát triển ứng dụng web nhiều vai trò.

**Phạm vi:** ứng dụng web và dịch vụ backend của EduPoint, cơ sở dữ liệu PostgreSQL và chức năng lưu tệp theo cấu hình Supabase Storage. Việc áp dụng quy chế thực tế, kết nối nguồn dữ liệu học vụ, triển khai sản xuất và kết quả kiểm thử đầy đủ cần được xác minh riêng. Các thành phần hỗ trợ AI hiện được để cho giai đoạn sau; báo cáo không xem AI là chức năng đã được nghiệm thu.

## 1.4. Phương pháp nghiên cứu

Đề tài sử dụng phương pháp khảo sát tài liệu nghiệp vụ và trao đổi với người sử dụng; phân tích yêu cầu và phân quyền; mô hình hóa quy trình, dữ liệu và kiến trúc; triển khai phần mềm theo từng phân hệ; và kiểm thử bằng các tình huống chức năng, kiểm tra kiểu dữ liệu cùng kiểm tra tích hợp khi có môi trường phù hợp. Các quyết định về quy chế cần đối chiếu văn bản chính thức và xác nhận của đơn vị phụ trách.

## 1.5. Ý nghĩa khoa học và thực tiễn

### 1.5.1. Ý nghĩa về kỹ thuật

Đề tài vận dụng các kiến thức về kiến trúc ứng dụng web, thiết kế API, cơ sở dữ liệu quan hệ, phân quyền và quản lý trạng thái nghiệp vụ vào một bài toán có nhiều tác nhân và dữ liệu liên quan. Bài toán cũng minh họa việc phân biệt dữ liệu đầu vào, điểm gợi ý và kết quả chính thức trong thiết kế phần mềm.

### 1.5.2. Ý nghĩa thực tiễn

Hệ thống hướng tới giảm thao tác tổng hợp thủ công, giúp người dùng theo dõi tiến độ và tăng khả năng truy vết kết quả theo kỳ. Giá trị thực tế cần được đánh giá thêm thông qua thử nghiệm với cán bộ và sinh viên trên quy trình được đơn vị sử dụng phê duyệt.

# 2. CƠ SỞ LÝ THUYẾT

## 2.1. Đánh giá kết quả rèn luyện sinh viên

Đánh giá rèn luyện có thể được tổ chức theo kỳ, trong đó kết quả được xác định dựa trên các tiêu chí, mức điểm và căn cứ tương ứng. Trong thiết kế EduPoint, rubric biểu diễn bộ tiêu chí có phiên bản; mỗi tiêu chí có cấu hình và giới hạn điểm tương ứng. Nội dung và cách áp dụng phải căn cứ quy định được phê duyệt; báo cáo này không tự đặt ra quy chế hoặc khẳng định mức điểm đang phù hợp mọi trường hợp.

Việc tạo kỳ mới không mặc nhiên đồng nghĩa thay đổi nội dung rubric. Theo quyết định nghiệp vụ đã ghi nhận trong dự án, bộ tiêu chí hiện hành được giữ nguyên khi không có thay đổi thực sự; bản ghi hoặc snapshot theo kỳ phục vụ việc lưu lịch sử. Việc đơn giản hóa thao tác dùng lại rubric trong ứng dụng vẫn cần được đối chiếu và hoàn thiện.

## 2.2. Quản lý quy trình nghiệp vụ và trạng thái

Quy trình nghiệp vụ là tập hợp các bước và điều kiện chuyển tiếp nhằm đạt được một kết quả. Trong EduPoint, một phiếu có thể trải qua các bước từ tự đánh giá, nộp, thẩm định, chốt, bàn giao đến công bố. Một số trường hợp cần bổ sung thông tin hoặc phúc khảo trước khi tiếp tục.

Thiết kế theo trạng thái giúp hệ thống kiểm tra hành động nào được phép tại từng thời điểm. Ví dụ, điểm do sinh viên tự đánh giá, điểm gợi ý từ dữ liệu xác minh và điểm chính thức là các giá trị khác nhau. Chốt tiêu chí cũng không đồng nghĩa với gửi phiếu hoặc công bố kết quả; mỗi thao tác có điều kiện và trách nhiệm riêng.

## 2.3. Kiến trúc ứng dụng web

Ứng dụng web thường được tổ chức thành giao diện người dùng, dịch vụ xử lý nghiệp vụ và tầng lưu trữ. Giao diện gửi yêu cầu đến API; backend xác thực, kiểm tra dữ liệu và quyền truy cập, thực hiện nghiệp vụ, sau đó đọc hoặc ghi cơ sở dữ liệu trước khi phản hồi.

Việc phân tách các tầng giúp mã nguồn dễ quản lý hơn và cho phép kiểm tra quy tắc quan trọng ở backend. Kiểm tra trên giao diện giúp người dùng nhập thuận tiện nhưng không thay thế kiểm tra tại API.

## 2.4. Cơ sở dữ liệu quan hệ và tính nhất quán

Cơ sở dữ liệu quan hệ tổ chức dữ liệu thành bảng, dùng khóa và quan hệ để liên kết các thực thể. Trong hệ thống đánh giá, tài khoản sinh viên liên hệ với lớp; lớp thuộc khoa; phiếu gắn với sinh viên, kỳ và phiên bản rubric; kết quả từng tiêu chí gắn với phiếu và dữ liệu xác minh.

Các ràng buộc duy nhất, khóa ngoại và transaction góp phần hạn chế dữ liệu trùng hoặc cập nhật dở dang. Khi nhiều yêu cầu cùng thay đổi dữ liệu, hệ thống còn phải kiểm tra điều kiện nghiệp vụ và xử lý đồng thời; ràng buộc cơ sở dữ liệu không thay thế toàn bộ logic ở service.

## 2.5. Xác thực và phân quyền

Xác thực dùng để xác định người dùng; phân quyền xác định hành động và phạm vi dữ liệu mà người đó được phép truy cập. EduPoint sử dụng JWT do backend phát hành và phân quyền theo vai trò. Bên cạnh vai trò chung, các nghiệp vụ liên quan đến khoa và kỳ cần kiểm tra thêm phạm vi dữ liệu tương ứng. Snapshot đơn vị theo kỳ giúp giữ bối cảnh lịch sử khi thông tin tổ chức hiện tại thay đổi.

## 2.6. Kiểm thử phần mềm

Kiểm thử được dùng để tìm sai lệch giữa hành vi thực tế và yêu cầu. Kiểm thử đơn vị có thể tập trung vào hàm tính điểm hoặc kiểm tra dữ liệu; kiểm thử tích hợp xem xét sự phối hợp giữa service và cơ sở dữ liệu; kiểm thử giao diện xác minh luồng thao tác người dùng. Mỗi loại có giới hạn: kiểm thử bằng dữ liệu giả trong bộ nhớ không chứng minh được toàn bộ hành vi đồng thời của PostgreSQL hoặc tính sẵn sàng của dịch vụ bên ngoài.

# 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

## 3.1. Phát biểu yêu cầu hệ thống

### 3.1.1. Tác nhân và nhu cầu

| Tác nhân | Nhu cầu chính |
|---|---|
| Sinh viên | Xem kỳ và tiêu chí; tự đánh giá; cung cấp căn cứ; theo dõi kết quả và gửi phúc khảo khi phù hợp. |
| Cán bộ khoa | Theo dõi hồ sơ thuộc phạm vi; xác minh căn cứ; quản lý hoạt động; chấm điểm và bàn giao kết quả. |
| Quản trị viên | Quản lý dữ liệu nền, tài khoản, kỳ, rubric; tiếp nhận, công bố và giám sát. |

### 3.1.2. Yêu cầu chức năng

| Mã | Yêu cầu |
|---|---|
| FR01 | Đăng nhập và giới hạn quyền theo vai trò, phạm vi dữ liệu. |
| FR02 | Quản lý khoa, lớp, tài khoản, kỳ đánh giá và bộ tiêu chí. |
| FR03 | Cho phép sinh viên lưu, kiểm tra và nộp phiếu tự đánh giá. |
| FR04 | Quản lý minh chứng, tệp và yêu cầu bổ sung theo luồng nghiệp vụ. |
| FR05 | Hỗ trợ cán bộ xác minh dữ liệu, tính điểm gợi ý và chốt điểm. |
| FR06 | Quản lý hoạt động và xác nhận hoặc thu hồi thông tin tham gia. |
| FR07 | Bàn giao, tiếp nhận, công bố và lưu phiên bản kết quả. |
| FR08 | Hỗ trợ phúc khảo và xử lý điều chỉnh theo quyền. |
| FR09 | Thống kê, tra cứu và xuất dữ liệu phù hợp phạm vi được cấp. |
| FR10 | Hỗ trợ nhập căn cứ theo lô và chốt nhiều phiếu khi tính năng được cấu hình, triển khai và xác minh. |

### 3.1.3. Yêu cầu phi chức năng

Hệ thống cần dễ sử dụng, có thông báo khi xử lý dữ liệu thiếu hoặc không hợp lệ, bảo vệ dữ liệu theo quyền và lưu dấu các thao tác quan trọng. Tính đúng đắn, khả năng khôi phục khi lỗi và khả năng vận hành với dữ liệu lớn cần được kiểm thử theo môi trường thực tế. Các chỉ tiêu về hiệu năng, số người dùng đồng thời và thời gian phản hồi hiện chưa có căn cứ để đưa ra con số nghiệm thu.

## 3.2. Phân tích use case

### 3.2.1. Xác định use case chính

| Mã | Use case | Tác nhân |
|---|---|---|
| UC01 | Đăng nhập và truy cập chức năng theo vai trò | Cả ba vai trò |
| UC02 | Tự đánh giá và nộp phiếu | Sinh viên |
| UC03 | Cung cấp, xem xét và yêu cầu bổ sung minh chứng | Sinh viên, cán bộ khoa |
| UC04 | Xác minh căn cứ và chốt điểm | Cán bộ khoa |
| UC05 | Quản lý hoạt động, điểm danh | Cán bộ khoa |
| UC06 | Bàn giao và công bố kết quả | Cán bộ khoa, quản trị viên |
| UC07 | Gửi và xử lý phúc khảo | Sinh viên, cán bộ, quản trị viên tùy chức năng |
| UC08 | Quản lý tài khoản, kỳ và rubric | Quản trị viên |
| UC09 | Nhập căn cứ, kiểm tra và chốt theo lô | Cán bộ khoa |

[Chèn hình 3.1: Biểu đồ use case tổng quát; vẽ lại từ các tác nhân và use case đã xác nhận.]

## 3.3. Đặc tả các use case chính

### 3.3.1. UC02 — Sinh viên tự đánh giá và nộp phiếu

**Tác nhân:** sinh viên. **Tiền điều kiện:** sinh viên đăng nhập và thuộc phạm vi kỳ cho phép thao tác. **Luồng chính:** sinh viên mở phiếu theo kỳ, xem tiêu chí, nhập điểm tự đánh giá và căn cứ liên quan, lưu thông tin; hệ thống kiểm tra điều kiện nộp, sinh viên xác nhận nộp. **Ngoại lệ:** dữ liệu thiếu, thời hạn hết hoặc hồ sơ không còn được chỉnh sửa; hệ thống thông báo lý do và không thực hiện thao tác không hợp lệ. **Hậu điều kiện:** phiếu được ghi nhận ở trạng thái đã nộp nếu các kiểm tra thành công.

### 3.3.2. UC04 — Xác minh căn cứ và chốt điểm

**Tác nhân:** cán bộ khoa. **Tiền điều kiện:** cán bộ có quyền trong phạm vi hồ sơ và kỳ cho phép xử lý. **Luồng chính:** cán bộ mở hồ sơ, xem khai báo và căn cứ, ghi nhận dữ liệu xác minh; hệ thống tính điểm gợi ý theo cấu hình tiêu chí; cán bộ xem xét và chốt điểm. **Ngoại lệ:** thiếu dữ liệu, cấu hình điểm chưa đầy đủ hoặc hồ sơ bị khóa; thông báo nội dung cần xử lý và không tự suy diễn giá trị thiếu. **Hậu điều kiện:** điểm chính thức và thông tin người chốt được ghi nhận đối với tiêu chí được chốt thành công.

### 3.3.3. UC06 — Bàn giao và công bố kết quả

**Tác nhân:** cán bộ khoa và quản trị viên. **Tiền điều kiện:** hồ sơ đáp ứng các kiểm tra sẵn sàng theo workflow. **Luồng chính:** cán bộ bàn giao kết quả; quản trị viên tiếp nhận, kiểm tra và thực hiện công bố; hệ thống lưu phiên bản kết quả tương ứng. **Ngoại lệ:** hồ sơ chưa đủ điều kiện, còn nội dung chờ xử lý hoặc kỳ không cho phép thao tác. **Hậu điều kiện:** bản công bố được lưu và có thể dùng cho chức năng tra cứu theo quyền.

### 3.3.4. UC09 — Nhập căn cứ theo lô

**Tác nhân:** cán bộ khoa. **Luồng dự kiến trong mã nguồn:** chọn loại dữ liệu, chuẩn bị tệp theo mẫu, tải lên để xem trước kết quả kiểm tra, sau đó xác nhận nhập các dòng phù hợp. Hệ thống cung cấp lịch sử và thao tác thu hồi theo điều kiện. Ô trống được giữ là thiếu dữ liệu, không tự chuyển thành 0 hoặc phủ định. Chốt theo lô là thao tác riêng với việc gửi kết quả; từng phiếu có kết quả xử lý riêng.

**Giới hạn:** chức năng F15 cần được xác minh trên môi trường có đầy đủ migration và qua giao diện trước khi mô tả là đã triển khai và vận hành thực tế.

## 3.4. Biểu đồ động và luồng xử lý

### 3.4.1. Luồng tự đánh giá

Sinh viên → giao diện phiếu → API tự đánh giá → kiểm tra quyền và điều kiện kỳ → lưu điểm, căn cứ và trạng thái phiếu → phản hồi kết quả → giao diện hiển thị trạng thái. Tệp minh chứng, nếu có, được quản lý qua dịch vụ lưu trữ theo cấu hình.

### 3.4.2. Luồng xác minh và công bố

Cán bộ khoa → mở hồ sơ và kiểm tra căn cứ → xác minh dữ liệu → hệ thống tính điểm gợi ý → cán bộ chốt → bàn giao → quản trị viên tiếp nhận và công bố → sinh viên tra cứu kết quả theo điều kiện công bố.

### 3.4.3. Luồng nhập căn cứ

Cán bộ khoa → chọn kỳ và loại căn cứ → tải tệp, xem trước kết quả hợp lệ/lỗi/bỏ qua → xác nhận lô → backend kiểm tra lại dữ liệu và phạm vi → lưu các bản ghi phù hợp → hiển thị kết quả nhập. Khi phát sinh lỗi hoặc cần thu hồi, hệ thống xử lý theo điều kiện của lô và trạng thái hồ sơ.

[Chèn các hình 3.2–3.4: Biểu đồ hoạt động hoặc biểu đồ trình tự cho ba luồng trên.]

## 3.5. Thiết kế cơ sở dữ liệu

### 3.5.1. Các nhóm thực thể chính

| Nhóm | Thực thể tiêu biểu | Vai trò |
|---|---|---|
| Tổ chức và người dùng | `Faculty`, `Class`, `User` | Quản lý đơn vị, lớp, tài khoản và quan hệ giữa các đối tượng. |
| Kỳ và tiêu chí | `Term`, `RubricVersion`, `RubricCategory`, `Criterion` | Quản lý kỳ và bộ tiêu chí theo phiên bản. |
| Hồ sơ và điểm | `AssessmentSubmission`, `AssessmentHandoff`, `CriterionAssessment`, `AssessmentPublication` | Quản lý phiếu, trạng thái bàn giao, điểm từng tiêu chí và bản công bố. |
| Minh chứng | `Evidence`, `EvidenceFile`, `Review`, `SupplementRequest` | Lưu hồ sơ minh chứng, thông tin tệp và quá trình xem xét. |
| Hoạt động | `Activity`, `ActivityParticipant` | Quản lý hoạt động và thông tin sinh viên tham gia. |
| Hỗ trợ nghiệp vụ | `Appeal`, `Notification`, `AuditLog`, `AssessmentDeadlineExtension` | Quản lý phúc khảo, thông báo, nhật ký và gia hạn. |
| Nhập căn cứ | `ImportBatch`, `AcademicGrounding` | Quản lý lô và căn cứ học vụ trong tính năng F15; phụ thuộc migration tương ứng. |

### 3.5.2. Quan hệ và yêu cầu dữ liệu

Một khoa có thể có nhiều lớp; sinh viên gắn với lớp. Một kỳ có thể có bộ tiêu chí theo phiên bản. Phiếu và điểm được gắn với sinh viên, kỳ và tiêu chí; kết quả công bố được lưu theo phiên bản để hỗ trợ truy vết. Snapshot đơn vị và lớp tại kỳ được sử dụng trong workflow để tránh nhầm lẫn với thông tin hiện tại khi tra cứu lịch sử.

[Chèn hình 3.5: ERD trích từ schema Prisma tại thời điểm hoàn thiện báo cáo. Không đưa thông tin cá nhân hoặc thông tin kết nối vào hình.]

## 3.6. Kiến trúc hệ thống

EduPoint được tổ chức theo luồng: trình duyệt chạy ứng dụng React → `apiClient` gửi HTTP → backend NestJS kiểm tra JWT, role và DTO → controller chuyển yêu cầu cho service nghiệp vụ → Prisma truy cập PostgreSQL hoặc dịch vụ lưu tệp → backend trả phản hồi cho giao diện. Backend sử dụng service và Prisma trực tiếp, không có repository layer riêng trong luồng chính.

Các service nghiệp vụ tách theo nhóm như tài khoản, tiêu chí, tự đánh giá, minh chứng, hoạt động, workflow, phúc khảo và báo cáo. `WorkflowService` cùng các thành phần liên quan xử lý phạm vi kỳ, snapshot, bàn giao và công bố. Tên và phạm vi module thực tế cần được đối chiếu phiên bản mã nguồn tại lúc nộp báo cáo.

[Chèn hình 3.6: Sơ đồ kiến trúc frontend–API–service–database/storage.]

## 3.7. Thiết kế giao diện hệ thống

Giao diện chia theo ba vai trò, giúp người dùng tiếp cận các chức năng phù hợp. Các màn hình tiêu biểu gồm đăng nhập, phiếu sinh viên, danh sách hồ sơ theo lớp, trang xác minh, hoạt động, quản lý kỳ và màn hình tiếp nhận kết quả. Khi triển khai báo cáo chính thức, nhóm cần chụp hình từ môi trường được phép, sử dụng dữ liệu mẫu và giải thích từng thao tác chính.

[Chèn hình 3.7: Màn hình sinh viên.]  
[Chèn hình 3.8: Màn hình cán bộ khoa.]  
[Chèn hình 3.9: Màn hình quản trị.]

## 3.8. Công nghệ sử dụng

| Thành phần | Công nghệ theo mã nguồn | Vai trò |
|---|---|---|
| Frontend | React, TypeScript, Vite, React Router, Tailwind CSS | Xây dựng giao diện web và điều hướng. |
| HTTP client và Excel | Axios, xlsx | Giao tiếp API và xử lý tệp bảng tính trong các chức năng liên quan. |
| Backend | NestJS, TypeScript, Passport/JWT | Xây dựng API, xác thực và nghiệp vụ. |
| Truy cập dữ liệu | Prisma | Mô hình dữ liệu và truy cập cơ sở dữ liệu. |
| Cơ sở dữ liệu | PostgreSQL | Lưu dữ liệu nghiệp vụ có quan hệ. |
| Lưu trữ | Supabase Storage theo cấu hình | Lưu và truy cập tệp minh chứng. |

# 4. TRIỂN KHAI VÀ ĐÁNH GIÁ KẾT QUẢ

## 4.1. Giao diện chính

### 4.1.1. Đăng nhập và điều hướng

Người dùng đăng nhập và được đưa đến khu vực chức năng tương ứng với vai trò. Quyền ở giao diện cần đi kèm kiểm tra tại backend. [Bổ sung ảnh màn hình đăng nhập và mô tả phiên bản triển khai.]

### 4.1.2. Khu vực sinh viên

Sinh viên có thể tiếp cận phiếu điểm, thông tin tiêu chí và các chức năng liên quan đến căn cứ, minh chứng, kết quả hoặc phúc khảo tùy trạng thái kỳ. [Bổ sung ảnh và mô tả luồng thao tác đã kiểm chứng.]

### 4.1.3. Khu vực cán bộ khoa

Khu vực cán bộ tập trung theo dõi hồ sơ thuộc khoa, xử lý xác minh, hoạt động và bàn giao. Các trạng thái và cảnh báo hỗ trợ người dùng xác định nội dung cần xử lý. [Bổ sung ảnh danh sách hồ sơ, xác minh và hoạt động.]

### 4.1.4. Khu vực quản trị

Quản trị viên có các màn hình liên quan đến dữ liệu nền, kỳ đánh giá, tài khoản, tiếp nhận kết quả và giám sát. [Bổ sung ảnh giao diện và mô tả những chức năng đã kiểm chứng.]

## 4.2. Kết quả xây dựng theo mã nguồn

Mã nguồn hiện có các phân hệ tài khoản, quản lý kỳ và tiêu chí, tự đánh giá, minh chứng, hoạt động, workflow công bố, phúc khảo, thông báo và báo cáo. Tính năng nhập căn cứ và chốt theo lô đã có mã nguồn và tài liệu F15, nhưng việc áp dụng migration và nghiệm thu trên từng môi trường phải được kiểm tra riêng.

Nhật ký dự án ngày 17/11/2026 ghi nhận bộ dữ liệu trình diễn gồm 5 lớp và 100 sinh viên giả lập; trong đó 60 phiếu đã nộp, 20 phiếu nháp và 20 sinh viên chưa tạo phiếu. Với 60 phiếu đã nộp, TC1, TC3 và TC7 có dữ liệu điểm giả lập gắn nhãn DEMO; các tiêu chí còn lại chưa được chấm trong bộ dữ liệu mẫu này và chưa công bố kết quả. Các số liệu trên là dữ liệu mô phỏng để trình diễn, không phản ánh kết quả rèn luyện thực tế.

## 4.3. Kiểm thử và đánh giá

| Nhóm kiểm thử | Nội dung cần kiểm tra | Trạng thái trình bày |
|---|---|---|
| Đăng nhập và phân quyền | Sai thông tin đăng nhập; truy cập khác vai trò hoặc ngoài phạm vi khoa. | [Bổ sung kết quả, ngày chạy, môi trường và minh chứng.] |
| Tự đánh giá | Lưu nháp, nộp phiếu, kiểm tra dữ liệu thiếu và hết hạn. | [Bổ sung.] |
| Xác minh và chốt điểm | Dữ liệu hợp lệ, thiếu căn cứ, vượt trần, hồ sơ bị khóa. | [Bổ sung.] |
| Hoạt động và căn cứ | Nhập trùng, ô trống, xác nhận/thu hồi và tính lại điểm. | [Bổ sung.] |
| Bàn giao và công bố | Điều kiện sẵn sàng, lưu phiên bản và tra cứu theo quyền. | [Bổ sung.] |
| Phúc khảo | Tạo yêu cầu, xử lý và theo dõi điều chỉnh theo trạng thái. | [Bổ sung.] |
| Nhập và chốt theo lô | Preview, xác nhận, thu hồi, xử lý từng phiếu và kiểm thử đồng thời. | [Bổ sung; xác nhận migration và môi trường.] |

Nhật ký dự án ghi nhận một đợt kiểm thử liên quan F15 gồm 89 kiểm thử unit/component và một kiểm thử PostgreSQL cách ly, kèm typecheck; đây là kết quả lịch sử được ghi trong dự án, không phải kết quả được chạy lại khi viết bản thảo. Nhật ký cũng nêu các giới hạn về kiểm thử trình duyệt và một số tình huống đồng thời. Cần trích xuất log, đối chiếu phiên bản và chạy lại kiểm thử cần thiết trước khi công bố kết quả trong báo cáo chính thức.

## 4.4. Đánh giá và hạn chế

Hệ thống đã hình thành cấu trúc nghiệp vụ tương đối đầy đủ cho việc quản lý kỳ, hồ sơ và kết quả; việc phân biệt điểm tự đánh giá, điểm gợi ý và điểm chính thức hỗ trợ minh bạch luồng xử lý. Thiết kế theo vai trò và snapshot giúp biểu diễn phạm vi trách nhiệm và bối cảnh lịch sử.

Tuy nhiên, việc có mã nguồn không đồng nghĩa mọi chức năng đã được nghiệm thu. Các nội dung cần tiếp tục xác minh gồm: nghiệp vụ với đơn vị sử dụng; kiểm thử xuyên suốt trên trình duyệt; xử lý đồng thời trên PostgreSQL; trạng thái migration của môi trường triển khai; và khả năng vận hành khi có dữ liệu, người dùng thực tế. Một số quy định và trường hợp biên còn cần chủ nghiệp vụ xác nhận.

Thành phần AI có cấu trúc tích hợp trong mã nguồn nhưng đang được hoãn trong phạm vi triển khai hiện tại. Chưa có căn cứ để khẳng định mô hình AI hoạt động chính xác, đạt độ đo cụ thể hoặc được dùng để tự quyết định điểm chính thức.

# 5. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 5.1. Kết luận

Đề tài trình bày hướng xây dựng EduPoint nhằm hỗ trợ đánh giá rèn luyện sinh viên trên nền tảng web. Hệ thống tổ chức chức năng theo ba vai trò và mô hình hóa các bước từ tự đánh giá, xác minh, chấm điểm đến công bố và phúc khảo. Thiết kế nhấn mạnh quản lý theo kỳ, phân quyền, lịch sử và phân biệt các loại điểm trong quy trình.

Bản thảo này dựa trên mã nguồn, tài liệu dự án và nhật ký kiểm thử hiện có. Mức độ hoàn thiện thực tế, phạm vi triển khai và kết quả thử nghiệm cần tiếp tục đối chiếu với phiên bản phần mềm, môi trường triển khai và yêu cầu được đơn vị sử dụng xác nhận.

## 5.2. Hướng phát triển

1. Hoàn thiện và nghiệm thu các luồng trên môi trường thử nghiệm, đặc biệt là nhập căn cứ, thu hồi, chốt phiếu và công bố.
2. Xác nhận các trường hợp nghiệp vụ còn mở với khoa và đơn vị quản lý sinh viên; đối chiếu quy chế chính thức theo từng kỳ.
3. Cải thiện trải nghiệm nhập dữ liệu hàng loạt, thông báo lỗi và khả năng truy vết nguồn căn cứ.
4. Đánh giá tích hợp nguồn dữ liệu học vụ hoặc danh sách hoạt động khi có quyền và phương án bảo vệ dữ liệu phù hợp.
5. Nghiên cứu AI hỗ trợ phân loại hoặc gợi ý căn cứ sau khi có dữ liệu, tiêu chí đánh giá và cơ chế kiểm soát; giữ người có thẩm quyền ở bước quyết định.
6. Bổ sung đo lường hiệu năng, kiểm thử bảo mật, kiểm thử đồng thời và quy trình vận hành trước khi sử dụng rộng rãi.

# TÀI LIỆU THAM KHẢO

[1] Nhóm phát triển EduPoint, *Tài liệu dự án EduPoint*: `docs/PROJECT_OVERVIEW.md`, `docs/BUSINESS_RULES.md`, `docs/API_CONTRACT.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, truy cập bản mã nguồn dùng để viết báo cáo ngày 17/11/2026.

[2] Nhóm phát triển EduPoint, *Đặc tả căn cứ minh chứng, nhập dữ liệu hàng loạt và chốt phiếu*: `docs/features/15-evidence-grounding-and-batch-finalize.md`.

[3] [Bổ sung tên, số hiệu, ngày ban hành và đường dẫn văn bản chính thức về đánh giá rèn luyện được đơn vị áp dụng.]

[4] [Bổ sung tài liệu chính thức của React, NestJS, Prisma, PostgreSQL và Supabase; ghi ngày truy cập theo quy định trích dẫn của khoa.]

# PHỤ LỤC: DANH SÁCH CẦN HOÀN THIỆN

- Xác nhận tên đề tài, loại đồ án, thành viên, lớp, nhóm và người hướng dẫn.
- Cập nhật mục lục, danh mục hình và bảng trong Word sau khi hoàn tất nội dung và đánh số trang.
- Bổ sung văn bản quy định chính thức, sơ đồ use case, hoạt động, trình tự, ERD và kiến trúc.
- Chụp ảnh giao diện bằng dữ liệu mẫu, che thông tin cá nhân và thông tin kết nối.
- Xác minh môi trường triển khai, migration, kết quả kiểm thử và các chức năng thực sự sử dụng trước khi bảo vệ.
- Viết lại phần phân công, thời gian thực hiện, đánh giá cá nhân và định dạng trích dẫn theo yêu cầu giảng viên.
