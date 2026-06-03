import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tips } from "@/lib/tips";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `너는 '자취 만렙' — 자취 같이 사는 친한 친구야.
사용자가 뭘 물어보거나 부탁하면 바로 도와주되, 친구한테 카톡하듯 편하고 짧게 답해.

[말투·길이]
- 반말로, 친구처럼 편하게. 핵심만 2~4문장. 번호·소제목·긴 목록은 웬만하면 X.

[지식 사용]
- 아래 [검증된 자취 팁]이 있으면 그 내용을 우선 근거로 답해. 모르면 솔직히 모른다고.

[할 일 관리]
- 할 일 추가는 add_todo, 완료/체크는 complete_todo, 내용·시각 변경은 update_todo, 삭제는 delete_todo를 써.
- "끝냈어/했어/완료/체크" = complete_todo(체크만, 삭제 아님). "지워줘/빼줘" = delete_todo.
- 사용자가 "그거 말고", "바꿔줘" 같이 말하면 새로 추가하지 말고
  [현재 할 일]에서 맞는 id를 찾아 update_todo나 delete_todo로 처리해. 중복 추가 금지.
- "오늘", "내일", "이따 7시" 같은 표현은 아래 [현재 시각]을 기준으로 정확히 계산해.
- 시각 해석은 [현재 시각] 기준. 날짜 없이 시간만 말하면("7시까지", "이따 11시") 무조건 오늘로 처리해.
  단, 그 시각이 지금보다 이미 지났으면 그때만 내일로 넘겨. "내일/모레"는 말한 대로.
- 처리 후 "추가했어!/바꿨어!/체크했어!/지웠어!" 짧게 확인하고 더 할 게 있는지 물어봐.
  없다고 하면 "오케이! 나중에 또 필요하면 말해"로 마무리.

[안전]
- 법률·의료·금융은 일반적인 얘기까지만. 중요하면 전문가 확인 한마디.`;

function findRelevantTips(question: string, max = 3): string[] {
  const q = question.toLowerCase();
  return tips
    .map((t) => ({
      t,
      score: t.keywords.filter((k) => q.includes(k.toLowerCase())).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.t.content);
}

const toolsList: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_todo",
      description: "할 일을 새로 추가한다.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "할 일 내용" },
          due_time: {
            type: "string",
            description: "마감 시각 (예: '오늘 오후 7시'). 없으면 비움",
          },
          category: {
            type: "string",
            enum: ["청소", "요리", "빨래", "행정", "기타"],
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_todo",
      description:
        "할 일을 완료(체크) 처리한다. 사용자가 '끝냈어/했어/완료/체크해줘'라고 할 때 사용. 삭제가 아니라 체크 표시만 한다.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "완료할 할 일의 id ([현재 할 일]에서 찾기)",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo",
      description:
        "기존 할 일의 내용이나 마감 시각을 수정한다. 반드시 기존 id를 써야 한다.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "수정할 할 일의 id ([현재 할 일]에서 찾기)",
          },
          title: { type: "string", description: "새 내용 (안 바꾸면 비움)" },
          due_time: {
            type: "string",
            description: "새 마감 시각 (안 바꾸면 비움)",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_todo",
      description: "기존 할 일을 삭제한다. 반드시 기존 id를 써야 한다.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "삭제할 할 일의 id" },
        },
        required: ["id"],
      },
    },
  },
];

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // 현재 한국 시각
    const now = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "full",
      timeStyle: "short",
    });

    // 현재 할 일 목록(수정/삭제/완료용 id 포함)
    const { data: currentTodos } = await supabaseAdmin
      .from("todos")
      .select("id, title, due_time, done")
      .order("created_at", { ascending: false });
    const todoList =
      currentTodos && currentTodos.length
        ? currentTodos
            .map(
              (t) =>
                `- id:${t.id} | ${t.title}${t.due_time ? ` (${t.due_time})` : ""}${t.done ? " [완료]" : ""}`,
            )
            .join("\n")
        : "(없음)";

    // 관련 팁 검색
    const lastUser =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";
    const relevant = findRelevantTips(lastUser);
    const knowledge = relevant.length
      ? `\n\n[검증된 자취 팁]\n${relevant.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";

    const systemContent =
      SYSTEM_PROMPT +
      `\n\n[현재 시각]\n${now}` +
      `\n\n[현재 할 일]\n${todoList}` +
      knowledge;

    const first = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "system", content: systemContent }, ...messages],
      tools: toolsList,
    });

    const choice = first.choices[0].message;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolMessages = [];

      for (const call of choice.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments);

        if (call.function.name === "add_todo") {
          await supabaseAdmin.from("todos").insert({
            title: args.title,
            due_time: args.due_time ?? null,
            category: args.category ?? null,
          });
        } else if (call.function.name === "complete_todo") {
          await supabaseAdmin
            .from("todos")
            .update({ done: true })
            .eq("id", args.id);
        } else if (call.function.name === "update_todo") {
          const patch: Record<string, string> = {};
          if (args.title) patch.title = args.title;
          if (args.due_time) patch.due_time = args.due_time;
          await supabaseAdmin.from("todos").update(patch).eq("id", args.id);
        } else if (call.function.name === "delete_todo") {
          await supabaseAdmin.from("todos").delete().eq("id", args.id);
        }

        toolMessages.push({
          role: "tool" as const,
          tool_call_id: call.id,
          content: "완료",
        });
      }

      const second = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
          choice,
          ...toolMessages,
        ],
      });
      return NextResponse.json({
        reply: second.choices[0].message.content ?? "",
      });
    }

    return NextResponse.json({ reply: choice.content ?? "" });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { reply: "앗, 오류가 났어. 잠시 후 다시 시도해줘." },
      { status: 500 },
    );
  }
}
