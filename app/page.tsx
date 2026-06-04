"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Mood =
  | "hello"
  | "excited"
  | "great"
  | "nice"
  | "bored"
  | "cooking"
  | "cleaning"
  | "dishwashing"
  | "laundry"
  | "recycling"
  | "tidying"
  | "sleep";
type Todo = {
  id: string;
  title: string;
  due_time: string | null;
  done: boolean;
};

// 토리 기분/행동 → 이미지 / 비상용 이모지
const MOOD_IMG: Record<Mood, string> = {
  hello: "/tori/hello.png",
  excited: "/tori/excited.png",
  great: "/tori/great.png",
  nice: "/tori/nice.png",
  bored: "/tori/bored.png",
  cooking: "/tori/cooking.png",
  cleaning: "/tori/cleaning.png",
  dishwashing: "/tori/dishwashing.png",
  laundry: "/tori/laundry.png",
  recycling: "/tori/recycling.png",
  tidying: "/tori/tidying.png",
  sleep: "/tori/sleep.png",
};
const MOOD_EMOJI: Record<Mood, string> = {
  hello: "👋",
  excited: "🤩",
  great: "😆",
  nice: "😊",
  bored: "😐",
  cooking: "🍳",
  cleaning: "🧹",
  dishwashing: "🧽",
  laundry: "🧺",
  recycling: "♻️",
  tidying: "📦",
  sleep: "😴",
};

