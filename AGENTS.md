# Repository Guidelines

## Project Structure & Module Organization
Application code lives in `src/`, organized by feature: reusable UI sits in `src/components`, route screens in `src/pages`, hooks under `src/hooks`, and shared state in `src/store`. Service clients and OCR helpers live in `src/services` and `src/utils`. Static styles and Tailwind layers load from `src/index.css`, while localization assets live in `src/i18n`. Build artifacts are emitted to `dist/`; automation utilities (e.g., `kill-dev.sh`) reside in `scripts/`.

## Build, Test, and Development Commands
Use `npm run dev` (or `pnpm dev`) to start the Vite dev server with hot reload. `npm run build` performs a TypeScript check via `tsc` and bundles the app. Preview a production bundle locally with `npm run preview`. Run `npm run lint` to enforce ESLint rules. Tests execute with `npm run test` for a single pass or `npm run test:watch` for interactive runs.

## Coding Style & Naming Conventions
This project targets modern TypeScript/React. Components, pages, and Zustand stores use PascalCase filenames (e.g., `DocumentViewer.tsx`); hooks start with `use` (e.g., `useOcrJob.ts`). Prefer functional components with React hooks and keep shared logic inside `src/utils`. Follow the ESLint config (`.eslintrc.cjs`) and Prettier defaults enforced by the formatter scripts; indent with two spaces. Tailwind utility classes should group layout → typography → state modifiers for readability.

## Testing Guidelines
Vitest powers unit and integration specs, with Testing Library for React components. Place colocated tests alongside sources using the `.test.ts` or `.test.tsx` suffix. Configure test globals in `src/test/setup.ts` before needing custom matchers like `@testing-library/jest-dom`. Strive to cover OCR parsing utilities and store actions; add regression cases for tricky uploads. Snapshot tests are acceptable for complex layouts, but accompany them with behavior assertions.

## Commit & Pull Request Guidelines
Commits follow Conventional Commit prefixes (`feat:`, `fix:`, `style:`) as seen in recent history; keep subject lines under 72 characters and focus each commit on one logical change. PRs should describe the problem, solution, and testing evidence (command output or screenshots). Link related issues, note any configuration changes (`.env` or Tailwind updates), and request review from an OCR domain owner when modifying `src/services`.

## Environment & Credentials
Create a `.env` file with `VITE_GEMINI_API_KEY` before running the app. Never commit secrets; use `setup.sh` for initial environment preparation and update `README.md` if configuration steps change. Clean up any sample documents before opening a PR.
