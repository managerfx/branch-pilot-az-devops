import * as SDK from 'azure-devops-extension-sdk';
import { IExtensionDataService, ServiceIds } from '../common/sdk-services';
import { ExtensionConfig } from '../common/types';
import { CONFIG_KEY, DEFAULT_CONFIG } from '../common/constants';
import { deepMerge } from '../common/utils';
import { logger } from './Logger';

/**
 * ConfigService manages loading and saving the BranchPilot configuration
 * from Azure DevOps ExtensionDataService, scoped per-project.
 */
export class ConfigService {
  private cache: ExtensionConfig | null = null;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Loads the project configuration, merging with defaults.
   * Results are cached for the duration of the page session.
   */
  async load(): Promise<ExtensionConfig> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const dataService = await SDK.getService<IExtensionDataService>(
        ServiceIds.ExtensionDataService,
      );
      const accessToken = await SDK.getAccessToken();
      const extensionId = SDK.getExtensionContext().id;
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);

      const stored = await dataManager.getValue<ExtensionConfig>(
        `${CONFIG_KEY}-${this.projectId}`,
        { defaultValue: null },
      );

      if (stored) {
        // Merge stored config with defaults to handle new fields added in future versions
        this.cache = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, stored as unknown as Record<string, unknown>) as unknown as ExtensionConfig;
        logger.info('Config loaded from ExtensionDataService', { projectId: this.projectId });
      } else {
        this.cache = DEFAULT_CONFIG as ExtensionConfig;
        logger.info('No stored config found, using defaults');
      }
    } catch (err) {
      logger.error('Failed to load config, using defaults', err);
      this.cache = DEFAULT_CONFIG as ExtensionConfig;
    }

    return this.cache;
  }

  /**
   * Saves the configuration to ExtensionDataService for the current project.
   */
  async save(config: ExtensionConfig): Promise<void> {
    const dataService = await SDK.getService<IExtensionDataService>(
      ServiceIds.ExtensionDataService,
    );
    const accessToken = await SDK.getAccessToken();
    const extensionId = SDK.getExtensionContext().id;
    const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);

    await dataManager.setValue(
      `${CONFIG_KEY}-${this.projectId}`,
      { ...config, schemaVersion: 1 },
    );

    this.cache = config;
    logger.info('Config saved', { projectId: this.projectId });
  }

  /** Invalidates the in-memory cache, forcing a reload on next access */
  invalidate(): void {
    this.cache = null;
  }

  /** Returns the effective config for a given repository (applying repo overrides) */
  getRepoConfig(
    config: ExtensionConfig,
    repoIdOrName: string,
  ): ExtensionConfig {
    const override = config.repoOverrides?.[repoIdOrName];
    if (!override) return config;

    return {
      ...config,
      defaults: {
        ...config.defaults,
        template: override.defaultTemplate ?? config.defaults.template,
        workItemState: override.workItemState ?? config.defaults.workItemState,
      },
    };
  }
}
