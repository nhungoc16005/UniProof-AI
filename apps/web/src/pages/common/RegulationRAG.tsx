import React, { useState } from 'react';
import { 
  HelpCircle, 
  Send, 
  BookOpen, 
  ExternalLink, 
  ThumbsUp, 
  ThumbsDown, 
  Sparkles, 
  AlertCircle,
  Copy,
  Check,
  Compass,
  FileText,
  Bookmark,
  Share2,
  Search
} from 'lucide-react';

interface Citation {
  title: string;
  section: string;
  excerpt: string;
  page: number;
  article: string;
}

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  content: string;
  citations?: Citation[];
  isNoEvidence?: boolean;
  liked?: boolean | null;
}

export const RegulationRAG: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-01',
      sender: 'USER',
      content: 'Cuộc thi Hackathon cấp thành phố thuộc tiêu chí nào và tối đa được mấy điểm?',
    },
    {
      id: 'm-02',
      sender: 'AI',
      content: 'Theo Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1), Cuộc thi Hackathon học thuật cấp Thành phố thuộc Tiêu chí 1.2 (Ý thức học tập & nghiên cứu khoa học). Sinh viên đạt giải Ba được cộng 5.0 điểm / hoạt động; giải Nhất được tối đa 10.0 điểm.',
      citations: [
        {
          title: 'Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1)',
          article: 'Điều 4',
          section: 'Điều 4 · Khoản 2 · Điểm b',
          excerpt: 'Sinh viên đạt giải thưởng các cuộc thi học thuật, tin học, khởi nghiệp sáng tạo cấp Thành phố hoặc tương đương được tính từ 5.0 đến 10.0 điểm vào Tiêu chí 1.2 (Ý thức học tập).',
          page: 4,
        },
      ],
      liked: null,
    },
    {
      id: 'm-03',
      sender: 'USER',
      content: 'Một giấy khen có được dùng để tính điểm 2 lần ở 2 tiêu chí khác nhau không?',
    },
    {
      id: 'm-04',
      sender: 'AI',
      content: 'Hoàn toàn không được phép. Mỗi minh chứng chỉ được tính điểm duy nhất cho 01 tiêu chí trong cùng một học kỳ. Hệ thống sẽ kích hoạt cờ trùng lặp (Duplicate Detection) và từ chối nếu phát hiện nộp nhiều lần.',
      citations: [
        {
          title: 'Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1)',
          article: 'Điều 2',
          section: 'Điều 2 · Khoản 4 · Nguyên tắc xét duyệt độc lập',
          excerpt: 'Mỗi văn bản minh chứng chỉ được sử dụng để đề xuất điểm cho một tiêu chí duy nhất. Nghiêm cấm hành vi sử dụng một minh chứng hoặc chia nhỏ để cộng điểm nhiều lần.',
          page: 2,
        },
      ],
      liked: true,
    },
  ]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(messages[1].citations?.[0] || null);
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptSuggestions = [
    { label: '🩸 Quy chế cộng điểm hiến máu nhân đạo?', prompt: 'Hiến máu nhân đạo được cộng mấy điểm và nộp giấy tờ gì?' },
    { label: '🏆 Giải Nhất Hackathon được tối đa mấy điểm?', prompt: 'Cuộc thi Hackathon cấp thành phố thuộc tiêu chí nào và tối đa được mấy điểm?' },
    { label: '⭐ Điều kiện đạt mức điểm Rèn luyện Xuất sắc?', prompt: 'Cần bao nhiêu điểm để đạt mức rèn luyện Xuất sắc và có giới hạn điểm từng tiêu chí không?' },
    { label: '❌ Nộp trùng 1 minh chứng có bị phạt không?', prompt: 'Một giấy khen có được dùng để tính điểm 2 lần ở 2 tiêu chí khác nhau không?' },
  ];

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || inputQuestion).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `m-${Date.now()}`,
      sender: 'USER',
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsTyping(true);

    setTimeout(() => {
      let aiReply: Message;

      if (query.toLowerCase().includes('nấu ăn') || query.toLowerCase().includes('du lịch')) {
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          content: 'Không tìm thấy thông tin đủ căn cứ pháp lý trong tài liệu Quy chế ĐRL hiện hành. Trợ lý AI tuân thủ nguyên tắc không suy đoán ngoài văn bản quy chế.',
          isNoEvidence: true,
          liked: null,
        };
      } else if (query.toLowerCase().includes('hiến máu')) {
        const citation: Citation = {
          title: 'Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1)',
          article: 'Điều 6',
          section: 'Điều 6 · Khoản 1 · Hoạt động Tình nguyện vì cộng đồng',
          excerpt: 'Mỗi lần tham gia hiến máu tình nguyện được cấp Giấy chứng nhận hợp lệ sẽ được cộng 5.0 điểm vào Tiêu chí 3 (Ý thức tham gia hoạt động chính trị - xã hội). Điểm tối đa không vượt quá trần quy định của tiêu chí.',
          page: 6,
        };
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          content: 'Mỗi lần tham gia hiến máu tình nguyện được cộng 5.0 điểm vào Tiêu chí 3 (Ý thức tham gia hoạt động chính trị - xã hội). Sinh viên cần tải ảnh chụp rõ nét Giấy chứng nhận hiến máu của Hội Chữ thập đỏ hoặc Viện Huyết học.',
          citations: [citation],
          liked: null,
        };
        setActiveCitation(citation);
      } else if (query.toLowerCase().includes('xuất sắc')) {
        const citation: Citation = {
          title: 'Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1)',
          article: 'Điều 8',
          section: 'Điều 8 · Khoản 1 · Phân loại kết quả rèn luyện',
          excerpt: 'Xếp loại Xuất sắc: Tổng điểm rèn luyện đạt từ 90 đến 100 điểm, đồng thời không có tiêu chí thành phần nào bị điểm 0 và không bị kỷ luật từ mức Khiển trách trở lên trong học kỳ.',
          page: 8,
        };
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          content: 'Để đạt xếp loại Xuất sắc, sinh viên cần đạt tổng điểm từ 90 đến 100 điểm, đồng thời không có tiêu chí thành phần nào bị 0 điểm và không bị xử lý kỷ luật từ mức Khiển trách trở lên.',
          citations: [citation],
          liked: null,
        };
        setActiveCitation(citation);
      } else {
        const citation: Citation = {
          title: 'Quy chế Đánh giá Kết quả Rèn luyện Sinh viên (v2025.1)',
          article: 'Điều 5',
          section: 'Điều 5 · Khoản 3 · Hoạt động Ngoại khóa & Rèn luyện',
          excerpt: 'Hoạt động có giấy xác nhận hợp lệ của Ban tổ chức được xem xét cộng từ 2.0 đến 5.0 điểm tùy thuộc quy mô cấp trường hay cấp thành phố.',
          page: 5,
        };
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          content: 'Hoạt động này được tính điểm theo Điều 5 Khoản 3 của Quy chế ĐRL (cộng từ 2.0 đến 5.0 điểm tùy thuộc quy mô cấp trường hay cấp tỉnh/thành phố).',
          citations: [citation],
          liked: null,
        };
        setActiveCitation(citation);
      }

      setMessages((prev) => [...prev, aiReply]);
      setIsTyping(false);
    }, 1000);
  };

  const handleCopyExcerpt = () => {
    if (activeCitation) {
      navigator.clipboard.writeText(`"${activeCitation.excerpt}" — [${activeCitation.section}]`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleFeedback = (msgId: string, isLike: boolean) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return { ...m, liked: m.liked === isLike ? null : isLike };
        }
        return m;
      })
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EduPoint RAG Intelligence v2.4</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            Trợ lý Pháp lý & Quy chế Điểm rèn luyện
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tra cứu mọi câu hỏi về điều kiện cộng điểm, quy chuẩn minh chứng và quy tắc trần điểm. Mọi câu trả lời của AI đều được bảo chứng bởi trích dẫn nguyên văn từ Quy chế số 2025/QĐ-ĐHBK.
          </p>
        </div>

        {/* Decorative element */}
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
      </div>

      {/* 2. Prompt Suggestion Pills */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
          Câu hỏi gợi ý phổ biến:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {promptSuggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(item.prompt)}
              className="text-xs bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 px-3 py-2 rounded-xl shadow-sm transition font-medium flex items-center gap-1.5"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View (Chat + Legal Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Chat Conversation (Col 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[560px]">
          
          <div className="space-y-5 overflow-y-auto max-h-[460px] pr-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-4 rounded-2xl text-xs leading-relaxed space-y-2.5 transition ${
                    m.sender === 'USER'
                      ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                      : m.isNoEvidence
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 rounded-bl-none shadow-sm'
                      : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-none shadow-sm hover:border-sky-300'
                  }`}
                >
                  {m.sender === 'AI' && (
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 text-[11px] font-bold text-sky-700">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                        <span>Trợ lý Quy chế EduPoint</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Bảo chứng trích dẫn</span>
                    </div>
                  )}

                  <p className="whitespace-pre-line">{m.content}</p>

                  {/* Citation pills */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold">Căn cứ:</span>
                      {m.citations.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveCitation(c)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] transition border ${
                            activeCitation?.section === c.section
                              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                              : 'bg-white hover:bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>[{c.section}]</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Feedback thumbs for AI replies */}
                  {m.sender === 'AI' && (
                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="text-[10px]">Câu trả lời này có hữu ích không?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFeedback(m.id, true)}
                          className={`p-1 rounded hover:bg-slate-200 transition ${
                            m.liked === true ? 'text-emerald-600 font-bold' : 'text-slate-400'
                          }`}
                          title="Hữu ích"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFeedback(m.id, false)}
                          className={`p-1 rounded hover:bg-slate-200 transition ${
                            m.liked === false ? 'text-rose-600 font-bold' : 'text-slate-400'
                          }`}
                          title="Chưa chính xác"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {m.sender === 'USER' ? 'Bạn' : 'EduPoint AI Assistant'}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-sky-50 border border-sky-200 rounded-xl max-w-xs text-xs text-sky-800 animate-pulse">
                <Sparkles className="w-4 h-4 text-sky-600 animate-spin" />
                <span>AI đang tra cứu văn bản quy chế v2025.1...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }} 
            className="mt-4 pt-3 border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Nhập câu hỏi về tiêu chí, điểm tối đa hoặc loại minh chứng cần nộp..."
              className="flex-1 px-4 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isTyping || !inputQuestion.trim()}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <span>Gửi</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Right Column: High-Tech Legal Inspector Panel (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wider">
              <Bookmark className="w-4 h-4 text-sky-600" />
              <span>Bảo chứng Pháp lý (Legal Inspector)</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
              ĐANG HIỆU LỰC
            </span>
          </div>

          {activeCitation ? (
            <div className="space-y-4 text-xs">
              
              {/* Document Header Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block text-[10px] font-mono">Văn bản nguồn căn cứ:</span>
                <span className="font-bold text-slate-900 block leading-tight">{activeCitation.title}</span>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Ban hành: 15/08/2025</span>
                  <span>·</span>
                  <span>Số: 2025/QĐ-ĐHBK</span>
                </div>
              </div>

              {/* Exact Section & Page */}
              <div className="flex items-center justify-between p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                <div>
                  <span className="text-sky-900 font-bold block">{activeCitation.section}</span>
                  <span className="text-sky-700 text-[11px]">Trang số: {activeCitation.page} / 32</span>
                </div>
                <span className="px-2 py-1 rounded bg-sky-600 text-white font-bold text-[10px]">
                  {activeCitation.article}
                </span>
              </div>

              {/* Excerpt with Highlighter Marker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700">Trích lục nguyên văn:</span>
                  <button
                    type="button"
                    onClick={handleCopyExcerpt}
                    className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Chép trích lục</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 bg-amber-50/70 border-l-4 border-amber-400 rounded-r-xl text-slate-800 italic leading-relaxed text-xs shadow-inner">
                  "{activeCitation.excerpt}"
                </div>
              </div>

              {/* Footer action buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <a
                  href="#view-full-pdf"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Đang mở toàn văn Quy chế (Trang ${activeCitation.page})...`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-sky-600 text-white font-semibold text-xs rounded-lg transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Mở toàn văn quy chế (PDF)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <button
                  type="button"
                  onClick={() => alert('Đã sao chép liên kết chia sẻ câu trả lời!')}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  title="Chia sẻ trích dẫn"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-16 space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Nhấp vào một trích dẫn trong câu trả lời để xem toàn văn đoạn quy chế.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
