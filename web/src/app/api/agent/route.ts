import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

import { searchKnowledgeBase } from "@/lib/knowledge-base";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { formatConversationHistory } from "@/lib/conversation";
import {
  AgentAPIRequest,
  AgentAPIResponse,
  AgentAutomation,
  AgentDecision,
  AgentTask,
  AgentWorkspaceState,
} from "@/types/agent";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const agentResponseSchema = z.object({
  reply: z
    .string()
    .describe(
      "Assistant response for the user. Use confident, action-oriented language."
    ),
  tasks: z
    .array(
      z.object({
        id: z.string().describe("Stable identifier for the task."),
        title: z.string(),
        description: z.string(),
        status: z.enum(["backlog", "in-progress", "blocked", "done"]),
        priority: z.enum(["low", "medium", "high"]),
        due: z.string().optional().describe("ISO date or natural language."),
        owner: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .max(12)
    .describe("Full set of tasks for the workspace. Include existing tasks."),
  automations: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        cadence: z.string(),
        description: z.string(),
        status: z.enum(["idle", "scheduled", "running"]),
        lastRun: z.string().optional(),
        nextRun: z.string().optional(),
      })
    )
    .max(6)
    .describe("Automation routines the agent is executing or planning."),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string(),
        impact: z.enum(["low", "medium", "high"]),
        status: z.enum(["open", "closed"]),
        owner: z.string().optional(),
        due: z.string().optional(),
      })
    )
    .max(8),
  insights: z.array(z.string()).max(8),
  actionSummary: z
    .array(z.string())
    .describe("Short bullet points describing what the agent just did."),
});

function mergeWorkspace(
  prior: AgentWorkspaceState,
  updates: Omit<AgentWorkspaceState, "updatedAt">
): AgentWorkspaceState {
  return {
    ...prior,
    tasks: updates.tasks,
    automations: updates.automations,
    decisions: updates.decisions,
    insights: updates.insights,
    knowledgeHighlights: updates.knowledgeHighlights ?? prior.knowledgeHighlights,
    updatedAt: new Date().toISOString(),
  };
}

function buildPromptPayload(request: AgentAPIRequest) {
  const latestUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === "user");

  const knowledgeSuggestions = searchKnowledgeBase(
    latestUserMessage?.content ?? "",
    undefined
  );

  const knowledgeSummary = knowledgeSuggestions
    .map((entry) => {
      const bullets = entry.takeaways.map((item) => `- ${item}`).join("\n");
      return `${entry.title} (${entry.domain})\n${entry.summary}\n${bullets}`;
    })
    .join("\n\n")
    .trim();

  return [
    "Context from curated knowledge base (use when helpful):",
    knowledgeSummary || "No directly relevant knowledge snippets located.",
    "",
    "Conversation history:",
    formatConversationHistory(request.messages),
    "",
    "Instructions:",
    "- Return thoughtful updates even if you need clarification; outline reasonable assumptions and next steps.",
    "- Maintain continuity. Preserve task IDs and automation IDs from earlier turns.",
    "- If something is blocked, surface a direct ask with a suggested owner.",
  ].join("\n");
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Missing OPENAI_API_KEY. Set the environment variable to connect the autonomous agent.",
      },
      { status: 500 }
    );
  }

  let payload: AgentAPIRequest;
  try {
    payload = (await request.json()) as AgentAPIRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    const { object: agentResult } = await generateObject({
      model: openai("gpt-4.1-mini"),
      temperature: 0.6,
      maxOutputTokens: 900,
      system: buildSystemPrompt(payload.workspace),
      prompt: buildPromptPayload(payload),
      schema: agentResponseSchema,
    });

    const workspace = mergeWorkspace(payload.workspace, {
      tasks: agentResult.tasks as AgentTask[],
      automations: agentResult.automations as AgentAutomation[],
      decisions: agentResult.decisions as AgentDecision[],
      insights: agentResult.insights,
      knowledgeHighlights: payload.workspace.knowledgeHighlights,
    });

    const response: AgentAPIResponse = {
      reply: agentResult.reply,
      workspace,
      actionSummary: agentResult.actionSummary,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Agent generation failed", error);
    return NextResponse.json(
      {
        error: "The autonomous agent could not complete the request.",
      },
      { status: 500 }
    );
  }
}
