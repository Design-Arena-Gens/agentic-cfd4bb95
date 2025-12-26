"use client";

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

import {
  AgentAPIResponse,
  AgentMessage,
  AgentWorkspaceState,
  TaskStatus,
} from "@/types/agent";
import {
  createInitialMessages,
  createInitialWorkspace,
} from "@/lib/initial-state";

const statusLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
};

const statusClasses: Record<TaskStatus, string> = {
  backlog:
    "border border-dashed border-neutral-300/60 bg-white/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]",
  "in-progress":
    "border border-transparent bg-gradient-to-br from-blue-500/10 to-blue-500/0 shadow-lg shadow-blue-500/10",
  blocked:
    "border border-transparent bg-gradient-to-br from-amber-500/20 to-amber-500/0 shadow-lg shadow-amber-500/15",
  done: "border border-neutral-200 bg-neutral-50/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
};

const quickPrompts = [
  "Spin up a weekly execution roadmap for shipping the new onboarding flow.",
  "Draft a crisp product update email for customers announcing the automation hub.",
  "Turn the last investor memo into a GTM narrative with proof points.",
  "Audit open tasks and tell me what needs unblocking before Friday.",
];

const backgroundGradients = [
  "from-blue-500/10 via-emerald-400/10 to-transparent",
  "from-indigo-500/10 via-purple-400/10 to-transparent",
  "from-amber-400/10 via-rose-300/10 to-transparent",
];

const spinnerDots = Array.from({ length: 3 });

