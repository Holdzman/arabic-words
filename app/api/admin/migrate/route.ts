import { sql } from "@/lib/server/db";

// TEMPORARY one-off migration endpoint — run once, then delete this file and redeploy.
export async function POST(request: Request) {
  const secret = request.headers.get("x-migrate-secret");
  if (!secret || secret !== process.env.SESSION_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists users (
      id            uuid primary key default gen_random_uuid(),
      username      text not null,
      password_hash text not null,
      words         jsonb not null default '[]'::jsonb,
      api_key_enc   text,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    )
  `;
  await sql`create unique index if not exists users_username_lower_idx on users (lower(username))`;

  return Response.json({ ok: true });
}
