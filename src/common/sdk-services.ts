/**
 * Azure DevOps Extension SDK v4 compatibility layer.
 *
 * SDK v4 removed the CommonServiceIds enum and the typed service interfaces
 * from its public exports. We define them here so the rest of the codebase
 * can import from a single place without depending on the old SDK v3 shapes.
 */

// ─── Service ID constants ────────────────────────────────────────────────────

/** String identifiers for Azure DevOps host services (same values as old CommonServiceIds). */
export const ServiceIds = {
  ExtensionDataService: 'ms.vss-features.extension-data-service',
  HostPageLayoutService: 'ms.vss-features.host-page-layout-service',
  /** Available when the action is invoked from within a work item form (form's "..." menu). */
  WorkItemFormService: 'ms.vss-work-web.work-item-form',
} as const;

// ─── Service interfaces ───────────────────────────────────────────────────────

export interface IDialogOptions {
  title?: string;
  width?: number;
  height?: number;
  resizable?: boolean;
  /** Configuration data passed to the dialog content page via SDK.getConfiguration() */
  configuration?: unknown;
  buttons?: Array<{
    id: string;
    text: string;
    click?: () => void;
  }>;
  hideCloseButton?: boolean;
}

export interface IMessageDialogOptions {
  title?: string;
  buttons?: undefined;
  hideCloseButton?: boolean;
}

export interface IPanelOptions {
  title?: string;
  /** Configuration data passed to the panel content page via SDK.getConfiguration() */
  configuration?: unknown;
  /** Size of the panel: 'medium', 'large', 'full' */
  size?: number;
  onClose?: () => void;
}

/**
 * The modern ADO dialog API lives on IHostPageLayoutService, NOT on a
 * separate "HostDialogService" (which was removed in SDK v4).
 */
export interface IHostPageLayoutService {
  /** Opens a dialog showing custom extension content. */
  openCustomDialog<TResult = void>(
    contentContributionId: string,
    options?: IDialogOptions,
  ): void;
  /** Opens a simple message dialog. */
  openMessageDialog(message: string, options?: IMessageDialogOptions): void;
  /** Opens a panel (side sheet) showing custom extension content. */
  openPanel<TResult = void>(
    contentContributionId: string,
    options?: IPanelOptions,
  ): void;
}

export interface IExtensionDataManager {
  getValue<T>(key: string, options?: { scopeType?: string; scopeValue?: string; defaultValue?: T | null }): Promise<T | null>;
  setValue<T>(key: string, value: T, options?: { scopeType?: string; scopeValue?: string }): Promise<T>;
  getDocument(collectionName: string, id: string, options?: unknown): Promise<unknown>;
  setDocument(collectionName: string, doc: unknown, options?: unknown): Promise<unknown>;
}

export interface IExtensionDataService {
  getExtensionDataManager(extensionId: string, accessToken: string): Promise<IExtensionDataManager>;
}

/**
 * Minimal subset of IWorkItemFormService used by the action handler.
 * Only available when the action is invoked from within a work item form context
 * (e.g. the form's "..." overflow menu). Will throw if called from a list view.
 */
export interface IWorkItemFormService {
  /** Returns the ID of the active work item. Returns 0 if the work item has never been saved. */
  getId(): Promise<number>;
  /** Returns true if the active work item has never been saved (is new). */
  isNew(): Promise<boolean>;
}
