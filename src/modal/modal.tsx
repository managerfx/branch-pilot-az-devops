import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { BranchInfo, ModalConfig, RepoInfo, WorkItemContext } from '../common/types';
import { ConfigService } from '../services/ConfigService';
import { WorkItemService } from '../services/WorkItemService';
import { RepoService } from '../services/RepoService';
import { BranchService } from '../services/BranchService';
import { RulesEngine } from '../rules/RulesEngine';
import { validateBranchName } from '../common/utils';
import { initLocale, t } from '../i18n';
import { logger } from '../services/Logger';
import { DEFAULT_CONFIG } from '../common/constants';

import './modal.scss';

// ─── State machine ────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface ModalState {
  initState: LoadState;
  initError: string | null;

  // Data
  projectId: string;
  workItem: WorkItemContext | null;
  repos: RepoInfo[];
  branches: BranchInfo[];

  // User selections
  selectedRepoId: string;
  selectedBaseBranch: string;
  branchName: string;
  manualOverride: boolean;

  // UI state
  loadingRepos: boolean;
  loadingBranches: boolean;
  creating: boolean;
  successMessage: string | null;
  createError: string | null;

  // Validation
  branchNameError: string | null;
  branchNameWarning: string | null;
  stateHint: string | null;
  showDiagnostics: boolean;
  diagnosticsCopied: boolean;
  allowManualOverride: boolean;
}

type Action =
  | { type: 'INIT_SUCCESS'; payload: { projectId: string; workItem: WorkItemContext; repos: RepoInfo[]; allowManualOverride: boolean } }
  | { type: 'INIT_ERROR'; payload: string }
  | { type: 'SET_REPO'; payload: string }
  | { type: 'BRANCHES_LOADED'; payload: { branches: BranchInfo[]; defaultBranch: string } }
  | { type: 'SET_BASE_BRANCH'; payload: string }
  | { type: 'SET_BRANCH_NAME'; payload: string }
  | { type: 'SET_BRANCH_COMPUTED'; payload: { name: string; warning: string | null; stateHint: string | null } }
  | { type: 'CREATE_START' }
  | { type: 'CREATE_SUCCESS'; payload: string }
  | { type: 'CREATE_ERROR'; payload: string }
  | { type: 'TOGGLE_DIAGNOSTICS' }
  | { type: 'DIAGNOSTICS_COPIED' }
  | { type: 'SET_LOADING_BRANCHES'; payload: boolean };

const initialState: ModalState = {
  initState: 'loading',
  initError: null,
  projectId: '',
  workItem: null,
  repos: [],
  branches: [],
  selectedRepoId: '',
  selectedBaseBranch: '',
  branchName: '',
  manualOverride: false,
  loadingRepos: false,
  loadingBranches: false,
  creating: false,
  successMessage: null,
  createError: null,
  branchNameError: null,
  branchNameWarning: null,
  stateHint: null,
  showDiagnostics: false,
  diagnosticsCopied: false,
  allowManualOverride: true,
};

function reducer(state: ModalState, action: Action): ModalState {
  switch (action.type) {
    case 'INIT_SUCCESS':
      return {
        ...state,
        initState: 'ready',
        projectId: action.payload.projectId,
        workItem: action.payload.workItem,
        repos: action.payload.repos,
        allowManualOverride: action.payload.allowManualOverride,
        loadingRepos: false,
      };
    case 'INIT_ERROR':
      return { ...state, initState: 'error', initError: action.payload, loadingRepos: false };
    case 'SET_REPO':
      return {
        ...state,
        selectedRepoId: action.payload,
        selectedBaseBranch: '',
        branches: [],
        branchName: '',
        loadingBranches: true,
        branchNameError: null,
        branchNameWarning: null,
        stateHint: null,
      };
    case 'BRANCHES_LOADED':
      return {
        ...state,
        branches: action.payload.branches,
        selectedBaseBranch: action.payload.defaultBranch,
        loadingBranches: false,
      };
    case 'SET_BASE_BRANCH':
      return { ...state, selectedBaseBranch: action.payload };
    case 'SET_BRANCH_NAME':
      return { ...state, branchName: action.payload, manualOverride: true };
    case 'SET_BRANCH_COMPUTED':
      return {
        ...state,
        branchName: action.payload.name,
        branchNameWarning: action.payload.warning,
        stateHint: action.payload.stateHint,
        branchNameError: null,
        manualOverride: false,
      };
    case 'SET_LOADING_BRANCHES':
      return { ...state, loadingBranches: action.payload };
    case 'CREATE_START':
      return { ...state, creating: true, createError: null, successMessage: null };
    case 'CREATE_SUCCESS':
      return { ...state, creating: false, successMessage: action.payload };
    case 'CREATE_ERROR':
      return { ...state, creating: false, createError: action.payload };
    case 'TOGGLE_DIAGNOSTICS':
      return { ...state, showDiagnostics: !state.showDiagnostics };
    case 'DIAGNOSTICS_COPIED':
      return { ...state, diagnosticsCopied: true };
    default:
      return state;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns a relative time string like "2m ago", "1h ago", "3d ago" */
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  } catch {
    return '';
  }
}

