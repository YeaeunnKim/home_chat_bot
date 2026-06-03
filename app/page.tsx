"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Todo = {
  id: string;
  title: string;
  due_time: string | null;
  done: boolean;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "오 안녕 ㅋㅋ 오늘 뭐 도와줄까?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  async function toggleTodo(id: string, done: boolean) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: !done }),
    });
    loadTodos();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
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
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen bg-orange-50 text-gray-800">
      <div className="flex w-full max-w-5xl mx-auto p-4 gap-4">
        {/* 왼쪽: 채팅 */}
        <div className="flex flex-col flex-1 bg-white rounded-3xl shadow-sm overflow-hidden">
          <header className="flex items-center gap-3 px-5 py-4 border-b border-orange-100">
            <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-xl">
              🐣
            </div>
            <div>
              <h1 className="font-bold leading-tight">자취 만렙</h1>
              <p className="text-xs text-green-500">● 온라인</p>
            </div>
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
            <input
              className="flex-1 bg-orange-50 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="뭐든 물어봐!"
              disabled={loading}
            />
            <button
              className="bg-orange-400 hover:bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50 transition"
              onClick={handleSend}
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
