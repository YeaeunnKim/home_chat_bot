import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tips } from "@/lib/tips";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `너는 '토리' — 자취 생활을 같이 챙겨주는, 귀엽고 다정한 친구 캐릭터야.
사용자가 뭘 말하거나 부탁하면, 그 말에 다정하게 반응하면서 바로 도와줘.

[말투·성격]
- 밝고 귀엽고 친근하게, 반말로. 따뜻하고 다정하게 2~3문장만.
- 사용자를 늘 응원하고 칭찬해줘. 절대 무뚝뚝하거나 까칠하게 굴지 마.
- 이모지는 가끔 살짝만(🐣✨😊). 과하게 X. 번호·소제목·긴 목록은 웬만하면 쓰지 마.

[지식 사용]
- 아래 [검증된 자취 팁]이 있으면 그 내용을 우선 근거로 답해. 모르면 솔직하게 모른다고 말해줘.

[할 일(퀘스트) 관리]
- 할 일은 '퀘스트'라고 불러주면 더 귀여워. 추가는 add_todo, 완료/체크는 complete_todo, 내용·시각 변경은 update_todo, 삭제는 delete_todo를 써.

- ★퀘스트를 언제 만드냐 — 매우 중요★
  - 다음 둘 중 하나일 때만 add_todo를 써:
    (1) 사용자가 명시적으로 부탁할 때 — "추가해줘 / 할 일에 넣어줘 / 퀘스트로 만들어줘 / 등록해줘 / 잊지 않게 적어줘" 등.
    (2) 사용자가 '무엇을 언제까지 하겠다'고 구체적으로 약속할 때 — 예: "오늘 8시까지 빨래할게", "이따 7시에 청소할 거야".
  - 그 외의 단순한 바람·고민·잡담은 절대 퀘스트로 만들지 마.
    예: "요리하고 싶어", "청소해야 하나", "운동할까?", "배고프다" → 퀘스트 X.
    이런 말엔 그냥 다정하게 대화로 반응하고, 도움이 될 것 같으면 "할 일에 추가해줄까?" 하고 한 번 물어만 봐. 먼저 만들지 마.
  - 사용자가 시키지도 않은 퀘스트를 마음대로 가정하거나 "그 퀘스트 할 거야?"처럼 끌어오지 마.
    [현재 할 일]에 실제로 있는 것만 퀘스트야. 목록에 없으면 없는 거야.

- "끝냈어/했어/완료/체크" = complete_todo(체크만, 삭제 아님). "지워줘/빼줘" = delete_todo.
- 사용자가 "그거 말고", "바꿔줘" 같이 말하면 새로 추가하지 말고
  [현재 할 일]에서 맞는 id를 찾아 update_todo나 delete_todo로 처리해. 중복 추가 금지.
- "오늘", "내일", "이따 7시" 같은 표현은 아래 [현재 시각]을 기준으로 정확히 계산해.
- 시각 해석은 [현재 시각] 기준. 날짜 없이 시간만 말하면("7시까지", "이따 11시") 무조건 오늘로 처리해.
  단, 그 시각이 지금보다 이미 지났으면 그때만 내일로 넘겨. "내일/모레"는 말한 대로.
- 처리 후 다정하게 짧게 확인해줘. 예: "좋아, 바로 스케줄에 추가해줄게!", "잘했어, 체크해뒀어 ✨"
  더 할 게 없다고 하면 "언제든 또 불러줘!"처럼 따뜻하게 마무리.

[안전]
- 법률·의료·금융은 일반적인 얘기까지만. 중요하면 전문가 확인 한마디 살짝 곁들여줘.

[기분/행동 표시 — 매우 중요]
- 답변 맨 끝에 반드시 [mood:xxx] 형식으로 딱 하나 붙여. 사용자에겐 안 보이게 처리되니 빼먹지 마.
- 먼저 판단해: 이번 답변이 특정 집안일/행동에 대한 '꿀팁·정보·방법 안내'인가?
  그렇다면 기분 대신 아래 '행동 태그' 중 맞는 걸 써:
  - cooking : 요리·식사 준비·레시피 관련 팁
  - cleaning : 청소(바닥·화장실·먼지 등) 관련 팁
  - dishwashing : 설거지·그릇 관련 팁
  - laundry : 빨래·세탁·빨래 개기·건조 관련 팁
  - recycling : 분리수거·쓰레기 배출 관련 팁
  - tidying : 정리정돈·물건 정리·수납 관련 팁
  - sleep : 수면·잠·휴식 관련 팁
- 위에 해당하지 않는 일반 대화면 아래 '기분 태그' 중 하나를 써:
  - hello : 첫 인사, 반갑게 맞이할 때
  - excited : 신나거나 들뜰 때, 재밌는 얘기, 새 퀘스트 추가
  - great : 뿌듯·칭찬·성공·퀘스트 완료처럼 자랑스러울 때
  - nice : 평온하고 다정하게 도와줄 때, 따뜻한 마무리
  - bored : 심심하거나 시무룩할 때, 사용자가 시큰둥하거나 별일 없을 때
- 예: 요리 팁을 줄 때 → "기름 두르고 중불이면 딱이야! 🍳 [mood:cooking]"
- 예: 그냥 칭찬할 때 → "우와 잘했어! [mood:great]"`;