const FIRST: Message = {
  role: "assistant",
  content: "안녕? 나는 토리야. 궁금한 게 있으면 뭐든 물어봐!",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([FIRST]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>("hello");
  const [imgError, setImgError] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showQuests, setShowQuests] = useState(false);

  const recognitionRef = useRef<any>(null);
  const handleSendRef = useRef<(t?: string) => void>(() => {});
  const messagesRef = useRef<Message[]>(messages);
  const loadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 대화가 쌓이면 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 새로고침돼도 대화가 남도록 저장/복원
  useEffect(() => {
    const saved = sessionStorage.getItem("chat");
    if (saved) setMessages(JSON.parse(saved));
  }, []);
  useEffect(() => {
    sessionStorage.setItem("chat", JSON.stringify(messages));
  }, [messages]);

  // 브라우저 음성인식 준비
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      handleSendRef.current(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") {
        alert(
          "마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 → 마이크 허용으로 바꿔주세요.",
        );
      }
    };
    recognitionRef.current = recognition;
  }, []);

  // 매 렌더마다 최신 값을 ref에 보관 (stale closure 방지)
  useEffect(() => {
    handleSendRef.current = handleSend;
    messagesRef.current = messages;
  });

  // 퀘스트(할 일) 목록 불러오기 / 완료 토글
  async function loadTodos() {
    try {
      const res = await fetch("/api/todos");
      const data = await res.json();
      setTodos(data.todos ?? []);
    } catch {}
  }
  async function toggleTodo(id: string, done: boolean) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: !done }),
    });
    loadTodos();
  }
  function openQuests() {
    loadTodos();
    setShowQuests(true);
  }

  function toggleMic(e: React.MouseEvent) {
    e.preventDefault();
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("이 브라우저는 음성인식을 지원하지 않아요. 크롬에서 열어보세요.");
      return;
    }
    if (listening) {
      try {
        recognition.stop();
      } catch {}
      setListening(false);
    } else {
      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  async function handleSend(spokenText?: string) {
    const text = (spokenText ?? input).trim();
    if (!text || loadingRef.current) return;

    loadingRef.current = true;
    setInput("");
    setLoading(true);
    setNotice(null);

    const sendMessages: Message[] = [
      ...messagesRef.current,
      { role: "user" as const, content: text },
    ];
    setMessages(sendMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 토리가 맥락은 알되 너무 무겁지 않게 최근 대화만 보냄
        body: JSON.stringify({ messages: sendMessages.slice(-12) }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      if (data.mood) {
        setImgError(false);
        setMood(data.mood as Mood);
      }
      if (data.notice) {
        setNotice(data.notice);
        loadTodos(); // 퀘스트가 바뀌었으니 목록도 갱신
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "앗, 연결에 문제가 생겼어 😢" },
      ]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-screen bg-[#f6f6f7] text-gray-800">
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-md mx-auto">
        {/* 상단 바: 퀘스트 보기 */}
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={openQuests}
            aria-label="퀘스트 보기"
            title="퀘스트 보기"
            className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-lg shadow-sm hover:bg-gray-100 transition"
          >
            📋
          </button>
        </div>

        {/* 상단 알림 (퀘스트 추가/완료 등) — 누르면 퀘스트 패널 열림 */}
        {notice && (
          <div className="px-4 pt-3">
            <div
              onClick={openQuests}
              className="relative bg-gray-900 text-white rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-sm hover:bg-black transition cursor-pointer"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotice(null);
                }}
                aria-label="알림 닫기"
                className="absolute top-2 right-2.5 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/20 transition"
              >
                ✕
              </button>
              <div className="px-6">알림: {notice}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                방금 · 눌러서 퀘스트 보기
              </div>
            </div>
          </div>
        )}

        {/* 캐릭터 토리 (맨 위) — 이름 + 기분에 따라 표정이 바뀜 */}
        <div className="flex flex-col items-center pt-2 pb-3 shrink-0">
          <span className="text-sm font-bold text-gray-800 mb-1 tracking-wide">
            토리
          </span>
          {imgError ? (
            <div className="text-[96px] leading-none select-none">
              {MOOD_EMOJI[mood]}
            </div>
          ) : (
            <img
              key={mood}
              src={MOOD_IMG[mood]}
              alt={`토리 (${mood})`}
              onError={() => setImgError(true)}
              className="w-32 h-32 object-contain select-none transition-all duration-300"
            />
          )}
        </div>

        {/* 대화 — 아래로 쌓임 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2.5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <span
                className={
                  "inline-block max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap " +
                  (m.role === "user"
                    ? "bg-gray-900 text-white rounded-br-sm"
                    : "bg-white text-gray-900 rounded-bl-sm border border-gray-200")
                }
              >
                {m.content}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <span className="inline-flex items-center gap-1.5 bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-200">
                <Dot /> <Dot /> <Dot />
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div className="flex items-center gap-2 p-3 border-t border-gray-100">
          <button
            type="button"
            onClick={toggleMic}
            className={
              "rounded-full w-12 h-12 flex items-center justify-center text-xl transition shrink-0 " +
              (listening
                ? "bg-gray-900 text-white animate-pulse"
                : "bg-gray-200 hover:bg-gray-300")
            }
            title="음성으로 말하기"
          >
            🎤
          </button>
          <input
            className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={listening ? "듣고 있어요…" : "뭐든 물어봐!"}
            disabled={loading}
          />
          <button
            type="button"
            className="bg-gray-900 hover:bg-black text-white rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-50 transition shrink-0"
            onClick={() => handleSend()}
            disabled={loading}
          >
            보내기
          </button>
        </div>
      </div>

      {/* 퀘스트(할 일) 패널 — '퀘스트 보기' 누르면 아래에서 올라옴 */}
      {showQuests && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/30"
          onClick={() => setShowQuests(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-7 max-h-[70vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                📋 오늘의 퀘스트
              </h2>
              <button
                type="button"
                onClick={() => setShowQuests(false)}
                aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            {todos.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                아직 퀘스트가 없어요. 토리한테 추가해달라고 해봐! 🐣
              </p>
            ) : (
              <ul className="space-y-2.5">
                {todos.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2.5 text-sm bg-gray-100 rounded-xl px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTodo(t.id, t.done)}
                      className="mt-0.5 accent-gray-900 w-4 h-4"
                    />
                    <span
                      className={t.done ? "line-through text-gray-400" : ""}
                    >
                      {t.title}
                      {t.due_time && (
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {t.due_time}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Dot() {
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
  );
}
