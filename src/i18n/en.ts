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
  'modal.loading.tags': 'Loading tags…',
  'modal.loading.creating': 'Creating branch…',
  'modal.picker.filterBranches': 'Filter branches',
  'modal.picker.filterTags': 'Filter tags',
  'modal.picker.filterRepos': 'Filter repositories',
  'modal.picker.tabBranches': 'Branches',
  'modal.picker.tabTags': 'Tags',
  'modal.picker.noBranches': 'No branches found',
  'modal.picker.noTags': 'No tags found',
  'modal.picker.noRepos': 'No repositories found',
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
  'modal.error.branchConflict':
    'Cannot create "{name}" because branch "{conflictingRef}" exists. In Git, you cannot have both a branch and a folder with the same name. Delete "{conflictingRef}" first or use a different prefix.',
  'modal.error.permissionDenied':
    'You do not have permission to create branches in this repository.',
  'modal.error.generic': 'An error occurred: {message}',
  'modal.warning.nameTooLong':
    'Branch name is {length} characters (recommended max: {max}).',
  'modal.section.diagnostics': 'Diagnostic details',
  'modal.btn.copyDiagnostics': 'Copy diagnostics',
  'modal.diagnostics.copied': 'Copied!',
  'modal.stateUpdate': 'Work item state will be set to "{state}".',
  'modal.info.nameLocked': 'Name is locked by administrator settings.',
  'modal.wi.updated': 'Updated {time}',

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
  'settings.general.language': 'Language',
  'settings.general.language.en': 'English',
  'settings.general.language.it': 'Italiano',
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
  'settings.workItemType.selectType': '-- Select a type --',
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

  // ── Settings tab descriptions ───────────────────────────────────────
  'settings.tab.general.description':
    'Global formatting settings applied to all generated branch names. The default template is used as a fallback when no specific rule matches.',
  'settings.tab.sourceBranch.description':
    'Rules matched against the source branch the user selects in the dialog. Evaluated first — highest priority. Use glob or regex patterns to target branches like "hotfix/*" or "release/x.y" and apply a dedicated prefix and template.',
  'settings.tab.workItemType.description':
    'Rules matched against the work item type (Bug, User Story, Task, …). Applied when no source branch rule matches. Define a prefix and template for each type to generate consistent branch names automatically.',

  // ── Field tooltips ──────────────────────────────────────────────────
  'settings.tooltip.nonAlnumReplacement':
    'Characters in the work item title that are not letters or digits are replaced with this character.\nCommon choices: "-" or "_".\nLeave empty to strip them entirely.',
  'settings.tooltip.maxLength':
    'Branch names longer than this limit will trigger a warning in the dialog. Git supports up to 250 characters, but shorter names are easier to read and type.',
  'settings.tooltip.allowManualOverride':
    'When enabled, users can freely edit the generated branch name in the dialog before creating it. Disable to enforce strict naming compliance across the team.',
  'settings.tooltip.matchType':
    'Glob: simple wildcard patterns, e.g. "hotfix/*" or "main".\nRegex: full regular expressions, e.g. "^release/\\d+\\.\\d+$".\nBoth are tested against the full source branch name.',
  'settings.tooltip.pattern':
    'The pattern matched against the selected source branch name.\nGlob example: "hotfix/*" matches "hotfix/anything".\nRegex example: "^release/.*" matches any branch starting with "release/".',
  'settings.tooltip.prefix':
    'Static text prepended to the generated name.\nExample: prefix "hotfix/" + template "{prefix}{wi.id}-{wi.title}" → "hotfix/1234-fix-login".\nLeave empty if the template already contains the desired path.',
  'settings.tooltip.template':
    'Branch name template. Supported tokens:\n· {wi.id} → work item ID (e.g. 1234)\n· {wi.title} → title, lowercased & sanitized\n· {wi.type} → work item type (Bug, Story…)\n· {wi.state} → current work item state\n· {prefix} → value of the Prefix field above',
  'settings.tooltip.stateOnCreate':
    'When the branch is created, the linked work item will automatically transition to this state. Enter the exact state name from your process template (e.g. "Active", "In Progress", "Committed").',

  // ── Action ─────────────────────────────────────────────────────────
  'action.label': 'New branch... (BranchPilot)',
  'action.title': 'Create a new branch linked to this Work Item',
};

export type I18nKey = keyof typeof en;
