import { getClient } from 'azure-devops-extension-api';
import { GitRestClient } from 'azure-devops-extension-api/Git';
import { BranchInfo, RepoInfo, TagInfo } from '../common/types';
import { stripRefsHeads } from '../common/utils';
import { logger } from './Logger';

/**
 * RepoService wraps the Git REST client for repository and branch operations.
 * Results are cached in-memory for the lifetime of the page.
 */
export class RepoService {
  private reposCache: Map<string, RepoInfo[]> = new Map();
  private branchesCache: Map<string, BranchInfo[]> = new Map();
  private tagsCache: Map<string, TagInfo[]> = new Map();

  /**
   * Returns a list of repositories in the given project.
   * Results are cached per projectId.
   */
  async getRepositories(projectId: string): Promise<RepoInfo[]> {
    if (this.reposCache.has(projectId)) {
      return this.reposCache.get(projectId)!;
    }

    try {
      console.log('[RepoService] Getting client...');
      const client = getClient(GitRestClient);
      console.log('[RepoService] Client obtained, fetching repositories:', projectId);
      const repos = await client.getRepositories(projectId);
      console.log('[RepoService] Repositories fetched:', repos);

      const result: RepoInfo[] = repos.map((r) => ({
        id: r.id!,
        name: r.name!,
        defaultBranch: stripRefsHeads(r.defaultBranch ?? 'main'),
      }));

      this.reposCache.set(projectId, result);
      logger.info('Repos loaded', { projectId, count: result.length });
      return result;
    } catch (err) {
      logger.error('Failed to load repositories', { projectId, error: err });
      throw err;
    }
  }

  /**
   * Returns a list of branches for the given repository.
   * Results are cached per `${projectId}/${repoId}`.
   * Retries once on failure.
   */
  async getBranches(projectId: string, repoId: string): Promise<BranchInfo[]> {
    const cacheKey = `${projectId}/${repoId}`;
    if (this.branchesCache.has(cacheKey)) {
      return this.branchesCache.get(cacheKey)!;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const client = getClient(GitRestClient);
        const refs = await client.getRefs(repoId, projectId, 'heads/', undefined, undefined, undefined, undefined, undefined, undefined);

        const result: BranchInfo[] = refs.map((r) => ({
          name: stripRefsHeads(r.name!),
          objectId: r.objectId!,
        }));

        this.branchesCache.set(cacheKey, result);
        logger.info('Branches loaded', { repoId, count: result.length });
        return result;
      } catch (err) {
        if (attempt === 2) {
          logger.error('Failed to load branches after retry', { repoId, error: err });
          throw err;
        }
        logger.warn('Retrying branch load…', { repoId, attempt });
        await delay(800);
      }
    }

    return [];
  }

  /**
   * Returns a list of tags for the given repository.
   * Results are cached per `${projectId}/${repoId}`.
   */
  async getTags(projectId: string, repoId: string): Promise<TagInfo[]> {
    const cacheKey = `tags/${projectId}/${repoId}`;
    if (this.tagsCache.has(cacheKey)) {
      return this.tagsCache.get(cacheKey)!;
    }

    try {
      const client = getClient(GitRestClient);
      const refs = await client.getRefs(repoId, projectId, 'tags/', undefined, undefined, undefined, undefined, undefined, undefined);

      const result: TagInfo[] = refs.map((r) => ({
        name: r.name!.startsWith('refs/tags/') ? r.name!.slice('refs/tags/'.length) : r.name!,
        objectId: r.objectId!,
      }));

      this.tagsCache.set(cacheKey, result);
      logger.info('Tags loaded', { repoId, count: result.length });
      return result;
    } catch (err) {
      logger.error('Failed to load tags', { repoId, error: err });
      return [];
    }
  }

  /**
   * Returns the objectId of a specific branch.
   */
  async getBranchObjectId(
    projectId: string,
    repoId: string,
    branchName: string,
  ): Promise<string | null> {
    const branches = await this.getBranches(projectId, repoId);
    const found = branches.find(
      (b) => b.name.toLowerCase() === branchName.toLowerCase(),
    );
    return found?.objectId ?? null;
  }

  /**
   * Checks if a branch already exists in a repository.
   */
  async branchExists(
    projectId: string,
    repoId: string,
    branchName: string,
  ): Promise<boolean> {
    const oid = await this.getBranchObjectId(projectId, repoId, branchName);
    return oid !== null;
  }

  /** Invalidates the branch cache for a specific repo (e.g., after creating a branch) */
  invalidateBranchCache(projectId: string, repoId: string): void {
    this.branchesCache.delete(`${projectId}/${repoId}`);
  }

  /** Clears all caches */
  clearCaches(): void {
    this.reposCache.clear();
    this.branchesCache.clear();
    this.tagsCache.clear();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
