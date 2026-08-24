import { getJson, putJson } from "./api";
import type { Word, WordsResponse, SaveWordsRequestBody } from "./types";

export const getWords = () => getJson<WordsResponse>("/api/words").then((r) => r.words);

export const saveWords = (words: Word[]) =>
  putJson<WordsResponse>("/api/words", { words } satisfies SaveWordsRequestBody).then((r) => r.words);
