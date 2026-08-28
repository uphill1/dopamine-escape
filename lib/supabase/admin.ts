import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * service_role 키를 쓰는 관리자 클라이언트. RLS를 우회하므로 서버 사이드 전용,
 * 그리고 그 안에서도 신뢰된 내부 로깅/집계 용도로만 좁혀서 써야 한다.
 * (일반 사용자 데이터 CRUD는 client.ts/server.ts의 anon key 클라이언트를 그대로 사용할 것)
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
