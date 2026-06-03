"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Todo = {
  id: string;
  title: string;
  due_time: string | null;
  done: boolean;
};

const FIRST: Message = {
  role: "assistant",
  content: "오 안녕 ㅋㅋ 오늘 뭐 도와줄까?",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([FIRST]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  // 음성 핸들러가 항상 "최신 handleSend"를 부르도록 보관하는 ref
  const handleSendRef = useRef<(t?: string) => void>(() => {});
  // 항상 최신 messages / loading 값을 들고 있는 ref (stale closure 방지)
  const messagesRef = useRef<Message[]>(messages);
  const loadingRef = useRef(false);

  // 새로고침돼도 대화가 남도록 브라우저에 저장된 기록 불러오기
  useEffect(() => {
    const saved = sessionStorage.getItem("chat");
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  // 대화가 바뀔 때마다 브라우저에 저장
  useEffect(() => {
    sessionStorage.setItem("chat", JSON.stringify(messages));
  }, [messages]);

  async function loadTodos() {
    const res = await fetch("/api/todos");
    const data = await res.json();
    setTodos(data.todos);
  }

  useEffect(() => {
    loadTodos();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  // 마이크 버튼 (새로고침 방지)
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

  async function toggleTodo(id: string, done: boolean) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: !done }),
    });
    loadTodos();
  }

  async function handleSend(spokenText?: string) {
    const text = (spokenText ?? input).trim();
    if (!text || loadingRef.current) return;

    loadingRef.current = true;
    setInput("");
    setLoading(true);

    // ref로 "지금 화면에 떠 있는 최신 기록"을 읽어 그 위에 내 메시지를 붙인다
    const sendMessages: Message[] = [
      ...messagesRef.current,
      { role: "user" as const, content: text },
    ];
    setMessages(sendMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sendMessages }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      loadTodos();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "연결에 문제가 생겼어 😢" },
      ]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  // 매 렌더마다 최신 값들을 ref에 넣어둔다 (음성 핸들러 등에서 stale 방지)
  useEffect(() => {
    handleSendRef.current = handleSend;
    messagesRef.current = messages;
  });

  return (
    <main className="flex h-screen bg-orange-50 text-gray-800">
      <div className="flex w-full max-w-5xl mx-auto p-4 gap-4">
        {/* 왼쪽: 채팅 */}
        <div className="flex flex-col flex-1 bg-white rounded-3xl shadow-sm overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-orange-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-xl">
                🐣
              </div>
              <div>
                <h1 className="font-bold leading-tight">자취 만렙</h1>
                <p className="text-xs text-green-500">● 온라인</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMessages([FIRST]);
                sessionStorage.removeItem("chat");
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              대화 초기화
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={
                    "inline-block max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap " +
                    (m.role === "user"
                      ? "bg-orange-400 text-white rounded-br-sm"
                      : "bg-orange-100 text-gray-800 rounded-bl-sm")
                  }
                >
                  {m.content}
                </span>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <span className="bg-orange-100 rounded-2xl px-4 py-2 text-sm text-gray-400">
                  입력 중…
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 p-4 border-t border-orange-100">
            <button
              type="button"
              onClick={toggleMic}
              className={
                "rounded-full w-11 h-11 flex items-center justify-center text-lg transition shrink-0 " +
                (listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-orange-100 hover:bg-orange-200")
              }
              title="음성으로 말하기"
            >
              🎤
            </button>
            <input
              className="flex-1 bg-orange-50 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
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
              className="bg-orange-400 hover:bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50 transition shrink-0"
              onClick={() => handleSend()}
              disabled={loading}
            >
              보내기
            </button>
          </div>
        </div>

        {/* 오른쪽: 할 일 */}
        <div className="w-64 bg-white rounded-3xl shadow-sm p-5 overflow-y-auto">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            📝 오늘 할 일
          </h2>
          {todos.length === 0 && (
            <p className="text-sm text-gray-400">아직 없어요</p>
          )}
          <ul className="space-y-2.5">
            {todos.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-2.5 text-sm bg-orange-50 rounded-xl px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTodo(t.id, t.done)}
                  className="mt-0.5 accent-orange-400"
                />
                <span className={t.done ? "line-through text-gray-400" : ""}>
                  {t.title}
                  {t.due_time && (
                    <span className="block text-xs text-orange-400 mt-0.5">
                      {t.due_time}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
