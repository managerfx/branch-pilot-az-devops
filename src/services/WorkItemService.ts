import { getClient } from 'azure-devops-extension-api';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { WorkItemContext } from '../common/types';
import { logger } from './Logger';

/**
 * WorkItemService wraps the Work Item Tracking REST client.
 */
export class WorkItemService {
  /**
   * Reads the work item context (id, title, type, state) for a given ID.
   * Returns null if the ID is 0, negative, or the call fails.
   */
  async getWorkItemContext(workItemId: number): Promise<WorkItemContext | null> {
    if (!workItemId || workItemId <= 0) {
      logger.warn('getWorkItemContext called with invalid ID', { workItemId });
      return null;
    }

    try {
      const client = getClient(WorkItemTrackingRestClient);
      const wi = await client.getWorkItem(workItemId, undefined, undefined, undefined);

      return {
        id: wi.id!,
        title: String(wi.fields?.['System.Title'] ?? ''),
        type: String(wi.fields?.['System.WorkItemType'] ?? ''),
        state: String(wi.fields?.['System.State'] ?? ''),
        assignedTo: wi.fields?.['System.AssignedTo']?.displayName,
        iterationPath: String(wi.fields?.['System.IterationPath'] ?? ''),
        areaPath: String(wi.fields?.['System.AreaPath'] ?? ''),
      };
    } catch (err) {
      logger.error('Failed to fetch work item', { workItemId, error: err });
      return null;
    }
  }

  /**
   * Updates the state of a work item.
   */
  async updateState(workItemId: number, newState: string): Promise<boolean> {
    if (!workItemId || workItemId <= 0) return false;

    try {
      const client = getClient(WorkItemTrackingRestClient);
      await client.updateWorkItem(
        [
          {
            op: 'add',
            path: '/fields/System.State',
            value: newState,
          },
        ],
        workItemId,
      );
      logger.info('Work item state updated', { workItemId, newState });
      return true;
    } catch (err) {
      logger.error('Failed to update work item state', { workItemId, newState, error: err });
      return false;
    }
  }

  /**
   * Adds a branch artifact link to a work item.
   *
   * The URL format is: vstfs:///Git/Ref/{projectId}%2F{repoId}%2FGB{encodedBranchName}
   */
  async addBranchLink(
    workItemId: number,
    projectId: string,
    repoId: string,
    branchName: string,
  ): Promise<boolean> {
    if (!workItemId || workItemId <= 0) return false;

    try {
      const client = getClient(WorkItemTrackingRestClient);

      // Strip refs/heads/ prefix if present
      const cleanBranch = branchName.startsWith('refs/heads/')
        ? branchName.slice('refs/heads/'.length)
        : branchName;

      // Build vstfs URI: projectId and repoId separated by %2F, then GB + URL-encoded branch
      const encoded = encodeURIComponent(cleanBranch).replace(/%2F/gi, '%2F');
      const artifactUrl = `vstfs:///Git/Ref/${projectId}%2F${repoId}%2FGB${encoded}`;

      await client.updateWorkItem(
        [
          {
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'ArtifactLink',
              url: artifactUrl,
              attributes: { name: 'Branch' },
            },
          },
        ],
        workItemId,
      );
      logger.info('Branch link added to work item', { workItemId, branchName });
      return true;
    } catch (err) {
      logger.error('Failed to add branch link', { workItemId, branchName, error: err });
      return false;
    }
  }
}
