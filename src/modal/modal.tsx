import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';
import { ServiceIds } from '../common/sdk-services';

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
        await SDK.init({ loaded: false });
        initLocale();

        const sdkConfig = SDK.getConfiguration() as ModalConfig;
        const projectId: string = sdkConfig.projectId ?? SDK.getPageContext().webContext.project.id;
        const workItemId: number = sdkConfig.workItemId ?? 0;

        if (!workItemId || workItemId <= 0) {
          if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.invalidWorkItemId') });
          return;
        }

        // Load config and work item in parallel
        const configService = new ConfigService(projectId);
        const [config, workItem, repos] = await Promise.all([
          configService.load(),
          workItemService.getWorkItemContext(workItemId),
          repoService.getRepositories(projectId),
        ]);

        if (!workItem) {
          if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.invalidWorkItemId') });
          return;
        }

        rulesEngineRef.current = new RulesEngine(config);
        maxLengthRef.current = config.general.maxLength;

        if (!cancelled) {
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
        logger.error('Modal init failed', err);
        if (!cancelled) dispatch({ type: 'INIT_ERROR', payload: t('modal.error.generic', { message: String(err) }) });
      } finally {
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

      dispatch({
        type: 'CREATE_SUCCESS',
        payload: t('modal.success', { name: branchName.trim(), id: String(workItem!.id) }),
      });

      // Auto-close the dialog after a short delay.
      // The HostPageLayoutService may expose a close() shim; if not, the
      // user can dismiss via the X button — the try/catch handles both cases.
      setTimeout(async () => {
        try {
          const svc = await SDK.getService<{ close(): void }>(
            ServiceIds.HostPageLayoutService,
          );
          svc.close();
        } catch {
          // Dialog already closed or close() not available on this service.
        }
      }, 1800);
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
      {/* Work item context */}
      <div className="bp-modal__wi-info">
        <span className="bp-wi-type">{workItem?.type}</span>
        <span>#{workItem?.id} – {workItem?.title}</span>
      </div>

      <div className="bp-modal__body">
        {/* ── Repository ── */}
        <div className="bp-modal__field">
          <label htmlFor="bp-repo">
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
                <option key={b.objectId} value={b.name}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Branch name ── */}
        <div className="bp-modal__field">
          <label htmlFor="bp-name">
            {t('modal.field.branchName')}
            <span className="bp-required"> *</span>
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
            <div className="bp-modal__info">Name is locked by administrator settings.</div>
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

      {/* ── Footer ── */}
      <div className="bp-modal__footer">
        <button
          className="bp-btn bp-btn--secondary"
          disabled={state.creating}
          onClick={async () => {
            try {
              const svc = await SDK.getService<{ close(): void }>(
                ServiceIds.HostPageLayoutService,
              );
              svc.close();
            } catch {/* close() not available — user can dismiss via X */}
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

const container = document.getElementById('root');
if (container) {
  ReactDOM.render(<CreateBranchModal />, container);
} else {
  console.error('[BranchPilot] #root element not found');
}
