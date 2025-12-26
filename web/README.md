## ATLAS — Autonomous Operator Console

ATLAS is a web-based execution agent built with Next.js, React, and Tailwind CSS. It behaves like a proactive chief-of-staff: breaking down goals, coordinating workstreams, and reporting back with decisive, human-quality updates. The interface combines a kanban-style execution overview, an automation cockpit, and a conversational loop powered by OpenAI.

### Requirements

- Node.js 18+
- An OpenAI API key exposed as `OPENAI_API_KEY`

### Setup

```bash
npm install
cp .env.local.example .env.local # create this file and add OPENAI_API_KEY
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to interact with the agent console.

### Production build

```bash
npm run build
npm run start
```

### Deployment

Deploy straight to Vercel (recommended):

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-cfd4bb95
```

### Project structure

- `src/app/api/agent/route.ts` – server-side orchestration that calls OpenAI and returns structured workspace updates.
- `src/components/AgentWorkspace.tsx` – the main UI surface combining chat, execution boards, and automation panels.
- `src/lib/*` – knowledge base, initial workspace seed data, conversation formatting helpers.
- `src/types/agent.ts` – shared types for the workspace, tasks, automations, and API payloads.

### Environment variables

| Name             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `OPENAI_API_KEY` | Secure API key for OpenAI Responses API access. |

Add the key to `.env.local` (development) and set it within your Vercel Project Settings before deploying.
