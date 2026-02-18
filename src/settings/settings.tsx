import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import {
  ExtensionConfig,
  SourceBranchRule,
  WorkItemTypeRule,
} from '../common/types';
import { ConfigService } from '../services/ConfigService';
import { WorkItemService, WorkItemTypeInfo } from '../services/WorkItemService';
import { DEFAULT_CONFIG } from '../common/constants';
import { initLocale, t } from '../i18n';
import { logger } from '../services/Logger';

import './settings.scss';

// ─── State ────────────────────────────────────────────────────────────────────

interface SettingsState {
  loading: boolean;
  saving: boolean;
  toast: { message: string; type: 'success' | 'error' } | null;
  config: ExtensionConfig;
  // Active tab
  activeTab: 'general' | 'sourceBranchRules' | 'workItemTypeRules';
  // Import/export editor
  showJsonEditor: boolean;
  jsonEditorValue: string;
  jsonEditorError: string | null;
  projectId: string;
  // Available work item types from Azure DevOps
  workItemTypes: WorkItemTypeInfo[];
}

type Action =
  | { type: 'LOADED'; payload: { config: ExtensionConfig; projectId: string; workItemTypes: WorkItemTypeInfo[] } }
  | { type: 'SET_CONFIG'; payload: ExtensionConfig }
  | { type: 'SAVING' }
  | { type: 'SAVED' }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_TAB'; payload: 'general' | 'sourceBranchRules' | 'workItemTypeRules' }
  | { type: 'TOGGLE_JSON_EDITOR' }
  | { type: 'SET_JSON'; payload: string }
  | { type: 'JSON_ERROR'; payload: string | null };

function initialState(): SettingsState {
  return {
    loading: true,
    saving: false,
    toast: null,
    config: DEFAULT_CONFIG as ExtensionConfig,
    activeTab: 'general',
    showJsonEditor: false,
    jsonEditorValue: '',
    jsonEditorError: null,
    projectId: '',
    workItemTypes: [],
  };
}

function reducer(state: SettingsState, action: Action): SettingsState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, loading: false, config: action.payload.config, projectId: action.payload.projectId, workItemTypes: action.payload.workItemTypes };
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    case 'SAVING':
      return { ...state, saving: true };
    case 'SAVED':
      return { ...state, saving: false };
    case 'SAVE_ERROR':
      return { ...state, saving: false };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'HIDE_TOAST':
      return { ...state, toast: null };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'TOGGLE_JSON_EDITOR':
      return {
        ...state,
        showJsonEditor: !state.showJsonEditor,
        jsonEditorValue: !state.showJsonEditor
          ? JSON.stringify(state.config, null, 2)
          : state.jsonEditorValue,
        jsonEditorError: null,
      };
    case 'SET_JSON':
      return { ...state, jsonEditorValue: action.payload };
    case 'JSON_ERROR':
      return { ...state, jsonEditorError: action.payload };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let configServiceRef: ConfigService | null = null;

// ─── Root component ───────────────────────────────────────────────────────────

