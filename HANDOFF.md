# Handoff for the next coding agent

Updated: 2026-08-27

## Repository state

- Repository: `Holdzman/arabic-words`
- Continue from: `main`
- Latest product commit at handoff creation: `5979508`
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

Before starting roadmap item #3, restate its acceptance criteria from the original plan. The exact definition of item #3 is not recorded in this repository, so do not infer or silently redefine it.

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

Latest completed changes passed ESLint, TypeScript, and the production build. Vercel deployments for commits through `5979508` succeeded.

## Working conventions

- Read `AGENTS.md` before modifying the Next.js project.
- Preserve backward compatibility for saved `Word` objects.
- Keep API keys server-side.
- Avoid charging for repeat playback: reuse already generated audio.
- Keep mobile Safari behavior in mind for Web Speech and audio playback.
- Stage only files belonging to the current task.
- Use a feature branch, run checks, open a PR, then merge only after the change is verified.