export function AgentWorkspace() {
  const [workspace, setWorkspace] = useState<AgentWorkspaceState>(() =>
    createInitialWorkspace()
  );
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    createInitialMessages()
  );
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedTasks = useMemo(() => {
    return workspace.tasks.reduce<Record<TaskStatus, typeof workspace.tasks>>(
      (acc, task) => {
        acc[task.status] = acc[task.status] ? [...acc[task.status], task] : [task];
        return acc;
      },
      {
        backlog: [],
        "in-progress": [],
        blocked: [],
        done: [],
      }
    );
  }, [workspace]);

  const submitToAgent = useCallback(
    async (prompt: string) => {
      if (isThinking) {
        return;
      }

      const newMessage: AgentMessage = {
        id: uuid(),
        role: "user",
        content: prompt.trim(),
        createdAt: new Date().toISOString(),
      };

      const optimisticMessages = [...messages, newMessage];
      setMessages(optimisticMessages);
      setIsThinking(true);
      setError(null);

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: optimisticMessages,
            workspace,
          }),
        });

        if (!response.ok) {
          throw new Error(
            "Agent interface is offline right now. Try again in a moment."
          );
        }

        const data = (await response.json()) as AgentAPIResponse;
        const assistantMessage: AgentMessage = {
          id: uuid(),
          role: "assistant",
          content: [data.reply, "", data.actionSummary.join("\n")].join("\n").trim(),
          createdAt: new Date().toISOString(),
        };

        setMessages([...optimisticMessages, assistantMessage]);
        setWorkspace(data.workspace);
      } catch (agentError) {
        const failureMessage: AgentMessage = {
          id: uuid(),
          role: "assistant",
          content:
            "I ran into an error executing that request. Double-check the agent credentials or try again shortly.",
          createdAt: new Date().toISOString(),
        };
        setMessages((previous) => [...previous, failureMessage]);
        setError(
          agentError instanceof Error
            ? agentError.message
            : "The agent could not complete the request."
        );
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking, messages, workspace]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!input.trim()) {
        return;
      }
      const prompt = input;
      setInput("");
      await submitToAgent(prompt);
    },
    [input, submitToAgent]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-14">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-300/80">
              Autonomous Ops Console
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-neutral-100 sm:text-4xl">
              ATLAS — your execution partner that works like a human operator
            </h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-300/80">
              Feed it objectives, hand it messy context, and it will coordinate
              research, planning, and follow-through while keeping you in the loop.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.4em] text-neutral-500">
              Workspace synced {new Date(workspace.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex w-full max-w-sm items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-4 shadow-2xl shadow-blue-500/20 backdrop-blur-md sm:w-auto">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500" />
            <div>
              <p className="text-sm font-semibold text-neutral-100">
                Next action queue
              </p>
              <p className="text-xs text-neutral-400">
                {workspace.tasks.filter((task) => task.status !== "done").length}{" "}
                active tracks • {workspace.automations.length} automations
              </p>
            </div>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)]">
          <section className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-blue-500/10 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Mission Control
                </h2>
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-200/80">
                  Live
                </span>
              </div>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <dt className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                    Priority Tracks
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold text-neutral-100">
                    {
                      workspace.tasks.filter((task) => task.priority === "high")
                        .length
                    }
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <dt className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                    Blockers
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold text-amber-300">
                    {groupedTasks.blocked.length || "—"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <dt className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                    Automations
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold text-emerald-200">
                    {workspace.automations.length}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/0 p-5 shadow-lg shadow-blue-500/10">
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Insights radar
                  </h3>
                  <ul className="mt-3 space-y-3 text-sm text-neutral-300/90">
                    {workspace.insights.map((insight, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-300" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/0 p-5 shadow-lg shadow-indigo-500/10">
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Open decisions
                  </h3>
                  <ul className="mt-3 space-y-3 text-sm text-neutral-300/90">
                    {workspace.decisions.map((decision) => (
                      <li key={decision.id}>
                        <p className="font-medium text-neutral-100">
                          {decision.title}
                        </p>
                        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                          Impact {decision.impact.toUpperCase()} • Owner{" "}
                          {decision.owner ?? "Agent"}
                        </p>
                        <p className="mt-1 text-[13px] text-neutral-300/80">
                          {decision.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Execution queue
                </h2>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                  Agent-run Kanban
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(groupedTasks) as TaskStatus[]).map((status, idx) => (
                  <div
                    key={status}
                    className={`relative overflow-hidden rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${statusClasses[status]}`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
                        backgroundGradients[idx % backgroundGradients.length]
                      } opacity-60`}
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-400">
                          {statusLabels[status]}
                        </h3>
                        <span className="text-xs font-semibold text-neutral-200">
                          {groupedTasks[status].length}
                        </span>
                      </div>
                      <div className="mt-4 space-y-4 text-sm text-neutral-100/90">
                        {groupedTasks[status].map((task) => (
                          <article
                            key={task.id}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-black/10 backdrop-blur"
                          >
                            <header className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-neutral-100">
                                {task.title}
                              </p>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-neutral-300">
                                {task.priority}
                              </span>
                            </header>
                            <p className="mt-2 text-neutral-300/90">
                              {task.description}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                              {task.due && (
                                <span className="rounded-full bg-white/5 px-2 py-1">
                                  Due {task.due}
                                </span>
                              )}
                              {task.owner && (
                                <span className="rounded-full bg-white/5 px-2 py-1">
                                  {task.owner}
                                </span>
                              )}
                              {(task.tags ?? []).map((tag) => (
                                <span key={tag} className="rounded-full bg-white/5 px-2 py-1">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </article>
                        ))}
                        {groupedTasks[status].length === 0 && (
                          <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center text-xs text-neutral-400/80">
                            No items right now.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Automation cockpit
                </h2>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                  Lifters running on autopilot
                </p>
              </div>
              <ul className="mt-4 space-y-4">
                {workspace.automations.map((automation) => (
                  <li
                    key={automation.id}
                    className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-black/10 hover:bg-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-neutral-100">
                        {automation.name}
                      </p>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-300">
                        {automation.cadence}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-300/90">
                      {automation.description}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                      Status {automation.status.toUpperCase()} • Next run{" "}
                      {automation.nextRun
                        ? new Date(automation.nextRun).toLocaleString()
                        : "Scheduling"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="flex h-[calc(100vh-10rem)] flex-col rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-indigo-500/10 backdrop-blur">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">
                    Conversation loop
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Ask for anything — ATLAS will plan, execute, and report back.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span
                    className={`flex h-2 w-2 rounded-full ${
                      isThinking ? "bg-amber-300 animate-pulse" : "bg-emerald-400"
                    }`}
                  />
                  {isThinking ? "Running tasks" : "Standing by"}
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitToAgent(prompt)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-200 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-neutral-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "assistant" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl border border-white/10 px-5 py-4 text-sm leading-relaxed ${
                        message.role === "assistant"
                          ? "bg-white/10 text-neutral-50 shadow-xl shadow-blue-500/20"
                          : "bg-blue-500/80 text-white shadow-xl shadow-blue-500/30"
                      }`}
                    >
                      <p className="whitespace-pre-line">{message.content}</p>
                      <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-neutral-200/70">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                <AnimatePresence>
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex justify-start"
                    >
                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-200/80">
                        {spinnerDots.map((_, index) => (
                          <motion.span
                            key={index}
                            className="h-2 w-2 rounded-full bg-blue-300"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.2,
                              delay: index * 0.25,
                            }}
                          />
                        ))}
                        ATLAS is executing…
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
                    {error}
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-white/10 p-6 backdrop-blur"
            >
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm shadow-xl shadow-black/30 focus-within:border-blue-400/60 focus-within:bg-white/10">
                <textarea
                  className="h-20 flex-1 resize-none border-none bg-transparent text-neutral-50 outline-none placeholder:text-neutral-400"
                  placeholder="Describe the outcome you want. ATLAS will figure out the rest."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={isThinking}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/50 transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-neutral-600/70"
                >
                  <span className="sr-only">Send</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M4.5 3.75a.75.75 0 0 1 .976-.72l14.25 4.5a.75.75 0 0 1 .053 1.419l-6.73 2.691a.75.75 0 0 0-.454.454l-2.69 6.73a.75.75 0 0 1-1.42-.053l-4.5-14.25A.75.75 0 0 1 4.5 3.75Zm3.325 3.428 2.488 2.488a.75.75 0 0 0 .53.22h4.154l-3.45 1.378a2.25 2.25 0 0 0-1.36 1.36L8.83 16.79l1.698-4.254a.75.75 0 0 0-.177-.797l-2.526-2.526.001-.035Z" />
                  </svg>
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
