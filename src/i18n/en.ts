export const en = {
  // ── Modal ──────────────────────────────────────────────────────────
  'modal.title': 'Create Branch',
  'modal.field.repository': 'Repository',
  'modal.field.repository.placeholder': 'Select a repository…',
  'modal.field.basedOn': 'Based on',
  'modal.field.basedOn.placeholder': 'Select source branch…',
  'modal.field.branchName': 'Branch name',
  'modal.field.branchName.placeholder': 'Branch name will be generated…',
  'modal.btn.create': 'Create',
  'modal.btn.cancel': 'Cancel',
  'modal.loading.repos': 'Loading repositories…',
  'modal.loading.branches': 'Loading branches…',
  'modal.loading.creating': 'Creating branch…',
  'modal.success': 'Branch "{name}" created and linked to work item #{id}.',
  'modal.error.unsavedWorkItem':
    'Save the Work Item before creating a branch.',
  'modal.error.invalidWorkItemId':
    'Work Item ID is not available. Please save the Work Item first.',
  'modal.error.repoRequired': 'Please select a repository.',
  'modal.error.basedOnRequired': 'Please select a source branch.',
  'modal.error.branchNameRequired': 'Please enter a branch name.',
  'modal.error.branchExists':
    'Branch "{name}" already exists. Try "{suggestion}".',
  'modal.error.permissionDenied':
    'You do not have permission to create branches in this repository.',
  'modal.error.generic': 'An error occurred: {message}',
  'modal.warning.nameTooLong':
    'Branch name is {length} characters (recommended max: {max}).',
  'modal.section.diagnostics': 'Diagnostic details',
  'modal.btn.copyDiagnostics': 'Copy diagnostics',
  'modal.diagnostics.copied': 'Copied!',
  'modal.stateUpdate': 'Work item state will be set to "{state}".',

  // ── Settings Hub ───────────────────────────────────────────────────
  'settings.title': 'BranchPilot Settings',
  'settings.subtitle':
    'Configure branch naming rules, defaults, and per-repository overrides.',
  'settings.btn.save': 'Save',
  'settings.btn.export': 'Export JSON',
  'settings.btn.import': 'Import JSON',
  'settings.btn.reset': 'Reset to defaults',
  'settings.saved': 'Settings saved.',
  'settings.saveError': 'Failed to save settings: {message}',
  'settings.importSuccess': 'Configuration imported successfully.',
  'settings.importError': 'Failed to import configuration: {message}',
  'settings.confirmReset':
    'Are you sure you want to reset all settings to defaults? This cannot be undone.',

  'settings.section.general': 'General',
  'settings.general.lowercase': 'Force branch names to lowercase',
  'settings.general.nonAlnumReplacement':
    'Non-alphanumeric replacement character',
  'settings.general.maxLength': 'Maximum branch name length',
  'settings.general.allowManualOverride':
    'Allow users to manually edit the branch name',

  'settings.section.defaults': 'Default Template',
  'settings.defaults.template': 'Default branch name template',
  'settings.defaults.template.hint':
    'Available tokens: {wi.id}, {wi.title}, {wi.type}, {wi.state}, {prefix}',

  'settings.section.sourceBranchRules': 'Source Branch Rules',
  'settings.sourceBranch.addRule': 'Add rule',
  'settings.sourceBranch.removeRule': 'Remove',
  'settings.sourceBranch.name': 'Rule name',
  'settings.sourceBranch.matchType': 'Match type',
  'settings.sourceBranch.match': 'Pattern',
  'settings.sourceBranch.prefix': 'Prefix',
  'settings.sourceBranch.template': 'Template',
  'settings.sourceBranch.stateEnabled': 'Update work item state',
  'settings.sourceBranch.state': 'New state',

  'settings.section.workItemTypeRules': 'Work Item Type Rules',
  'settings.workItemType.addRule': 'Add rule',
  'settings.workItemType.removeRule': 'Remove',
  'settings.workItemType.type': 'Work item type',
  'settings.workItemType.prefix': 'Prefix',
  'settings.workItemType.template': 'Template',
  'settings.workItemType.stateEnabled': 'Update work item state',
  'settings.workItemType.state': 'New state',

  'settings.section.repoOverrides': 'Repository Overrides',
  'settings.repoOverrides.hint':
    'Override templates for specific repositories.',
  'settings.repoOverrides.addOverride': 'Add override',
  'settings.repoOverrides.removeOverride': 'Remove',
  'settings.repoOverrides.repoName': 'Repository name or ID',
  'settings.repoOverrides.template': 'Template',

  // ── Action ─────────────────────────────────────────────────────────
  'action.label': 'BranchPilot: Create branch',
  'action.title': 'Create a new branch linked to this Work Item',
};

export type I18nKey = keyof typeof en;
