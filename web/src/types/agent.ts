export type TaskStatus = "backlog" | "in-progress" | "blocked" | "done";

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  due?: string;
  owner?: string;
  tags?: string[];
}

export interface AgentAutomation {
  id: string;
  name: string;
  cadence: string;
  description: string;
  status: "idle" | "scheduled" | "running";
  lastRun?: string;
  nextRun?: string;
}

export interface AgentDecision {
  id: string;
  title: string;
  summary: string;
  impact: "low" | "medium" | "high";
  status: "open" | "closed";
  owner?: string;
  due?: string;
}

export interface AgentWorkspaceState {
  tasks: AgentTask[];
  automations: AgentAutomation[];
  decisions: AgentDecision[];
  insights: string[];
  knowledgeHighlights: string[];
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
}

export interface AgentAPIRequest {
  messages: AgentMessage[];
  workspace: AgentWorkspaceState;
}

export interface AgentAPIResponse {
  reply: string;
  workspace: AgentWorkspaceState;
  actionSummary: string[];
}
