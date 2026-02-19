import * as SDK from 'azure-devops-extension-sdk';
import {
  IHostPageLayoutService,
  IWorkItemFormService,
  ServiceIds,
} from '../common/sdk-services';
import { ModalConfig } from '../common/types';
import { logger } from '../services/Logger';

// Suppress browser extension errors that interfere with the page
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('runtime.lastError') || msg.includes('Receiving end does not exist')) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

/**
 * Action registration page.
 *
 * This script runs in a hidden iframe. It initialises the SDK, waits for the
 * handshake to complete (so we know the publisher + extension IDs), then
 * registers the action handler under the *fully-qualified* contribution ID
 * that Azure DevOps uses in XDM messages.
 *
 * In SDK v4, dialogs are opened via IHostPageLayoutService.openCustomDialog,
 * NOT via a separate "HostDialogService" (which was removed in SDK v4).
 */
async function initAction(): Promise<void> {
  // Must await init so that SDK.getExtensionContext() is populated.
  await SDK.init({ loaded: false });

  const ctx = SDK.getExtensionContext();
  // ctx.id == "<publisherId>.<extensionId>"  e.g. "felicitomarket.branch-pilot-dev"
  const actionContributionId = `${ctx.id}.create-branch-action`;
  const dialogContributionId = `${ctx.id}.create-branch-dialog`;

  SDK.register(actionContributionId, {
    /**
     * Called by Azure DevOps when the user clicks "BranchPilot: Create branch"
     * in the Work Item context menu or the work item form's "..." overflow menu.
     *
     * When invoked from a list/board context menu the context carries workItemId.
     * When invoked from a work item FORM (newly saved), the context may still hold
     * the pre-save ID of 0 — in that case we fall back to IWorkItemFormService.getId().
     */
    execute: async (context: WorkItemMenuActionContext) => {
      logger.info('Action executed', { context });

      try {
        // Primary: take ID from the action context (list/board invocation)
        let workItemId: number =
          context?.workItemId ?? (context as any)?.id ?? 0;

        // Fallback: when invoked from the WI form's "..." menu, the context may
        // carry the stale pre-save ID (0 for a newly created WI). Use the form
        // service to get the live ID of the currently open work item.
        if (!workItemId || workItemId <= 0) {
          try {
            const formService = await SDK.getService<IWorkItemFormService>(
              ServiceIds.WorkItemFormService,
            );
            const formId = await formService.getId();
            const isNew = await formService.isNew();
            logger.info('WorkItemFormService fallback', { formId, isNew });
            if (formId > 0 && !isNew) {
              workItemId = formId;
            }
          } catch {
            // Form service is not available (e.g. invoked from a list view with no open form)
          }
        }

        const layoutService = await SDK.getService<IHostPageLayoutService>(
          ServiceIds.HostPageLayoutService,
        );

        if (!workItemId || workItemId <= 0) {
          layoutService.openMessageDialog(
            'Save the Work Item before creating a branch.',
            { title: 'BranchPilot' },
          );
          return;
        }

        const modalConfig: ModalConfig = {
          workItemId,
          // Title and state are fetched by the modal via WorkItem API.
          workItemTitle: '',
          workItemType: context.workItemTypeName ?? '',
          workItemState: '',
          projectId: context.currentProjectGuid ?? '',
          projectName: context.currentProjectName ?? '',
        };

        layoutService.openPanel(dialogContributionId, {
          title: 'New branch (BranchPilot)',
          configuration: modalConfig,
        });
      } catch (err) {
        logger.error('Action failed to open dialog', err);
      }
    },
  });

  await SDK.notifyLoadSucceeded();
}

initAction().catch(err => logger.error('Failed to initialize action', err));

// ─── Type helpers ────────────────────────────────────────────────────────────

/**
 * Shape of the context object that Azure DevOps passes via XDM instanceContext
 * when invoking a work item context menu action.
 * Field names verified from browser console logs.
 */
interface WorkItemMenuActionContext {
  workItemId?: number;
  workItemTypeName?: string;
  currentProjectGuid?: string;
  currentProjectName?: string;
}
