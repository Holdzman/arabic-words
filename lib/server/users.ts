import { sql } from "./db";
import type { Word } from "@/lib/types";

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  words: Word[];
  api_key_enc: string | null;
}

export async function findUserByUsername(username: string): Promise<DbUser | null> {
  const rows = await sql`
    select id, username, password_hash, words, api_key_enc
    from users
    where lower(username) = lower(${username})
    limit 1
  `;
  return (rows[0] as DbUser | undefined) ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const rows = await sql`
    select id, username, password_hash, words, api_key_enc
    from users
    where id = ${id}
    limit 1
  `;
  return (rows[0] as DbUser | undefined) ?? null;
}

export async function createUser(
  username: string,
  passwordHash: string,
  words: Word[]
): Promise<DbUser> {
  const rows = await sql`
    insert into users (username, password_hash, words)
    values (${username}, ${passwordHash}, ${JSON.stringify(words)}::jsonb)
    returning id, username, password_hash, words, api_key_enc
  `;
  return rows[0] as DbUser;
}

export async function updateWords(userId: string, words: Word[]): Promise<void> {
  await sql`
    update users
    set words = ${JSON.stringify(words)}::jsonb, updated_at = now()
    where id = ${userId}
  `;
}

export async function updateApiKeyEnc(userId: string, apiKeyEnc: string | null): Promise<void> {
  await sql`
    update users
    set api_key_enc = ${apiKeyEnc}, updated_at = now()
    where id = ${userId}
  `;
}
