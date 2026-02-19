import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { BranchInfo, ModalConfig, RepoInfo, TagInfo, WorkItemContext } from '../common/types';
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
  tags: TagInfo[];

  // User selections
  selectedRepoId: string;
  selectedBaseBranch: string;
  selectedBaseObjectId: string;
  branchName: string;
  manualOverride: boolean;

  // UI state
  loadingRepos: boolean;
  loadingBranches: boolean;
  loadingTags: boolean;
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
  | { type: 'BRANCHES_LOADED'; payload: { branches: BranchInfo[]; defaultBranch: string; defaultObjectId: string } }
  | { type: 'TAGS_LOADED'; payload: TagInfo[] }
  | { type: 'SET_BASE_REF'; payload: { name: string; objectId: string } }
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
  tags: [],
  selectedRepoId: '',
  selectedBaseBranch: '',
  selectedBaseObjectId: '',
  branchName: '',
  manualOverride: false,
  loadingRepos: false,
  loadingBranches: false,
  loadingTags: false,
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
        selectedBaseObjectId: '',
        branches: [],
        tags: [],
        branchName: '',
        loadingBranches: true,
        loadingTags: true,
        branchNameError: null,
        branchNameWarning: null,
        stateHint: null,
      };
    case 'BRANCHES_LOADED':
      return {
        ...state,
        branches: action.payload.branches,
        selectedBaseBranch: action.payload.defaultBranch,
        selectedBaseObjectId: action.payload.defaultObjectId,
        loadingBranches: false,
      };
    case 'TAGS_LOADED':
      return { ...state, tags: action.payload, loadingTags: false };
    case 'SET_BASE_REF':
      return { ...state, selectedBaseBranch: action.payload.name, selectedBaseObjectId: action.payload.objectId };
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
  const fallbackColor = color ? `#${color}` : getDefaultTypeColor(type);
  return (
    <div
      className="bp-wi-icon bp-wi-icon--fallback"
      style={{ backgroundColor: fallbackColor }}
    />
  );
}

function getDefaultTypeColor(type: string): string {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('bug')) return '#cc293d';
  if (t.includes('task')) return '#f2cb1d';
  if (t.includes('user story') || t.includes('story')) return '#009ccc';
  if (t.includes('feature')) return '#773b93';
  if (t.includes('epic')) return '#ff7b00';
  return '#605e5c';
}

