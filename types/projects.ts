/** A skill committed at `.claude/skills/<name>/SKILL.md`. */
export type ProjectSource = "created" | "github" | "imported";
export type ProjectStatus = "active" | "archived";

/** The named surfaces of a project. Replaces the single "artifact" concept. */
export type EnvironmentKind = "preview" | "terminal" | "dev_server" | "secrets";

export interface Project {
  id: string;
  user_id: string;
  /** URL-safe identifier used at /projects/<slug>. */
  slug: string;
  name: string;
  description: string;
  source: ProjectSource;
  github_repo: string | null;
  github_branch: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  language: string;
  updated_at: string;
}

export interface ProjectEnvironment {
  id: string;
  project_id: string;
  kind: EnvironmentKind;
  label: string;
  content: string;
  language: string;
  /** Server-owned status/metadata (never trusted from the client). */
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Secrets are never returned to the browser — only their key names. */
export interface ProjectSecretSummary {
  key: string;
  updated_at: string;
}

/** One repository row from the GitHub API, trimmed for the import picker. */
export interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  html_url: string;
}

/** Result of importing a repository into a project. */
export interface ProjectImportResult {
  project: Project;
  filesImported: number;
  truncated: boolean;
}