/** Returns a work item icon component - uses ADO icon URL if available, fallback to colored square */
function WorkItemIcon({ type, iconUrl, color }: { type: string; iconUrl?: string; color?: string }) {
  // Use ADO icon if available
  if (iconUrl) {
    return (
      <img 
        className="bp-wi-icon" 
        src={iconUrl} 
        alt={type}
        width="16" 
        height="16" 
        style={{ objectFit: 'contain' }}
      />
    );
  }
  
  // Fallback: colored square based on type color or default color mapping
  const fallbackColor = color ? `#${color}` : getDefaultTypeColor(type);
  return (
    <div 
      className="bp-wi-icon bp-wi-icon--fallback"
      style={{ backgroundColor: fallbackColor }}
    />
  );
}

/** Returns a default color for common work item types */
function getDefaultTypeColor(type: string): string {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('bug')) return '#cc293d';
  if (t.includes('task')) return '#f2cb1d';
  if (t.includes('user story') || t.includes('story')) return '#009ccc';
  if (t.includes('feature')) return '#773b93';
  if (t.includes('epic')) return '#ff7b00';
  return '#605e5c';
}

// ─── Services (instantiated once) ───────────────────────────────────────────

const repoService = new RepoService();
const workItemService = new WorkItemService();
const branchService = new BranchService(repoService);

// ─── Component ───────────────────────────────────────────────────────────────

