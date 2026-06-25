# Agent Skills Architecture – Grok Tool

This repository's `.agent` system is **filtered and tailored** for the grok-tool tech stack.

## Project Stack

| Module | Tech |
|--------|------|
| `client/` | React 19 + Vite 8 + Electron 41 + TailwindCSS v4 + shadcn/Radix + Zustand |
| `server/` | NestJS 11 + Mongoose + Passport/JWT |
| `landing/` | Next.js 15 (App Router) + TailwindCSS v4 + AOS |

## Directory Shape

- `skills/` — curated skill library (filtered for this stack only)
- `agents/` — specialist prompts: frontend-specialist, backend-specialist, orchestrator
- `workflows/` — entry points: plan, create, debug, deploy, test, ui-ux-pro-max
- `rules/` — always-on operating behavior (GEMINI.md)

## Skill Map

### Frontend – Core (client/ + landing/)
| Skill | Trigger |
|-------|---------|
| `react-best-practices` | React components, hooks, waterfalls, bundle |
| `react-component-performance` | Slow components, memo, re-render diagnosis |
| `react-ui-patterns` | Loading states, error handling, data fetching UI |
| `tailwind-patterns` | TailwindCSS v4 styling, @theme config |
| `tailwind-design-system` | Design tokens, component variants, responsive patterns |
| `shadcn` | shadcn/ui components, Radix, Lucide |
| `zustand-store-ts` | Global state management |
| `zod-validation-expert` | Schema validation (react-hook-form + NestJS DTOs) |
| `typescript-expert` | TypeScript types, strict mode, patterns |
| `web-design-guidelines` | Layout, interaction patterns, web UX standards |

### Frontend – Next.js & Landing (landing/)
| Skill | Trigger |
|-------|---------|
| `nextjs-react-expert` | Next.js App Router, Server/Client components |
| `vercel-deployment` | Deploy, env vars, Vercel config |
| `seo-fundamentals` | E-E-A-T, Core Web Vitals, schema markup |
| `seo-technical` | Technical audit, crawlability, JS rendering |
| `web-performance-optimization` | LCP/INP/CLS, bundle, caching, runtime perf |

### Desktop (client/electron/)
| Skill | Trigger |
|-------|---------|
| `electron-development` | IPC, contextIsolation, electron-builder, auto-update |

### Backend (server/)
| Skill | Trigger |
|-------|---------|
| `nestjs-expert` | Modules, guards, Mongoose, JWT, Passport |

### Quality & Engineering Process
| Skill | Trigger |
|-------|---------|
| `clean-code` | Code quality, naming, structure |
| `uncle-bob-craft` | Code review, refactoring, architecture critique |
| `lint-and-validate` | ESLint, TypeScript checks — run after every change |
| `systematic-debugging` | Any bug, failing test, regression, unexpected behavior |
| `verification-before-completion` | Before claiming done, PR ready, or fix works |
| `workspace-operating-system` | Broad/ambiguous/multi-step tasks — entry point |

## Operating Model

- Use `agents/frontend-specialist` for UI/UX/React/Electron renderer work
- Use `agents/backend-specialist` for NestJS/Mongoose/API work
- Use `agents/orchestrator` for cross-cutting tasks
- Use `/plan`, `/create`, `/debug`, `/deploy`, `/test` workflows as entry points
- Use `/ui-ux-pro-max` for design system generation

## Key Rules

- Always run `npm run lint && npx tsc --noEmit` after every file change
- No direct push to `main` — use feature branches
- Verify before claiming done (evidence-based)
- Read `rules/GEMINI.md` for global always-on behavior

## Source

Skills extracted from: https://github.com/Anhvu1107/all-agent-skill
Only kept skills relevant to: React, Vite, Electron, NestJS, Next.js, TailwindCSS v4, shadcn, Zustand, TypeScript, SEO
