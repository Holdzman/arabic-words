import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    "No Postgres connection string in env (checked DATABASE_URL, POSTGRES_URL, DATABASE_URL_UNPOOLED)"
  );
}

export const sql = neon(connectionString);