// ─── SearchableSelect ─────────────────────────────────────────────────────────

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  filterPlaceholder?: string;
  noOptionsText?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onSelect,
  placeholder = '',
  filterPlaceholder = '',
  noOptionsText = '',
  disabled = false,
  icon,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen((o) => !o);
    setFilter('');
  };

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(filter.toLowerCase()),
  );
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <div className="bp-picker" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`bp-picker__trigger${!value ? ' bp-picker__trigger--placeholder' : ''}`}
        disabled={disabled}
        onClick={handleToggle}
      >
        {icon && <span className="bp-picker__trigger-icon">{icon}</span>}
        <span className="bp-picker__trigger-value">{selectedLabel || placeholder}</span>
        <svg className="bp-picker__chevron" width="12" height="12" viewBox="0 0 12 12">
          <path fill="currentColor" d="M6 8L1 3h10z" />
        </svg>
      </button>

      {open && (
        <div className="bp-picker__dropdown" style={dropdownStyle}>
          <div className="bp-picker__search-row">
            <svg className="bp-picker__search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="bp-picker__search-input"
              placeholder={filterPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="bp-picker__list">
            {filtered.length === 0 ? (
              <div className="bp-picker__empty">{noOptionsText}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`bp-picker__item${o.value === value ? ' bp-picker__item--selected' : ''}`}
                  onClick={() => { onSelect(o.value); setOpen(false); setFilter(''); }}
                >
                  <span className="bp-picker__item-check-area">
                    {o.value === value && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 0 0 .28 7.695l3 3a1 1 0 0 0 1.414 0l7-7A1 1 0 0 0 10.28 2.28z" />
                      </svg>
                    )}
                  </span>
                  <span className="bp-picker__item-label">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── BranchTagPicker ──────────────────────────────────────────────────────────

type PickerTab = 'branches' | 'tags';

interface BranchTagPickerProps {
  branches: BranchInfo[];
  tags: TagInfo[];
  defaultBranch?: string;
  value: string;
  onSelect: (name: string, objectId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

const BranchTagPicker: React.FC<BranchTagPickerProps> = ({
  branches,
  tags,
  defaultBranch,
  value,
  onSelect,
  disabled = false,
  loading = false,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('branches');
  const [filter, setFilter] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleToggle = () => {
    if (disabled || loading) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen((o) => !o);
    setFilter('');
  };

  const handleTabChange = (newTab: PickerTab) => {
    setTab(newTab);
    setFilter('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const items = tab === 'branches' ? branches : tags;
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const filterPlaceholder = tab === 'branches'
    ? t('modal.picker.filterBranches')
    : t('modal.picker.filterTags');

  const noItemsText = tab === 'branches'
    ? t('modal.picker.noBranches')
    : t('modal.picker.noTags');

  // Sort branches: default first, then alphabetical
  const sortedBranches = tab === 'branches'
    ? [...filtered].sort((a, b) => {
        if (a.name === defaultBranch) return -1;
        if (b.name === defaultBranch) return 1;
        return a.name.localeCompare(b.name);
      })
    : filtered;

  return (
    <div className="bp-picker" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`bp-picker__trigger${!value ? ' bp-picker__trigger--placeholder' : ''}`}
        disabled={disabled}
        onClick={handleToggle}
      >
        <svg className="bp-picker__trigger-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
        </svg>
        <span className="bp-picker__trigger-value">{value || t('modal.field.basedOn.placeholder')}</span>
        <svg className="bp-picker__chevron" width="12" height="12" viewBox="0 0 12 12">
          <path fill="currentColor" d="M6 8L1 3h10z" />
        </svg>
      </button>

      {open && (
        <div className="bp-picker__dropdown" style={dropdownStyle}>
          {/* Search */}
          <div className="bp-picker__search-row">
            <svg className="bp-picker__search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="bp-picker__search-input"
              placeholder={filterPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <div className="bp-picker__tabs">
            <button
              type="button"
              className={`bp-picker__tab${tab === 'branches' ? ' bp-picker__tab--active' : ''}`}
              onClick={() => handleTabChange('branches')}
            >
              {t('modal.picker.tabBranches')}
            </button>
            <button
              type="button"
              className={`bp-picker__tab${tab === 'tags' ? ' bp-picker__tab--active' : ''}`}
              onClick={() => handleTabChange('tags')}
            >
              {t('modal.picker.tabTags')}
            </button>
          </div>

          {/* List */}
          <div className="bp-picker__list">
            {sortedBranches.length === 0 ? (
              <div className="bp-picker__empty">{noItemsText}</div>
            ) : (
              sortedBranches.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className={`bp-picker__item${item.name === value ? ' bp-picker__item--selected' : ''}`}
                  onClick={() => { onSelect(item.name, item.objectId); setOpen(false); setFilter(''); }}
                >
                  <span className="bp-picker__item-check-area">
                    {item.name === value && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 0 0 .28 7.695l3 3a1 1 0 0 0 1.414 0l7-7A1 1 0 0 0 10.28 2.28z" />
                      </svg>
                    )}
                  </span>
                  {tab === 'branches' ? (
                    <svg className="bp-picker__item-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
                    </svg>
                  ) : (
                    <svg className="bp-picker__item-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M7.05 1.5L1.5 7.05a.75.75 0 0 0 0 1.06l6.44 6.44a.75.75 0 0 0 1.06 0l5.55-5.55a.75.75 0 0 0 0-1.06L8.11 1.5A.75.75 0 0 0 7.05 1.5zM6 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
                    </svg>
                  )}
                  <span className="bp-picker__item-label">{item.name}</span>
                  {tab === 'branches' && item.name === defaultBranch && (
                    <span className="bp-picker__item-badge">Default</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

        await Promise.race([
          SDK.ready(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SDK.ready() timeout after 5s')), 5000)
          )
        ]).catch(err => {
          console.warn('[BranchPilot] SDK.ready() failed, proceeding anyway:', err);
        });
        console.log('[BranchPilot] SDK ready - XDM handshake complete');

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
        const configService = new ConfigService(projectId);

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

        const [branches, tags] = await Promise.all([
          repoService.getBranches(state.projectId, repoId),
          repoService.getTags(state.projectId, repoId),
        ]);

        const defaultBranchName = repo?.defaultBranch ?? (branches[0]?.name ?? '');
        const defaultBranchObj = branches.find((b) => b.name === defaultBranchName);
        const defaultObjectId = defaultBranchObj?.objectId ?? '';

        dispatch({
          type: 'BRANCHES_LOADED',
          payload: { branches, defaultBranch: defaultBranchName, defaultObjectId },
        });
        dispatch({ type: 'TAGS_LOADED', payload: tags });
      } catch (err) {
        logger.error('Failed to load branches/tags', err);
        dispatch({ type: 'SET_LOADING_BRANCHES', payload: false });
      }
    },
    [state.repos, state.projectId],
  );

  // ── Create ───────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const { selectedRepoId, selectedBaseBranch, selectedBaseObjectId, branchName, workItem, projectId } = state;

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
      const sourceObjectId = selectedBaseObjectId;
      if (!sourceObjectId) {
        dispatch({ type: 'CREATE_ERROR', payload: t('modal.error.basedOnRequired') });
        return;
      }

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

      await workItemService.addBranchLink(workItem!.id, projectId, selectedRepoId, result.branchName!);

      if (rulesEngineRef.current) {
        const rule = rulesEngineRef.current.resolveRule(selectedBaseBranch, workItem!.type);
        if (rule.workItemState?.enabled && rule.workItemState.state) {
          await workItemService.updateState(workItem!.id, rule.workItemState.state);
        }
      }

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
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const { initState, initError, workItem, repos, branches, tags } = state;

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

  const selectedRepo = repos.find((r) => r.id === state.selectedRepoId);

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
          <label>
            <svg className="bp-repo-icon" width="14" height="14" viewBox="0 0 48 48">
              <path fill="#F4511E" d="M42.2,22.1L25.9,5.8C25.4,5.3,24.7,5,24,5c0,0,0,0,0,0c-0.7,0-1.4,0.3-1.9,0.8l-3.5,3.5l4.1,4.1c0.4-0.2,0.8-0.3,1.3-0.3c1.7,0,3,1.3,3,3c0,0.5-0.1,0.9-0.3,1.3l4,4c0.4-0.2,0.8-0.3,1.3-0.3c1.7,0,3,1.3,3,3s-1.3,3-3,3c-1.7,0-3-1.3-3-3c0-0.5,0.1-0.9,0.3-1.3l-4-4c-0.1,0-0.2,0.1-0.3,0.1v10.4c1.2,0.4,2,1.5,2,2.8c0,1.7-1.3,3-3,3s-3-1.3-3-3c0-1.3,0.8-2.4,2-2.8V18.8c-1.2-0.4-2-1.5-2-2.8c0-0.5,0.1-0.9,0.3-1.3l-4.1-4.1L5.8,22.1C5.3,22.6,5,23.3,5,24c0,0.7,0.3,1.4,0.8,1.9l16.3,16.3c0,0,0,0,0,0c0.5,0.5,1.2,0.8,1.9,0.8s1.4-0.3,1.9-0.8l16.3-16.3c0.5-0.5,0.8-1.2,0.8-1.9C43,23.3,42.7,22.6,42.2,22.1z"/>
            </svg>
            {t('modal.field.repository')}
            <span className="bp-required"> *</span>
          </label>
          <SearchableSelect
            options={repos.map((r) => ({ value: r.id, label: r.name }))}
            value={state.selectedRepoId}
            onSelect={handleRepoChange}
            placeholder={t('modal.field.repository.placeholder')}
            filterPlaceholder={t('modal.picker.filterRepos')}
            noOptionsText={t('modal.picker.noRepos')}
            disabled={state.creating}
          />
        </div>

        {/* ── Based on ── */}
        <div className="bp-modal__field">
          <label>
            <svg className="bp-branch-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
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
            <BranchTagPicker
              branches={branches}
              tags={tags}
              defaultBranch={selectedRepo?.defaultBranch}
              value={state.selectedBaseBranch}
              onSelect={(name, objectId) =>
                dispatch({ type: 'SET_BASE_REF', payload: { name, objectId } })
              }
              disabled={!state.selectedRepoId || state.creating}
              loading={state.loadingBranches}
            />
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
