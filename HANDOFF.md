# Handoff for the next coding agent

Updated: 2026-08-28

## Repository state

- Repository: `Holdzman/arabic-words`
- Continue from: `main`
- Latest product commit at handoff creation: `4b6ee77`
- Vercel automatically deploys `main`.
- Do not work directly on `main`: use a feature branch and a pull request.

## Completed roadmap item #2

The move from binary correct/incorrect grading to four-level spaced-repetition grading is complete and deployed.

- Ratings: `again`, `hard`, `good`, `easy`.
- Scheduling logic: `lib/srs.ts`.
- Per-word review history: `Word.srsHistory` in `lib/types.ts`.
- Legacy words are normalized with an empty history in `components/AppShell.tsx`.
- API payload validation includes review history in `app/api/words/route.ts`.
- The “Сегодня” session shows projected intervals, rating distribution, and the 10 most recent reviews.
- Primary UI: `components/MultipleChoicePractice.tsx`.

## Completed roadmap item #3

Active-recall typing practice is complete and deployed (PR #9). Acceptance criteria, as confirmed with the user: a new "Письмо" tab where the learner sees the Russian translation and types the word in the target language (fixed direction, not toggleable), and answer comparison ignores Arabic diacritics entirely (not just shadda/tashdid).

- Comparison logic: `lib/textCompare.ts` (`normalizeForCompare`, `isAnswerCorrect`) — strips all Arabic tashkil (harakat, tanween, shadda, sukun, superscript alef, tatweel) before comparing; Arabic alef variants (أ/إ/آ/ا) are **not** normalized, an exact match is still required there.
- Session UI: `components/WritingPractice.tsx`, mirrors `MultipleChoicePractice.tsx`'s session shape (snapshot queue, no repeats, 4-button Again/Hard/Good/Easy rating with projected interval, completion summary). No 4-word minimum guard (unlike `MultipleChoicePractice`), since typing needs no distractors.
- Wired into `components/Practice.tsx` as the "Письмо" pill (last, after "Сегодня").

## Completed after item #3: Arabic word lookup now accepts Russian input

Previously, `app/api/disambiguate-word/route.ts`'s Arabic branch only handled Arabic-script input (tashkil disambiguation). It now also accepts Russian input and returns fully-voweled Arabic candidates, matching how Italian/English lookup already worked in both directions (PR #11).

As a follow-up (PR #12), the single-word Arabic add form's separate "Перевод на русский (подсказка)" hint field was removed from `components/AddWordForm.tsx` — it was Arabic-only, disabled the submit button in a confusing way when the main field was empty, and is no longer needed now that the main field accepts Russian directly. Arabic's add form now matches Italian/English exactly (one input field, placeholder mentions Russian as an alternative). `BulkAddWords.tsx`'s inline `слово - подсказка` bulk-parsing syntax is untouched — that's a different mechanism, not a form field, and still works.

Roadmap items #4–#10 (audio — now partly done via listening practice/TTS below, richer Arabic word model, intelligent distractors, JSONB→relational migration, stats, README update, automated tests) remain open. Do not start any of them without first restating the specific item's scope and getting explicit confirmation — this repo has already had one incident of an item being silently redefined; always restate and confirm instead of inferring.

## Additional features completed after item #2

### Listening practice

- Mode: `Практика → Аудирование`.
- Claude generates a target-language sentence from the learner’s dictionary by reusing `/api/generate-translation-quiz`.
- The learner listens, writes a Russian translation, and compares it with the reference.
- Implementation: `components/ListeningPractice.tsx`.
- System narrator selection is persisted per language in `localStorage`.
- Mobile Safari replay truncation is handled by retaining the utterance and delaying replay after `speechSynthesis.cancel()`.

### Natural Arabic and Italian TTS

- Authenticated server route: `app/api/speech/route.ts`.
- Model: `gpt-4o-mini-tts`.
- Cloud narrators: Marin, Cedar, Coral, and Onyx. The user currently prefers Onyx.
- Cloud narration is available for Arabic and Italian, including on mobile devices where browser-provided Italian voices are limited.
- The OpenAI API key is server-side only in Vercel as `OPENAI_API_KEY`; never expose it to the client or commit it.
- Generated MP3 is reused for repeated playback of the same exercise.
- System voices remain available as a fallback.
- The UI discloses that the cloud narrator is AI-generated.

### Responsive layout

- Mobile: fixed bottom tab bar; only the main content scrolls.
- Desktop (from 768 px): wider workspace with persistent left navigation.
- Layout styles: `app/globals.css`.

## Existing infrastructure and required environment

- Next.js 16.3.2, React 19, TypeScript.
- User data is stored in Postgres through the existing server modules.
- Required production variables include the existing database/session/Anthropic configuration plus `OPENAI_API_KEY` for cloud TTS.
- `OPENAI_API_KEY` is a shared Vercel secret linked to the `arabic-words` project for Production and Preview.
- Never print, read back, or copy secret values into logs, commits, issues, or chat.

## Verification

Run before publishing:

```bash
npm run lint
npm run build
```

The build requires the project’s server environment variables. A syntactically valid placeholder `DATABASE_URL` is sufficient for local compile/type verification because the build does not connect to the database.

Latest completed changes passed ESLint, TypeScript, and the production build. Vercel deployments for commits through `4b6ee77` succeeded.

## Working conventions

- Read `AGENTS.md` before modifying the Next.js project.
- Preserve backward compatibility for saved `Word` objects.
- Keep API keys server-side.
- Avoid charging for repeat playback: reuse already generated audio.
- Keep mobile Safari behavior in mind for Web Speech and audio playback.
- Stage only files belonging to the current task.
- Use a feature branch, run checks, open a PR, then merge only after the change is verified.
