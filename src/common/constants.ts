export const EXTENSION_ID = 'branch-pilot';
export const PUBLISHER_ID = 'felicitomarket';

/** ExtensionDataService key for the project config */
export const CONFIG_KEY = 'branchpilot-config';

/** Dialog contribution ID used by the action to open the modal */
export const DIALOG_CONTRIBUTION_ID = `${PUBLISHER_ID}.${EXTENSION_ID}.create-branch-dialog`;

/** Settings hub contribution ID */
export const SETTINGS_HUB_ID = `${PUBLISHER_ID}.${EXTENSION_ID}.settings-hub`;

/** Maximum allowed branch name length (hard limit) */
export const HARD_MAX_LENGTH = 250;

/** Git "zero" objectId used when creating a new ref */
export const ZERO_OBJECT_ID = '0000000000000000000000000000000000000000';

/** Prefix for Git branch refs */
export const REFS_HEADS = 'refs/heads/';

/** Azure DevOps artifact link type for branch links */
export const BRANCH_ARTIFACT_REL = 'ArtifactLink';

/** vstfs URI scheme for Git branch links */
export const GIT_REF_VSTFS_PREFIX = 'vstfs:///Git/Ref/';

/** Default configuration applied when no project config exists */
export const DEFAULT_CONFIG = {
  schemaVersion: 1,
  general: {
    lowercase: true,
    nonAlnumReplacement: '-',
    maxLength: 80,
    allowManualNameOverride: true,
    language: 'en' as const,
  },
  defaults: {
    template: 'feature/{wi.id}-{wi.title}',
  },
  repoOverrides: {},
  rulesBySourceBranch: [
    // ─── App-prefixed branches ───────────────────────────────────────────
    {
      name: 'App hotfix branch rule',
      matchType: 'regex' as const,
      match: '^app/hotfix(/.*)?$',
      prefix: 'app/hotfix/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'App develop branch rule',
      matchType: 'regex' as const,
      match: '^app/develop$',
      prefix: 'app/feature/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'App release numbered branch rule',
      matchType: 'regex' as const,
      match: '^app/release\\d+(/.*)?$',
      prefix: 'app/release/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'App release branch rule',
      matchType: 'regex' as const,
      match: '^app/release(/.*)?$',
      prefix: 'app/release/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'App mac branch rule',
      matchType: 'regex' as const,
      match: '^app/mac$',
      prefix: 'app/mac/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'App ril branch rule',
      matchType: 'regex' as const,
      match: '^app/ril$',
      prefix: 'app/ril/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    // ─── Standard branches (no app/ prefix) ──────────────────────────────
    {
      name: 'Hotfix branch rule',
      matchType: 'regex' as const,
      match: '^hotfix(/.*)?$',
      prefix: 'hotfix/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Develop branch rule',
      matchType: 'regex' as const,
      match: '^develop$',
      prefix: 'feature/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Release numbered branch rule',
      matchType: 'regex' as const,
      match: '^release\\d+(/.*)?$',
      prefix: 'release/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Release branch rule',
      matchType: 'regex' as const,
      match: '^release(/.*)?$',
      prefix: 'release/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Mac branch rule',
      matchType: 'regex' as const,
      match: '^mac$',
      prefix: 'mac/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Ril branch rule',
      matchType: 'regex' as const,
      match: '^ril$',
      prefix: 'ril/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
  ],
  rulesByWorkItemType: [
    {
      workItemType: 'Bug',
      prefix: 'bugfix/',
      template: '{prefix}{wi.id}-{wi.title}',
      workItemState: { enabled: true, state: 'Active' },
    },
    {
      workItemType: 'User Story',
      prefix: 'feature/',
      template: '{prefix}{wi.id}-{wi.title}',
      workItemState: { enabled: true, state: 'Active' },
    },
    {
      workItemType: 'Task',
      prefix: 'task/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
  ],
};
