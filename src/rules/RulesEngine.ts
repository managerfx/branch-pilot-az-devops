import { minimatch } from 'minimatch';
import { ExtensionConfig, ResolvedRule, WorkItemContext } from '../common/types';
import { sanitizeBranchName } from '../common/utils';
import { TemplateRenderer } from './TemplateRenderer';

/**
 * RulesEngine resolves the active branch naming rule and renders the final
 * branch name according to the following precedence:
 *
 *   1. rulesBySourceBranch  (first match wins — glob or regex)
 *   2. rulesByWorkItemType  (first match wins — case-insensitive)
 *   3. defaults
 */
export class RulesEngine {
  private renderer = new TemplateRenderer();

  constructor(private config: ExtensionConfig) {}

  /**
   * Resolves which rule applies for the given source branch and work item type.
   */
  resolveRule(sourceBranch: string, workItemType: string): ResolvedRule {
    // 1. Source-branch rules
    for (const rule of this.config.rulesBySourceBranch ?? []) {
      if (this.matchesBranch(sourceBranch, rule.matchType, rule.match)) {
        return {
          template: rule.template,
          prefix: rule.prefix ?? '',
          workItemState: rule.workItemState,
          matchedRuleName: rule.name,
        };
      }
    }

    // 2. Work-item-type rules
    for (const rule of this.config.rulesByWorkItemType ?? []) {
      if (rule.workItemType.toLowerCase() === workItemType.toLowerCase()) {
        return {
          template: rule.template,
          prefix: rule.prefix ?? '',
          workItemState: rule.workItemState,
          matchedRuleName: `WI type: ${rule.workItemType}`,
        };
      }
    }

    // 3. Default
    return {
      template: this.config.defaults.template,
      prefix: '',
      workItemState: this.config.defaults.workItemState,
      matchedRuleName: 'default',
    };
  }

  /**
   * Computes the full sanitised branch name for the given context.
   *
   * Steps:
   *   1. Resolve rule
   *   2. Render template tokens
   *   3. Sanitize (non-alnum → replacement, lowercase, max length)
   */
  computeBranchName(workItem: WorkItemContext, sourceBranch: string): string {
    const rule = this.resolveRule(sourceBranch, workItem.type);
    const raw = this.renderer.render(rule.template, {
      workItem,
      prefix: rule.prefix,
    });

    return sanitizeBranchName(raw, this.config.general);
  }

  /**
   * Returns both the resolved rule AND the sanitised branch name.
   */
  computeWithRule(
    workItem: WorkItemContext,
    sourceBranch: string,
  ): { branchName: string; rule: ResolvedRule } {
    const rule = this.resolveRule(sourceBranch, workItem.type);
    const raw = this.renderer.render(rule.template, {
      workItem,
      prefix: rule.prefix,
    });
    const branchName = sanitizeBranchName(raw, this.config.general);
    return { branchName, rule };
  }

  // ──────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────

  private matchesBranch(
    branch: string,
    matchType: 'glob' | 'regex',
    pattern: string,
  ): boolean {
    try {
      if (matchType === 'glob') {
        return minimatch(branch, pattern, { nocase: true, matchBase: false });
      } else {
        return new RegExp(pattern).test(branch);
      }
    } catch {
      // Invalid pattern — skip
      return false;
    }
  }
}
