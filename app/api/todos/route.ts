import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 할 일 목록 불러오기
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ todos: [] }, { status: 500 });
  return NextResponse.json({ todos: data });
}

// 완료 체크 토글
export async function PATCH(req: Request) {
  const { id, done } = await req.json();
  await supabaseAdmin.from("todos").update({ done }).eq("id", id);
  return NextResponse.json({ ok: true });
}
