import { RulesEngine } from '../rules/RulesEngine';
import type { ExtensionConfig, WorkItemContext } from '../common/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseConfig: ExtensionConfig = {
  schemaVersion: 1,
  general: {
    lowercase: true,
    nonAlnumReplacement: '-',
    maxLength: 80,
    allowManualNameOverride: true,
    language: 'en',
  },
  defaults: {
    template: 'feature/{wi.id}-{wi.title}',
  },
  repoOverrides: {},
  rulesBySourceBranch: [
    {
      name: 'Hotfix glob',
      matchType: 'glob',
      match: 'hotfix/*',
      prefix: 'hotfix/',
      template: '{prefix}{wi.id}-{wi.title}',
      workItemState: { enabled: true, state: 'In Progress' },
    },
    {
      name: 'Hotfix root regex',
      matchType: 'regex',
      match: '^hotfix$',
      prefix: 'hotfix/',
      template: '{prefix}{wi.id}-{wi.title}',
    },
    {
      name: 'Release glob',
      matchType: 'glob',
      match: 'release/*',
      prefix: 'release/',
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
    },
  ],
};

const wiUserStory: WorkItemContext = {
  id: 42,
  title: 'Add login feature',
  type: 'User Story',
  state: 'New',
};

const wiBug: WorkItemContext = {
  id: 99,
  title: 'Fix crash on login',
  type: 'Bug',
  state: 'Active',
};

const wiTask: WorkItemContext = {
  id: 7,
  title: 'Write unit tests',
  type: 'Task',
  state: 'Active',
};

// ─── Rule resolution ──────────────────────────────────────────────────────────

describe('RulesEngine – resolveRule (precedence)', () => {
  const engine = new RulesEngine(baseConfig);

  it('source branch rule takes priority over WI type rule', () => {
    const rule = engine.resolveRule('hotfix/1.2.3', 'Bug');
    expect(rule.matchedRuleName).toBe('Hotfix glob');
    expect(rule.prefix).toBe('hotfix/');
  });

  it('glob matches hotfix/* correctly', () => {
    const rule = engine.resolveRule('hotfix/1.0', 'User Story');
    expect(rule.prefix).toBe('hotfix/');
  });

  it('regex matches bare "hotfix" branch', () => {
    const rule = engine.resolveRule('hotfix', 'User Story');
    expect(rule.prefix).toBe('hotfix/');
    expect(rule.matchedRuleName).toBe('Hotfix root regex');
  });

  it('does NOT match "hotfix-foo" against hotfix/* glob', () => {
    const rule = engine.resolveRule('hotfix-foo', 'Bug');
    // Should fall through to WI type rule for Bug
    expect(rule.matchedRuleName).toBe('WI type: Bug');
  });

  it('falls through to WI type rule when no source branch matches', () => {
    const rule = engine.resolveRule('main', 'Bug');
    expect(rule.matchedRuleName).toBe('WI type: Bug');
    expect(rule.prefix).toBe('bugfix/');
  });

  it('falls through to default when no rule matches', () => {
    const rule = engine.resolveRule('main', 'Task');
    expect(rule.matchedRuleName).toBe('default');
    expect(rule.template).toBe('feature/{wi.id}-{wi.title}');
  });

  it('WI type matching is case-insensitive', () => {
    const rule = engine.resolveRule('main', 'bug');
    expect(rule.matchedRuleName).toBe('WI type: Bug');
  });

  it('release/* glob matches release branches', () => {
    const rule = engine.resolveRule('release/2024-Q1', 'User Story');
    expect(rule.prefix).toBe('release/');
    expect(rule.matchedRuleName).toBe('Release glob');
  });
});

// ─── Branch name computation ──────────────────────────────────────────────────

describe('RulesEngine – computeBranchName', () => {
  const engine = new RulesEngine(baseConfig);

  it('CRITICAL: hotfix source → hotfix/{id}-{title}', () => {
    const name = engine.computeBranchName(wiUserStory, 'hotfix/1.0');
    expect(name).toBe('hotfix/42-add-login-feature');
  });

  it('hotfix bare → hotfix/{id}-{title}', () => {
    const name = engine.computeBranchName(wiBug, 'hotfix');
    expect(name).toBe('hotfix/99-fix-crash-on-login');
  });

  it('main + Bug → bugfix/{id}-{title}', () => {
    const name = engine.computeBranchName(wiBug, 'main');
    expect(name).toBe('bugfix/99-fix-crash-on-login');
  });

  it('main + User Story → feature/{id}-{title}', () => {
    const name = engine.computeBranchName(wiUserStory, 'main');
    expect(name).toBe('feature/42-add-login-feature');
  });

  it('main + Task → falls back to default template', () => {
    const name = engine.computeBranchName(wiTask, 'main');
    expect(name).toBe('feature/7-write-unit-tests');
  });

  it('applies lowercase', () => {
    const wiMixed: WorkItemContext = { ...wiUserStory, title: 'My Mixed CASE Title' };
    const name = engine.computeBranchName(wiMixed, 'main');
    expect(name).toBe(name.toLowerCase());
  });

  it('sanitizes special chars in title', () => {
    const wiSpecial: WorkItemContext = { ...wiUserStory, title: 'Fix: auth & "quotes"' };
    const name = engine.computeBranchName(wiSpecial, 'main');
    expect(name).not.toMatch(/[":&]/);
  });

  it('truncates to maxLength', () => {
    const wiLong: WorkItemContext = {
      ...wiUserStory,
      title: 'A'.repeat(200),
    };
    const name = engine.computeBranchName(wiLong, 'main');
    expect(name.length).toBeLessThanOrEqual(80);
  });

  it('release source branch → release prefix', () => {
    const name = engine.computeBranchName(wiUserStory, 'release/2024-Q1');
    expect(name.startsWith('release/')).toBe(true);
  });
});

// ─── workItemState propagation ────────────────────────────────────────────────

describe('RulesEngine – workItemState in resolved rule', () => {
  const engine = new RulesEngine(baseConfig);

  it('hotfix rule carries workItemState', () => {
    const rule = engine.resolveRule('hotfix/1.0', 'User Story');
    expect(rule.workItemState?.enabled).toBe(true);
    expect(rule.workItemState?.state).toBe('In Progress');
  });

  it('Bug WI type rule carries workItemState', () => {
    const rule = engine.resolveRule('main', 'Bug');
    expect(rule.workItemState?.enabled).toBe(true);
    expect(rule.workItemState?.state).toBe('Active');
  });

  it('default rule has no workItemState', () => {
    const rule = engine.resolveRule('main', 'Task');
    expect(rule.workItemState).toBeUndefined();
  });
});

// ─── Invalid patterns ─────────────────────────────────────────────────────────

describe('RulesEngine – invalid patterns are skipped', () => {
  const configWithBadRegex: ExtensionConfig = {
    ...baseConfig,
    rulesBySourceBranch: [
      {
        name: 'Bad regex',
        matchType: 'regex',
        match: '[invalid-regex',
        prefix: 'bad/',
        template: '{prefix}{wi.id}-{wi.title}',
      },
      ...baseConfig.rulesBySourceBranch,
    ],
  };

  it('skips invalid regex and falls through to next rule', () => {
    const engine = new RulesEngine(configWithBadRegex);
    // Should not throw, and should still match hotfix/* for hotfix branches
    const rule = engine.resolveRule('hotfix/1.0', 'User Story');
    expect(rule.prefix).toBe('hotfix/');
  });
});
