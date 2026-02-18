import { WorkItemContext } from '../common/types';

export interface TemplateContext {
  workItem: WorkItemContext;
  prefix: string;
}

/**
 * TemplateRenderer resolves `{token}` placeholders in a branch name template.
 *
 * Supported tokens:
 *   {wi.id}        → work item ID (number)
 *   {wi.title}     → work item title (sanitised downstream)
 *   {wi.type}      → work item type (e.g. "Bug")
 *   {wi.state}     → work item state (e.g. "Active")
 *   {wi.assignedTo}→ assigned-to display name (empty string if unset)
 *   {prefix}       → the prefix resolved from the matched rule
 */
export class TemplateRenderer {
  /**
   * Renders the template with the given context.
   * Unknown tokens are replaced with an empty string.
   */
  render(template: string, context: TemplateContext): string {
    return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
      return this.resolveToken(token.trim(), context);
    });
  }

  private resolveToken(token: string, context: TemplateContext): string {
    const { workItem, prefix } = context;

    switch (token) {
      case 'wi.id':
        return String(workItem.id);
      case 'wi.title':
        return workItem.title;
      case 'wi.type':
        return workItem.type;
      case 'wi.state':
        return workItem.state;
      case 'wi.assignedTo':
        return workItem.assignedTo ?? '';
      case 'prefix':
        return prefix;
      default:
        return '';
    }
  }
}