const SettingsHub: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await SDK.init({ loaded: false });
        
        // Initialize with English as default
        initLocale('en');

        const ctx = SDK.getPageContext();
        const projectId = ctx.webContext.project.id;
        configServiceRef = new ConfigService(projectId);
        const config = await configServiceRef.load();
        
        // Set language from saved config
        initLocale(config.general.language || 'en');

        // Fetch available work item types
        const workItemService = new WorkItemService();
        const workItemTypes = await workItemService.getWorkItemTypes(projectId);

        if (!cancelled) dispatch({ type: 'LOADED', payload: { config, projectId, workItemTypes } });
      } catch (err) {
        logger.error('Settings init failed', err);
        if (!cancelled) dispatch({ type: 'LOADED', payload: { config: DEFAULT_CONFIG as ExtensionConfig, projectId: '', workItemTypes: [] } });
      } finally {
        SDK.notifyLoadSucceeded();
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    toastTimerRef.current = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3000);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!configServiceRef) return;
    dispatch({ type: 'SAVING' });
    try {
      await configServiceRef.save(state.config);
      dispatch({ type: 'SAVED' });
      showToast(t('settings.saved'), 'success');
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR', payload: String(err) });
      showToast(t('settings.saveError', { message: String(err) }), 'error');
    }
  }, [state.config, showToast]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (!window.confirm(t('settings.confirmReset'))) return;
    dispatch({ type: 'SET_CONFIG', payload: DEFAULT_CONFIG as ExtensionConfig });
    showToast('Reset to defaults. Click Save to persist.', 'success');
  }, [showToast]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const json = JSON.stringify(state.config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'branchpilot-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.config]);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ExtensionConfig;
        dispatch({ type: 'SET_CONFIG', payload: parsed });
        showToast(t('settings.importSuccess'), 'success');
      } catch (err) {
        showToast(t('settings.importError', { message: String(err) }), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showToast]);

  // ── Apply JSON editor ─────────────────────────────────────────────────────

  const handleApplyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(state.jsonEditorValue) as ExtensionConfig;
      dispatch({ type: 'SET_CONFIG', payload: parsed });
      dispatch({ type: 'JSON_ERROR', payload: null });
      showToast(t('settings.importSuccess'), 'success');
    } catch (err) {
      dispatch({ type: 'JSON_ERROR', payload: `Invalid JSON: ${String(err)}` });
    }
  }, [state.jsonEditorValue, showToast]);

  // ── Config mutation helpers ───────────────────────────────────────────────

  const setGeneral = useCallback(<K extends keyof ExtensionConfig['general']>(
    key: K,
    value: ExtensionConfig['general'][K],
  ) => {
    dispatch({
      type: 'SET_CONFIG',
      payload: { ...state.config, general: { ...state.config.general, [key]: value } },
    });
  }, [state.config]);

  const setDefaultTemplate = useCallback((template: string) => {
    dispatch({
      type: 'SET_CONFIG',
      payload: { ...state.config, defaults: { ...state.config.defaults, template } },
    });
  }, [state.config]);

  // Source branch rules
  const addSourceBranchRule = useCallback(() => {
    const newRule: SourceBranchRule = {
      name: 'New rule',
      matchType: 'glob',
      match: '',
      prefix: '',
      template: 'feature/{wi.id}-{wi.title}',
    };
    dispatch({
      type: 'SET_CONFIG',
      payload: { ...state.config, rulesBySourceBranch: [...state.config.rulesBySourceBranch, newRule] },
    });
  }, [state.config]);

  const updateSourceBranchRule = useCallback((index: number, updated: SourceBranchRule) => {
    const rules = [...state.config.rulesBySourceBranch];
    rules[index] = updated;
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, rulesBySourceBranch: rules } });
  }, [state.config]);

  const removeSourceBranchRule = useCallback((index: number) => {
    const rules = state.config.rulesBySourceBranch.filter((_, i) => i !== index);
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, rulesBySourceBranch: rules } });
  }, [state.config]);

  // Work item type rules
  const addWorkItemTypeRule = useCallback(() => {
    const newRule: WorkItemTypeRule = {
      workItemType: '',
      prefix: '',
      template: 'feature/{wi.id}-{wi.title}',
    };
    dispatch({
      type: 'SET_CONFIG',
      payload: { ...state.config, rulesByWorkItemType: [...state.config.rulesByWorkItemType, newRule] },
    });
  }, [state.config]);

  const updateWorkItemTypeRule = useCallback((index: number, updated: WorkItemTypeRule) => {
    const rules = [...state.config.rulesByWorkItemType];
    rules[index] = updated;
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, rulesByWorkItemType: rules } });
  }, [state.config]);

  const removeWorkItemTypeRule = useCallback((index: number) => {
    const rules = state.config.rulesByWorkItemType.filter((_, i) => i !== index);
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, rulesByWorkItemType: rules } });
  }, [state.config]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="bp-loading">
        <div className="bp-spinner-icon" />
        <span>Loading settings…</span>
      </div>
    );
  }

  const { config, activeTab } = state;

  return (
    <div className="bp-settings">
      {/* ── Header ── */}
      <div className="bp-settings__header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </div>

      {/* ── Action bar ── */}
      <div className="bp-settings__actions">
        <button className="bp-btn bp-btn--primary" disabled={state.saving} onClick={handleSave}>
          {state.saving ? '…' : t('settings.btn.save')}
        </button>
        <button className="bp-btn bp-btn--secondary" onClick={handleExport}>
          {t('settings.btn.export')}
        </button>
        <label className="bp-btn bp-btn--secondary" style={{ cursor: 'pointer' }}>
          {t('settings.btn.import')}
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
        </label>
        <button className="bp-btn bp-btn--secondary" onClick={() => dispatch({ type: 'TOGGLE_JSON_EDITOR' })}>
          {state.showJsonEditor ? 'Hide JSON editor' : 'Edit raw JSON'}
        </button>
        <button className="bp-btn bp-btn--danger" onClick={handleReset}>
          {t('settings.btn.reset')}
        </button>
      </div>

      {/* ── Raw JSON editor ── */}
      {state.showJsonEditor && (
        <div className="bp-settings__json-section">
          <textarea
            className="bp-settings__json-editor"
            value={state.jsonEditorValue}
            onChange={(e) => dispatch({ type: 'SET_JSON', payload: e.target.value })}
            spellCheck={false}
          />
          {state.jsonEditorError && (
            <div style={{ color: '#a4262c', fontSize: 12, marginTop: 4 }}>{state.jsonEditorError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="bp-btn bp-btn--primary bp-btn--small" onClick={handleApplyJson}>
              Apply JSON
            </button>
            <button className="bp-btn bp-btn--secondary bp-btn--small" onClick={() =>
              dispatch({ type: 'SET_JSON', payload: JSON.stringify(config, null, 2) })
            }>
              Reset to current
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bp-settings__tabs">
        <button
          className={`bp-settings__tab${activeTab === 'general' ? ' bp-settings__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'general' })}
        >
          {t('settings.section.general')}
        </button>
        <button
          className={`bp-settings__tab${activeTab === 'sourceBranchRules' ? ' bp-settings__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'sourceBranchRules' })}
        >
          {t('settings.section.sourceBranchRules')}
        </button>
        <button
          className={`bp-settings__tab${activeTab === 'workItemTypeRules' ? ' bp-settings__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'workItemTypeRules' })}
        >
          {t('settings.section.workItemTypeRules')}
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="bp-settings__tab-content">
        {/* ── General Tab ── */}
        {activeTab === 'general' && (
          <>
            <div className="bp-settings__field">
              <label>{t('settings.general.language')}</label>
              <select
                className="bp-settings__input bp-settings__input--narrow"
                value={config.general.language || 'en'}
                onChange={(e) => {
                  const newLang = e.target.value as 'en' | 'it';
                  setGeneral('language', newLang);
                  initLocale(newLang);
                }}
              >
                <option value="en">{t('settings.general.language.en')}</option>
                <option value="it">{t('settings.general.language.it')}</option>
              </select>
            </div>

            <label className="bp-settings__checkbox-label">
              <input
                type="checkbox"
                checked={config.general.lowercase}
                onChange={(e) => setGeneral('lowercase', e.target.checked)}
              />
              {t('settings.general.lowercase')}
            </label>

            <div className="bp-settings__field">
              <label>{t('settings.general.nonAlnumReplacement')}</label>
              <input
                type="text"
                className="bp-settings__input bp-settings__input--narrow bp-settings__input--mono"
                maxLength={1}
                value={config.general.nonAlnumReplacement}
                onChange={(e) => setGeneral('nonAlnumReplacement', e.target.value)}
              />
            </div>

            <div className="bp-settings__field">
              <label>{t('settings.general.maxLength')}</label>
              <input
                type="number"
                className="bp-settings__input bp-settings__input--narrow"
                min={20}
                max={250}
                value={config.general.maxLength}
                onChange={(e) => setGeneral('maxLength', Number(e.target.value))}
              />
            </div>

            <label className="bp-settings__checkbox-label">
              <input
                type="checkbox"
                checked={config.general.allowManualNameOverride}
                onChange={(e) => setGeneral('allowManualNameOverride', e.target.checked)}
              />
              {t('settings.general.allowManualOverride')}
            </label>

            <h3 style={{ marginTop: 20, marginBottom: 10 }}>{t('settings.section.defaults')}</h3>
            <div className="bp-settings__field">
              <label>{t('settings.defaults.template')}</label>
              <input
                type="text"
                className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
                value={config.defaults.template}
                onChange={(e) => setDefaultTemplate(e.target.value)}
              />
              <span className="bp-hint">{t('settings.defaults.template.hint')}</span>
            </div>
          </>
        )}

        {/* ── Source Branch Rules Tab ── */}
        {activeTab === 'sourceBranchRules' && (
          <>
            <div className="bp-settings__rules">
              {config.rulesBySourceBranch.map((rule, i) => (
                <SourceBranchRuleCard
                  key={i}
                  index={i}
                  rule={rule}
                  onChange={(updated) => updateSourceBranchRule(i, updated)}
                  onRemove={() => removeSourceBranchRule(i)}
                />
              ))}
            </div>
            <button className="bp-btn bp-btn--secondary bp-btn--small bp-settings__add-rule-btn" onClick={addSourceBranchRule}>
              + {t('settings.sourceBranch.addRule')}
            </button>
          </>
        )}

        {/* ── Work Item Type Rules Tab ── */}
        {activeTab === 'workItemTypeRules' && (
          <>
            <div className="bp-settings__rules">
              {config.rulesByWorkItemType.map((rule, i) => (
                <WorkItemTypeRuleCard
                  key={i}
                  index={i}
                  rule={rule}
                  workItemTypes={state.workItemTypes}
                  onChange={(updated) => updateWorkItemTypeRule(i, updated)}
                  onRemove={() => removeWorkItemTypeRule(i)}
                />
              ))}
            </div>
            <button className="bp-btn bp-btn--secondary bp-btn--small bp-settings__add-rule-btn" onClick={addWorkItemTypeRule}>
              + {t('settings.workItemType.addRule')}
            </button>
          </>
        )}
      </div>

      {/* ── Toast ── */}
      {state.toast && (
        <div className={`bp-settings__toast bp-settings__toast--${state.toast.type}`}>
          {state.toast.message}
        </div>
      )}
    </div>
  );
};

// ─── Source Branch Rule Card ──────────────────────────────────────────────────

interface SourceBranchRuleCardProps {
  index: number;
  rule: SourceBranchRule;
  onChange: (rule: SourceBranchRule) => void;
  onRemove: () => void;
}

const SourceBranchRuleCard: React.FC<SourceBranchRuleCardProps> = ({ index, rule, onChange, onRemove }) => {
  const set = <K extends keyof SourceBranchRule>(key: K, value: SourceBranchRule[K]) =>
    onChange({ ...rule, [key]: value });

  return (
    <div className="bp-settings__rule-card">
      <div className="bp-settings__rule-card-header">
        <span>Rule #{index + 1}</span>
        <button className="bp-btn bp-btn--danger bp-btn--small" onClick={onRemove}>
          {t('settings.sourceBranch.removeRule')}
        </button>
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.sourceBranch.name')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide"
          value={rule.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.sourceBranch.matchType')}</label>
        <select className="bp-settings__select" value={rule.matchType}
          onChange={(e) => set('matchType', e.target.value as 'glob' | 'regex')}>
          <option value="glob">Glob</option>
          <option value="regex">Regex</option>
        </select>
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.sourceBranch.match')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
          value={rule.match} onChange={(e) => set('match', e.target.value)}
          placeholder={rule.matchType === 'glob' ? 'hotfix/*' : '^hotfix(/.*)?$'} />
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.sourceBranch.prefix')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
          value={rule.prefix} onChange={(e) => set('prefix', e.target.value)}
          placeholder="hotfix/" />
      </div>

      <div className="bp-settings__field bp-settings__rule-card--full">
        <label>{t('settings.sourceBranch.template')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
          value={rule.template} onChange={(e) => set('template', e.target.value)}
          placeholder="{prefix}{wi.id}-{wi.title}" />
        <span className="bp-hint">{t('settings.defaults.template.hint')}</span>
      </div>

      <div className="bp-settings__field">
        <label className="bp-settings__checkbox-label">
          <input type="checkbox" checked={rule.workItemState?.enabled ?? false}
            onChange={(e) => set('workItemState', { enabled: e.target.checked, state: rule.workItemState?.state ?? '' })} />
          {t('settings.sourceBranch.stateEnabled')}
        </label>
      </div>

      {rule.workItemState?.enabled && (
        <div className="bp-settings__field">
          <label>{t('settings.sourceBranch.state')}</label>
          <input type="text" className="bp-settings__input bp-settings__input--wide"
            value={rule.workItemState.state}
            onChange={(e) => set('workItemState', { enabled: true, state: e.target.value })}
            placeholder="Active" />
        </div>
      )}
    </div>
  );
};

// ─── Work Item Type Rule Card ─────────────────────────────────────────────────

interface WorkItemTypeRuleCardProps {
  index: number;
  rule: WorkItemTypeRule;
  onChange: (rule: WorkItemTypeRule) => void;
  onRemove: () => void;
  workItemTypes: WorkItemTypeInfo[];
}

const WorkItemTypeRuleCard: React.FC<WorkItemTypeRuleCardProps> = ({ index, rule, onChange, onRemove, workItemTypes }) => {
  const set = <K extends keyof WorkItemTypeRule>(key: K, value: WorkItemTypeRule[K]) =>
    onChange({ ...rule, [key]: value });

  return (
    <div className="bp-settings__rule-card">
      <div className="bp-settings__rule-card-header">
        <span>Rule #{index + 1}</span>
        <button className="bp-btn bp-btn--danger bp-btn--small" onClick={onRemove}>
          {t('settings.workItemType.removeRule')}
        </button>
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.workItemType.type')}</label>
        <select className="bp-settings__select bp-settings__select--wide"
          value={rule.workItemType}
          onChange={(e) => set('workItemType', e.target.value)}>
          <option value="">{t('settings.workItemType.selectType')}</option>
          {workItemTypes.map((wit) => (
            <option key={wit.name} value={wit.name}>{wit.name}</option>
          ))}
        </select>
      </div>

      <div className="bp-settings__field">
        <label>{t('settings.workItemType.prefix')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
          value={rule.prefix ?? ''} onChange={(e) => set('prefix', e.target.value)}
          placeholder="bugfix/" />
      </div>

      <div className="bp-settings__field bp-settings__rule-card--full">
        <label>{t('settings.workItemType.template')}</label>
        <input type="text" className="bp-settings__input bp-settings__input--wide bp-settings__input--mono"
          value={rule.template} onChange={(e) => set('template', e.target.value)}
          placeholder="{prefix}{wi.id}-{wi.title}" />
        <span className="bp-hint">{t('settings.defaults.template.hint')}</span>
      </div>

      <div className="bp-settings__field">
        <label className="bp-settings__checkbox-label">
          <input type="checkbox" checked={rule.workItemState?.enabled ?? false}
            onChange={(e) => set('workItemState', { enabled: e.target.checked, state: rule.workItemState?.state ?? '' })} />
          {t('settings.workItemType.stateEnabled')}
        </label>
      </div>

      {rule.workItemState?.enabled && (
        <div className="bp-settings__field">
          <label>{t('settings.workItemType.state')}</label>
          <input type="text" className="bp-settings__input bp-settings__input--wide"
            value={rule.workItemState.state}
            onChange={(e) => set('workItemState', { enabled: true, state: e.target.value })}
            placeholder="Active" />
        </div>
      )}
    </div>
  );
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const container = document.getElementById('root');
if (container) {
  ReactDOM.render(<SettingsHub />, container);
} else {
  console.error('[BranchPilot] #root element not found in settings');
}
