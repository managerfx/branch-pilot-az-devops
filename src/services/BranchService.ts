import { getClient } from 'azure-devops-extension-api';
import { GitRestClient } from 'azure-devops-extension-api/Git';
import { CreateBranchParams, CreateBranchResult } from '../common/types';
import { REFS_HEADS, ZERO_OBJECT_ID } from '../common/constants';
import { shortTimestampSuffix } from '../common/utils';
import { RepoService } from './RepoService';
import { logger } from './Logger';

/**
 * BranchService creates Git branches via the Azure DevOps REST API.
 */
export class BranchService {
  constructor(private repoService: RepoService) {}

  /**
   * Resolves a unique branch name by checking existence and appending -2, -3, …
   * until a free name is found. Uses the in-memory branch cache (fast).
   */
  async resolveUniqueBranchName(
    projectId: string,
    repoId: string,
    branchName: string,
  ): Promise<string> {
    const exists = await this.repoService.branchExists(projectId, repoId, branchName);
    if (!exists) return branchName;

    // Strip existing -N suffix to find the base name
    const match = branchName.match(/^(.+)-(\d+)$/);
    const base = match ? match[1] : branchName;
    let counter = match ? parseInt(match[2], 10) + 1 : 2;

    while (counter <= 100) {
      const candidate = `${base}-${counter}`;
      const candidateExists = await this.repoService.branchExists(projectId, repoId, candidate);
      if (!candidateExists) return candidate;
      counter++;
    }

    // Safety fallback (extremely unlikely)
    return `${base}-${Date.now()}`;
  }

  /**
   * Creates a new Git branch based on the given source branch.
   * Automatically resolves name conflicts by appending -2, -3, …
   *
   * Returns a CreateBranchResult indicating success or failure.
   */
  async createBranch(params: CreateBranchParams): Promise<CreateBranchResult> {
    const { repoId, projectId, sourceBranchName, sourceObjectId, workItemId } = params;
    let { branchName } = params;

    // Resolve to a unique name before attempting creation
    branchName = await this.resolveUniqueBranchName(projectId, repoId, branchName);

    logger.info('Creating branch', { repoId, branchName, sourceBranchName });

    try {
      const client = getClient(GitRestClient);

      const updateResult = await client.updateRefs(
        [
          {
            name: `${REFS_HEADS}${branchName}`,
            newObjectId: sourceObjectId,
            oldObjectId: ZERO_OBJECT_ID,
            isLocked: false,
            repositoryId: repoId,
          },
        ],
        repoId,
        projectId,
      );

      if (updateResult && updateResult.length > 0 && updateResult[0].success) {
        logger.info('Branch created successfully', { branchName });
        // Invalidate cache so the new branch shows up next time
        this.repoService.invalidateBranchCache(projectId, repoId);
        return { success: true, branchName };
      }

      const errMsg = updateResult?.[0]?.customMessage ?? 'Unknown error from Git refs update';
      logger.error('Branch creation failed (updateRefs returned failure)', { updateResult });
      
      // Handle name conflicts (e.g., "Name conflicts with refs/heads/hotfix")
      // This happens when trying to create hotfix/123 but "hotfix" branch exists
      const conflictMatch = errMsg.match(/conflicts?\s+with\s+refs\/heads\/(.+)/i);
      if (conflictMatch) {
        const conflictingRef = conflictMatch[1];
        return {
          success: false,
          error: `branch_conflict:${branchName}:${conflictingRef}`,
          diagnostics: { updateResult, branchName, conflictingRef },
        };
      }
      
      // Handle branch already exists case
      if (this.isConflictError({ message: errMsg })) {
        const suggestion = this.buildAlternativeName(branchName);
        return {
          success: false,
          error: `branch_exists:${branchName}:${suggestion}`,
          diagnostics: { updateResult, branchName },
        };
      }
      
      return {
        success: false,
        error: errMsg,
        diagnostics: { updateResult, params: { repoId, branchName, workItemId } },
      };
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      logger.error('Branch creation threw an error', { error: err });

      // 409 = conflict (branch already exists)
      if (error?.status === 409 || this.isConflictError(error)) {
        const suggestion = this.buildAlternativeName(branchName);
        return {
          success: false,
          error: `branch_exists:${branchName}:${suggestion}`,
          diagnostics: { status: 409, branchName },
        };
      }

      // 401/403 = permission denied
      if (error?.status === 401 || error?.status === 403) {
        return {
          success: false,
          error: 'permission_denied',
          diagnostics: { status: error.status, repoId, branchName },
        };
      }

      return {
        success: false,
        error: error?.message ?? String(err),
        diagnostics: { error: err, params: { repoId, branchName, workItemId } },
      };
    }
  }

  /**
   * Suggests an alternative branch name on conflict by appending -2, -3, … or a timestamp.
   */
  buildAlternativeName(branchName: string): string {
    // Try numeric suffix first: feature/123-foo → feature/123-foo-2
    const match = branchName.match(/^(.+)-(\d+)$/);
    if (match) {
      const base = match[1];
      const num = parseInt(match[2], 10);
      return `${base}-${num + 1}`;
    }
    // Otherwise append -2
    if (!branchName.endsWith('-2')) {
      return `${branchName}-2`;
    }
    // Last resort: timestamp suffix
    return branchName + shortTimestampSuffix();
  }

  private isConflictError(err: unknown): boolean {
    const msg = (err as { message?: string })?.message?.toLowerCase() ?? '';
    return (
      msg.includes('already exists') ||
      msg.includes('conflict') ||
      msg.includes('conflicts')
    );
  }
}