const MOODS = [
  // 기분
  "hello",
  "excited",
  "great",
  "nice",
  "bored",
  // 집안일·행동 (해당 주제 꿀팁/정보를 줄 때)
  "cooking",
  "cleaning",
  "dishwashing",
  "laundry",
  "recycling",
  "tidying",
  "sleep",
] as const;
type Mood = (typeof MOODS)[number];

// 답변에서 [mood:xxx] 태그를 떼어내고, 깨끗한 reply와 mood를 분리
function splitMood(raw: string): { reply: string; mood: Mood } {
  let mood: Mood = "nice";
  const m = raw.match(/\[mood:\s*(\w+)\s*\]/i);
  if (m && (MOODS as readonly string[]).includes(m[1].toLowerCase())) {
    mood = m[1].toLowerCase() as Mood;
  }
  const reply = raw.replace(/\[mood:\s*\w+\s*\]/gi, "").trim();
  return { reply, mood };
}

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
      const notices: string[] = []; // 화면 상단에 띄울 알림 문구

      for (const call of choice.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments);

        if (call.function.name === "add_todo") {
          await supabaseAdmin.from("todos").insert({
            title: args.title,
            due_time: args.due_time ?? null,
            category: args.category ?? null,
          });
          notices.push(`'${args.title}' 퀘스트가 1회 추가되었습니다.`);
        } else if (call.function.name === "complete_todo") {
          await supabaseAdmin
            .from("todos")
            .update({ done: true })
            .eq("id", args.id);
          notices.push("퀘스트를 완료했어요! 🎉");
        } else if (call.function.name === "update_todo") {
          const patch: Record<string, string> = {};
          if (args.title) patch.title = args.title;
          if (args.due_time) patch.due_time = args.due_time;
          await supabaseAdmin.from("todos").update(patch).eq("id", args.id);
          notices.push("퀘스트를 수정했어요.");
        } else if (call.function.name === "delete_todo") {
          await supabaseAdmin.from("todos").delete().eq("id", args.id);
          notices.push("퀘스트를 삭제했어요.");
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
      const out = splitMood(second.choices[0].message.content ?? "");
      return NextResponse.json({
        reply: out.reply,
        mood: out.mood,
        notice: notices.length ? notices.join(" ") : null,
      });
    }

    const out = splitMood(choice.content ?? "");
    return NextResponse.json({ reply: out.reply, mood: out.mood, notice: null });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { reply: "앗, 오류가 났어. 잠시 후 다시 시도해줘." },
      { status: 500 },
    );
  }
}
