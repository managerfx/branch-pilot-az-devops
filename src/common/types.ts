// ─────────────────────────────────────────────
// Extension Configuration Schema (versionato)
// ─────────────────────────────────────────────

export interface ExtensionConfig {
  schemaVersion: number;
  general: GeneralConfig;
  defaults: DefaultsConfig;
  repoOverrides: Record<string, RepoOverride>;
  rulesBySourceBranch: SourceBranchRule[];
  rulesByWorkItemType: WorkItemTypeRule[];
}

export interface GeneralConfig {
  /** Force all branch names to lowercase */
  lowercase: boolean;
  /** Replace non-alphanumeric characters with this string (default: "-") */
  nonAlnumReplacement: string;
  /** Maximum branch name length (default: 80) */
  maxLength: number;
  /** Allow users to manually edit the computed branch name */
  allowManualNameOverride: boolean;
  /** UI language: 'en' or 'it' (default: 'en') */
  language: 'en' | 'it';
}

export interface DefaultsConfig {
  /** Default template when no rule matches */
  template: string;
  /** Optional default work item state update */
  workItemState?: WorkItemStateConfig;
}

export interface RepoOverride {
  /** Override the default branch name template for a specific repository */
  defaultTemplate?: string;
  /** Override the default work item state update for a specific repository */
  workItemState?: WorkItemStateConfig;
}

export interface SourceBranchRule {
  /** Human-readable rule name */
  name: string;
  /** 'glob' (e.g. "hotfix/*") or 'regex' (e.g. "^hotfix(/.*)?$") */
  matchType: 'glob' | 'regex';
  /** The pattern to match against the source branch name */
  match: string;
  /** Prefix to add to the branch name (used as {prefix} token) */
  prefix: string;
  /** Branch name template (tokens: {prefix}, {wi.id}, {wi.title}, {wi.type}, {wi.state}) */
  template: string;
  /** Optional work item state update when this rule is used */
  workItemState?: WorkItemStateConfig;
}

export interface WorkItemTypeRule {
  /** Exact work item type name (case-insensitive) */
  workItemType: string;
  /** Prefix to add to the branch name (used as {prefix} token) */
  prefix?: string;
  /** Branch name template */
  template: string;
  /** Optional work item state update when this rule is used */
  workItemState?: WorkItemStateConfig;
}

export interface WorkItemStateConfig {
  /** Enable updating the work item state after branch creation */
  enabled: boolean;
  /** The new state to set */
  state: string;
}

// ─────────────────────────────────────────────
// Runtime / UI Types
// ─────────────────────────────────────────────

export interface WorkItemContext {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo?: string;
  iterationPath?: string;
  areaPath?: string;
  changedDate?: string;
  /** URL of the work item type icon from Azure DevOps */
  typeIcon?: string;
  /** Hex color of the work item type (without #) */
  typeColor?: string;
}

export interface RepoInfo {
  id: string;
  name: string;
  defaultBranch: string;
}

export interface BranchInfo {
  name: string;
  objectId: string;
}

export interface ResolvedRule {
  template: string;
  prefix: string;
  workItemState?: WorkItemStateConfig;
  /** The rule that was matched (for diagnostics) */
  matchedRuleName?: string;
}

export interface CreateBranchParams {
  repoId: string;
  repoName: string;
  projectId: string;
  branchName: string;
  sourceBranchName: string;
  sourceObjectId: string;
  workItemId: number;
  workItemType: string;
}

export interface CreateBranchResult {
  success: boolean;
  branchName?: string;
  error?: string;
  diagnostics?: Record<string, unknown>;
}

export interface ModalConfig {
  workItemId: number;
  workItemTitle: string;
  workItemType: string;
  workItemState: string;
  projectId: string;
  projectName: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
