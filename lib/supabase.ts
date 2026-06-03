import { createClient } from "@supabase/supabase-js";

// 서버 전용 — service_role 키를 쓰므로 절대 화면 코드에서 import하지 말 것
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
