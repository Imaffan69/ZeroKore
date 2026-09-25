export type AgentMode = "coding" | "research" | "general";

/** The four configured AI providers. Users may pin one explicitly. */
export type ProviderName = "Groq" | "DeepSeek" | "SambaNova" | "Gemini";

export type ProviderPreference = ProviderName | "auto";

export type AgentEventKind =
  | "agent_started"
  | "memory_retrieved"
  | "files_context"
  | "skill_loaded"
  | "tool_call"
  | "tool_completed"
  | "provider_fallback"
  | "generating_artifact"
  | "completed"
  | "error";

export interface AgentEvent {
  kind: AgentEventKind;
  message: string;
  at: string;
}

export type ArtifactType = "code" | "html" | "svg" | "markdown";

export interface Artifact {
  type: ArtifactType;
  title: string;
  content: string;
  language: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

export interface UsageState {
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface ProviderStatus {
  provider: string;
  fallbackFrom?: string;
}

export interface AgentRequestBody {
  message: string;
  conversationId?: string | null;
  mode: AgentMode;
  /** Explicit model/provider choice. "auto" uses the cascade order. */
  provider?: ProviderPreference;
  /** When set, the run belongs to this project: its files and preview update. */
  projectId?: string | null;
}

/** A provider row in the model picker: availability comes from /api/health. */
export interface ProviderInfo {
  id: ProviderName;
  label: string;
  model: string;
  configured: boolean;
}

/** Persisted UI/project preferences (localStorage on the client). */
export interface ProjectPreferences {
  projectName: string;
  preferredProvider: ProviderPreference;
  reducedMotion: boolean;
}

export interface AgentResponseBody {
  reply: string;
  conversationId: string;
  conversationTitle: string;
  events: AgentEvent[];
  artifact: Artifact | null;
  provider: string;
  fallbackFrom?: string;
  usage: UsageState;
}

export interface ToolDefinition {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: Record<string, any>;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: string;
  at: string;
}

export interface MemoryRecord {
  id: string;
  content: string;
  created_at: string;
}

export interface GitHubStatus {
  connected: boolean;
  configured: boolean;
  user?: string | null;
}

/** Summary of a skill committed at `.claude/skills/<name>/SKILL.md`. */
export interface SkillSummary {
  /** Directory slug, also the `/invoke` name. */
  name: string;
  /** Display name from frontmatter, falling back to a humanised slug. */
  title: string;
  description: string;
  bytes: number;
  resourceCount: number;
}

/** A skill plus its full markdown body and supporting files. */
export interface SkillDetail extends SkillSummary {
  /** Markdown body with frontmatter removed. */
  content: string;
  /** Relative paths of files that ship alongside SKILL.md. */
  resourceNames: string[];
}