const CreateBranchModal: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const rulesEngineRef = useRef<RulesEngine | null>(null);
  const maxLengthRef = useRef<number>(80);

  // ── Initialisation ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        console.log('[BranchPilot] Starting SDK init...');
        
        await SDK.init({ loaded: false });
        console.log('[BranchPilot] SDK init completed, waiting for ready...');
        
        // CRITICAL: Wait for SDK to be fully ready before making API calls
        // This ensures the XDM handshake is complete
        // Add timeout in case it hangs due to double SDK loading
        await Promise.race([
          SDK.ready(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SDK.ready() timeout after 5s')), 5000)
          )
        ]).catch(err => {
          console.warn('[BranchPilot] SDK.ready() failed, proceeding anyway:', err);
        });
        console.log('[BranchPilot] SDK ready - XDM handshake complete');
        
        // Initialize with English as default (will update after config loads)
        initLocale('en');

        const sdkConfig = SDK.getConfiguration() as ModalConfig;
        console.log('[BranchPilot] SDK config:', sdkConfig);
        const projectId: string = sdkConfig.projectId ?? SDK.getPageContext().webContext.project.id;
        const workItemId: number = sdkConfig.workItemId ?? 0;

        if (!workItemId || workItemId <= 0) {
          if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.invalidWorkItemId') });
          return;
        }

        console.log('[BranchPilot] Loading config, work item, and repos...');
        // Load config and work item in parallel
        const configService = new ConfigService(projectId);
        
        // Add timeout helper
        const withTimeout = <T,>(promise: Promise<T>, ms: number, name: string): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
              setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
            )
          ]);
        };
        
        const configPromise = withTimeout(configService.load(), 15000, 'Config')
          .then(c => { console.log('[BranchPilot] Config loaded:', c); return c; })
          .catch(e => { console.error('[BranchPilot] Config load failed:', e); throw e; });
        
        const workItemPromise = withTimeout(workItemService.getWorkItemContext(workItemId, projectId), 15000, 'WorkItem')
          .then(wi => { console.log('[BranchPilot] WorkItem loaded:', wi); return wi; })
          .catch(e => { console.error('[BranchPilot] WorkItem load failed:', e); throw e; });
        
        const reposPromise = withTimeout(repoService.getRepositories(projectId), 15000, 'Repos')
          .then(r => { console.log('[BranchPilot] Repos loaded:', r); return r; })
          .catch(e => { console.error('[BranchPilot] Repos load failed:', e); throw e; });
        
        const [config, workItem, repos] = await Promise.all([
          configPromise,
          workItemPromise,
          reposPromise,
        ]);
        console.log('[BranchPilot] All data loaded:', { config, workItem, repos });

        if (!workItem) {
          if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.invalidWorkItemId') });
          return;
        }

        rulesEngineRef.current = new RulesEngine(config);
        maxLengthRef.current = config.general.maxLength;
        
        // Set language from saved config
        initLocale(config.general.language || 'en');

        if (!cancelled) {
          console.log('[BranchPilot] Dispatching INIT_SUCCESS');
          dispatch({
            type: 'INIT_SUCCESS',
            payload: {
              projectId,
              workItem,
              repos,
              allowManualOverride: config.general.allowManualNameOverride,
            },
          });
        }
      } catch (err) {
        console.error('[BranchPilot] Modal init failed:', err);
        logger.error('Modal init failed', err);
        if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.generic', { message: String(err) }) });
      } finally {
        console.log('[BranchPilot] Notifying load succeeded');
        if (!cancelled) SDK.notifyLoadSucceeded();
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── React to base branch change → recompute name ─────────────────────────

  useEffect(() => {
    if (!state.selectedBaseBranch || !state.workItem || !rulesEngineRef.current) return;
    if (state.manualOverride) return;

    const { branchName, rule } = rulesEngineRef.current.computeWithRule(
      state.workItem,
      state.selectedBaseBranch,
    );

    const validation = validateBranchName(branchName, maxLengthRef.current);
    const warning = validation.warnings.length > 0 ? validation.warnings[0] : null;

    const stateHint =
      rule.workItemState?.enabled && rule.workItemState.state
        ? t('modal.stateUpdate', { state: rule.workItemState.state })
        : null;

    dispatch({
      type: 'SET_BRANCH_COMPUTED',
      payload: { name: branchName, warning, stateHint },
    });
  }, [state.selectedBaseBranch, state.workItem, state.manualOverride]);

  // ── Repo selection ───────────────────────────────────────────────────────

  const handleRepoChange = useCallback(
    async (repoId: string) => {
      dispatch({ type: 'SET_REPO', payload: repoId });

      try {
        const repo = state.repos.find((r) => r.id === repoId);
        const branches = await repoService.getBranches(state.projectId, repoId);
        const defaultBranch = repo?.defaultBranch ?? (branches[0]?.name ?? '');

        dispatch({
          type: 'BRANCHES_LOADED',
          payload: { branches, defaultBranch },
        });
      } catch (err) {
        logger.error('Failed to load branches', err);
        dispatch({ type: 'SET_LOADING_BRANCHES', payload: false });
      }
    },
    [state.repos, state.projectId],
  );

  // ── Create ───────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const { selectedRepoId, selectedBaseBranch, branchName, workItem, projectId } = state;

    // Client-side validation
    if (!selectedRepoId) {
      dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.repoRequired') });
      return;
    }
    if (!selectedBaseBranch) {
      dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.basedOnRequired') });
      return;
    }
    if (!branchName || !branchName.trim()) {
      dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.branchNameRequired') });
      return;
    }

    const validation = validateBranchName(branchName, maxLengthRef.current);
    if (!validation.valid) {
      dispatch({ type: 'CREATE_ERROR', payload: validation.errors[0] });
      return;
    }

    dispatch({ type: 'CREATE_START' });

    try {
      // Get the source branch objectId
      const sourceObjectId = await repoService.getBranchObjectId(
        projectId,
        selectedRepoId,
        selectedBaseBranch,
      );
      if (!sourceObjectId) {
        dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.basedOnRequired') });
        return;
      }

      // Create the branch
      const repo = state.repos.find((r) => r.id === selectedRepoId)!;
      const result = await branchService.createBranch({
        repoId: selectedRepoId,
        repoName: repo.name,
        projectId,
        branchName: branchName.trim(),
        sourceBranchName: selectedBaseBranch,
        sourceObjectId,
        workItemId: workItem!.id,
        workItemType: workItem!.type,
      });

      if (!result.success) {
        if (result.error?.startsWith('branch_exists:')) {
          const parts = result.error.split(':');
          dispatch({
            type: 'CREATE_ERROR',
            payload: t('modal.error.branchExists', { name: parts[1], suggestion: parts[2] }),
          });
        } else if (result.error?.startsWith('branch_conflict:')) {
          const parts = result.error.split(':');
          dispatch({
            type: 'CREATE_ERROR',
            payload: t('modal.error.branchConflict', { name: parts[1], conflictingRef: parts[2] }),
          });
        } else if (result.error === 'permission_denied') {
          dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.permissionDenied') });
        } else {
          dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.generic', { message: result.error ?? 'unknown' }) });
        }
        return;
      }

      // Link branch to work item
      await workItemService.addBranchLink(workItem!.id, projectId, selectedRepoId, branchName.trim());

      // Optional: update work item state
      if (rulesEngineRef.current) {
        const rule = rulesEngineRef.current.resolveRule(selectedBaseBranch, workItem!.type);
        if (rule.workItemState?.enabled && rule.workItemState.state) {
          await workItemService.updateState(workItem!.id, rule.workItemState.state);
        }
      }

      // Close the panel immediately
      try {
        const panelConfig = SDK.getConfiguration() as { panel?: { close(): void } };
        if (panelConfig?.panel?.close) {
          panelConfig.panel.close();
        }
      } catch {
        // Panel close not available or already closed
      }
    } catch (err) {
      logger.error('Create branch failed', err);
      dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.generic', { message: String(err) }) });
    }
  }, [state]);

  // ── Copy diagnostics ─────────────────────────────────────────────────────

  const handleCopyDiagnostics = useCallback(() => {
    const diag = JSON.stringify(logger.getDiagnostics(), null, 2);
    navigator.clipboard.writeText(diag).then(() => {
      dispatch({ type: 'DIAGNOSTICS_COPIED' });
      setTimeout(() => { /* could reset here */ }, 2000);
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const { initState, initError, workItem, repos, branches } = state;

  if (initState === 'loading') {
    return (
      <div className="bp-modal__spinner" style={{ justifyContent: 'center', height: '100vh' }}>
        <div className="bp-spinner-icon" />
        <span>{t('modal.loading.repos')}</span>
      </div>
    );
  }

  if (initState === 'error') {
    return (
      <div className="bp-modal" style={{ padding: 24 }}>
        <div className="bp-modal__banner bp-modal__banner--error">
          <span>⚠</span>
          <span>{initError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-modal">
      <div className="bp-modal__body">
        {/* ── Branch name ── */}
        <div className="bp-modal__field">
          <label htmlFor="bp-name">
            {t('modal.field.branchName')}
            {state.allowManualOverride && <span className="bp-required"> *</span>}
          </label>
          <input
            id="bp-name"
            type="text"
            className="bp-modal__input"
            value={state.branchName}
            placeholder={t('modal.field.branchName.placeholder')}
            disabled={!state.allowManualOverride || state.creating}
            onChange={(e) => dispatch({ type: 'SET_BRANCH_NAME', payload: e.target.value })}
          />
          {state.branchNameError && (
            <div className="bp-modal__error">⚠ {state.branchNameError}</div>
          )}
          {!state.branchNameError && state.branchNameWarning && (
            <div className="bp-modal__warning">⚠ {state.branchNameWarning}</div>
          )}
          {!state.allowManualOverride && (
            <div className="bp-modal__info">{t('modal.info.nameLocked')}</div>
          )}
        </div>

        {/* ── Repository ── */}
        <div className="bp-modal__field">
          <label htmlFor="bp-repo">
            <svg className="bp-repo-icon" width="14" height="14" viewBox="0 0 48 48">
              <path fill="#F4511E" d="M42.2,22.1L25.9,5.8C25.4,5.3,24.7,5,24,5c0,0,0,0,0,0c-0.7,0-1.4,0.3-1.9,0.8l-3.5,3.5l4.1,4.1c0.4-0.2,0.8-0.3,1.3-0.3c1.7,0,3,1.3,3,3c0,0.5-0.1,0.9-0.3,1.3l4,4c0.4-0.2,0.8-0.3,1.3-0.3c1.7,0,3,1.3,3,3s-1.3,3-3,3c-1.7,0-3-1.3-3-3c0-0.5,0.1-0.9,0.3-1.3l-4-4c-0.1,0-0.2,0.1-0.3,0.1v10.4c1.2,0.4,2,1.5,2,2.8c0,1.7-1.3,3-3,3s-3-1.3-3-3c0-1.3,0.8-2.4,2-2.8V18.8c-1.2-0.4-2-1.5-2-2.8c0-0.5,0.1-0.9,0.3-1.3l-4.1-4.1L5.8,22.1C5.3,22.6,5,23.3,5,24c0,0.7,0.3,1.4,0.8,1.9l16.3,16.3c0,0,0,0,0,0c0.5,0.5,1.2,0.8,1.9,0.8s1.4-0.3,1.9-0.8l16.3-16.3c0.5-0.5,0.8-1.2,0.8-1.9C43,23.3,42.7,22.6,42.2,22.1z"/>
            </svg>
            {t('modal.field.repository')}
            <span className="bp-required"> *</span>
          </label>
          <select
            id="bp-repo"
            className="bp-modal__select"
            value={state.selectedRepoId}
            disabled={state.creating}
            onChange={(e) => handleRepoChange(e.target.value)}
          >
            <option value="" disabled>{t('modal.field.repository.placeholder')}</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* ── Based on ── */}
        <div className="bp-modal__field">
          <label htmlFor="bp-base">
            <svg className="bp-branch-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
            </svg>
            {t('modal.field.basedOn')}
            <span className="bp-required"> *</span>
          </label>
          {state.loadingBranches ? (
            <div className="bp-modal__spinner">
              <div className="bp-spinner-icon" />
              <span>{t('modal.loading.branches')}</span>
            </div>
          ) : (
            <select
              id="bp-base"
              className="bp-modal__select"
              value={state.selectedBaseBranch}
              disabled={!state.selectedRepoId || state.creating}
              onChange={(e) => dispatch({ type: 'SET_BASE_BRANCH', payload: e.target.value })}
            >
              <option value="" disabled>{t('modal.field.basedOn.placeholder')}</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── State update hint ── */}
        {state.stateHint && (
          <div className="bp-modal__state-hint">✓ {state.stateHint}</div>
        )}

        {/* ── Success / Error banners ── */}
        {state.successMessage && (
          <div className="bp-modal__banner bp-modal__banner--success">
            <span>✓</span>
            <span>{state.successMessage}</span>
          </div>
        )}

        {state.createError && (
          <div className="bp-modal__banner bp-modal__banner--error">
            <span>⚠</span>
            <span>{state.createError}</span>
          </div>
        )}

        {/* ── Diagnostics (collapsible) ── */}
        {(state.createError || state.initError) && (
          <details
            className="bp-modal__diagnostics"
            open={state.showDiagnostics}
            onToggle={() => dispatch({ type: 'TOGGLE_DIAGNOSTICS' })}
          >
            <summary>{t('modal.section.diagnostics')}</summary>
            <pre>{JSON.stringify(logger.getDiagnostics(), null, 2)}</pre>
            <button
              className="bp-btn bp-btn--secondary bp-btn--small bp-copy-btn"
              onClick={handleCopyDiagnostics}
            >
              {state.diagnosticsCopied ? t('modal.diagnostics.copied') : t('modal.btn.copyDiagnostics')}
            </button>
          </details>
        )}
      </div>

      {/* ── Work Item Card ── */}
      {workItem && (
        <div className="bp-modal__wi-card">
          <div className="bp-modal__wi-card-icon">
            <WorkItemIcon type={workItem.type} iconUrl={workItem.typeIcon} color={workItem.typeColor} />
          </div>
          <div className="bp-modal__wi-card-content">
            <div className="bp-modal__wi-card-title">
              <span className="bp-modal__wi-card-type">{workItem.type}</span>
              <span className="bp-modal__wi-card-id">#{workItem.id}:</span>
              <span className="bp-modal__wi-card-name">{workItem.title}</span>
            </div>
            <div className="bp-modal__wi-card-meta">
              {workItem.changedDate && (
                <span className="bp-modal__wi-card-updated">
                  {t('modal.wi.updated', { time: formatRelativeTime(workItem.changedDate) })}
                </span>
              )}
              <span className="bp-modal__wi-card-state">
                <span className="bp-modal__wi-card-dot" />
                {workItem.state}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="bp-modal__footer">
        <button
          className="bp-btn bp-btn--secondary"
          disabled={state.creating}
          onClick={() => {
            try {
              const panelConfig = SDK.getConfiguration() as { panel?: { close(): void } };
              if (panelConfig?.panel?.close) {
                panelConfig.panel.close();
              }
            } catch {/* Panel close not available */}
          }}
        >
          {t('modal.btn.cancel')}
        </button>

        <button
          className="bp-btn bp-btn--primary"
          disabled={
            state.creating ||
            !state.selectedRepoId ||
            !state.selectedBaseBranch ||
            !state.branchName
          }
          onClick={handleCreate}
        >
          {state.creating ? (
            <>
              <div className="bp-spinner-icon" style={{ marginRight: 6, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'white' }} />
              {t('modal.loading.creating')}
            </>
          ) : (
            t('modal.btn.create')
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────

// Suppress browser extension errors that interfere with the page
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('runtime.lastError') || msg.includes('Receiving end does not exist')) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

const container = document.getElementById('root');
if (container) {
  ReactDOM.render(<CreateBranchModal />, container);
} else {
  console.error('[BranchPilot] #root element not found');
}
