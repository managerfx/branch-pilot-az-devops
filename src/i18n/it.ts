import { I18nKey } from './en';

export const it: Partial<Record<I18nKey, string>> = {
  // ── Modal ──────────────────────────────────────────────────────────
  'modal.title': 'Crea Branch',
  'modal.field.repository': 'Repository',
  'modal.field.repository.placeholder': 'Seleziona un repository…',
  'modal.field.basedOn': 'Basato su',
  'modal.field.basedOn.placeholder': 'Seleziona branch sorgente…',
  'modal.field.branchName': 'Nome branch',
  'modal.field.branchName.placeholder': 'Il nome verrà generato automaticamente…',
  'modal.btn.create': 'Crea',
  'modal.btn.cancel': 'Annulla',
  'modal.loading.repos': 'Caricamento repository…',
  'modal.loading.branches': 'Caricamento branch…',
  'modal.loading.creating': 'Creazione branch…',
  'modal.success': 'Branch "{name}" creato e collegato al work item #{id}.',
  'modal.error.unsavedWorkItem':
    'Salva il Work Item prima di creare un branch.',
  'modal.error.invalidWorkItemId':
    'ID Work Item non disponibile. Salva prima il Work Item.',
  'modal.error.repoRequired': 'Seleziona un repository.',
  'modal.error.basedOnRequired': 'Seleziona un branch sorgente.',
  'modal.error.branchNameRequired': 'Inserisci un nome per il branch.',
  'modal.error.branchExists':
    'Il branch "{name}" esiste già. Prova "{suggestion}".',
  'modal.error.permissionDenied':
    'Non hai i permessi per creare branch in questo repository.',
  'modal.error.generic': 'Si è verificato un errore: {message}',
  'modal.warning.nameTooLong':
    'Il nome del branch è lungo {length} caratteri (massimo consigliato: {max}).',
  'modal.section.diagnostics': 'Dettagli diagnostici',
  'modal.btn.copyDiagnostics': 'Copia diagnostica',
  'modal.diagnostics.copied': 'Copiato!',
  'modal.stateUpdate': 'Lo stato del work item sarà impostato a "{state}".',

  // ── Settings Hub ───────────────────────────────────────────────────
  'settings.title': 'Impostazioni BranchPilot',
  'settings.subtitle':
    'Configura le regole di nomenclatura branch, i valori predefiniti e le sostituzioni per repository.',
  'settings.btn.save': 'Salva',
  'settings.btn.export': 'Esporta JSON',
  'settings.btn.import': 'Importa JSON',
  'settings.btn.reset': 'Ripristina predefiniti',
  'settings.saved': 'Impostazioni salvate.',
  'settings.saveError': 'Errore nel salvataggio: {message}',
  'settings.importSuccess': 'Configurazione importata con successo.',
  'settings.importError': 'Errore durante l\'importazione: {message}',
  'settings.confirmReset':
    'Sei sicuro di voler ripristinare tutte le impostazioni ai valori predefiniti? L\'operazione non può essere annullata.',

  'settings.section.general': 'Generale',
  'settings.general.lowercase': 'Forza nomi branch in minuscolo',
  'settings.general.nonAlnumReplacement':
    'Carattere sostitutivo per non-alfanumerici',
  'settings.general.maxLength': 'Lunghezza massima nome branch',
  'settings.general.allowManualOverride':
    'Permetti agli utenti di modificare manualmente il nome del branch',

  'settings.section.defaults': 'Template predefinito',
  'settings.defaults.template': 'Template predefinito per il nome branch',
  'settings.defaults.template.hint':
    'Token disponibili: {wi.id}, {wi.title}, {wi.type}, {wi.state}, {prefix}',

  'settings.section.sourceBranchRules': 'Regole per branch sorgente',
  'settings.sourceBranch.addRule': 'Aggiungi regola',
  'settings.sourceBranch.removeRule': 'Rimuovi',
  'settings.sourceBranch.name': 'Nome regola',
  'settings.sourceBranch.matchType': 'Tipo corrispondenza',
  'settings.sourceBranch.match': 'Pattern',
  'settings.sourceBranch.prefix': 'Prefisso',
  'settings.sourceBranch.template': 'Template',
  'settings.sourceBranch.stateEnabled': 'Aggiorna stato work item',
  'settings.sourceBranch.state': 'Nuovo stato',

  'settings.section.workItemTypeRules': 'Regole per tipo Work Item',
  'settings.workItemType.addRule': 'Aggiungi regola',
  'settings.workItemType.removeRule': 'Rimuovi',
  'settings.workItemType.type': 'Tipo work item',
  'settings.workItemType.prefix': 'Prefisso',
  'settings.workItemType.template': 'Template',
  'settings.workItemType.stateEnabled': 'Aggiorna stato work item',
  'settings.workItemType.state': 'Nuovo stato',

  'settings.section.repoOverrides': 'Sostituzioni per repository',
  'settings.repoOverrides.hint':
    'Sostituisci i template per repository specifici.',
  'settings.repoOverrides.addOverride': 'Aggiungi sostituzione',
  'settings.repoOverrides.removeOverride': 'Rimuovi',
  'settings.repoOverrides.repoName': 'Nome o ID repository',
  'settings.repoOverrides.template': 'Template',

  // ── Action ─────────────────────────────────────────────────────────
  'action.label': 'BranchPilot: Crea branch',
  'action.title': 'Crea un nuovo branch collegato a questo Work Item',
};
