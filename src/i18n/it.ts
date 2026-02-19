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
  'modal.loading.tags': 'Caricamento tag…',
  'modal.loading.creating': 'Creazione branch…',
  'modal.picker.filterBranches': 'Filtra branch',
  'modal.picker.filterTags': 'Filtra tag',
  'modal.picker.filterRepos': 'Filtra repository',
  'modal.picker.tabBranches': 'Branch',
  'modal.picker.tabTags': 'Tag',
  'modal.picker.noBranches': 'Nessun branch trovato',
  'modal.picker.noTags': 'Nessun tag trovato',
  'modal.picker.noRepos': 'Nessun repository trovato',
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
  'modal.error.branchConflict':
    'Impossibile creare "{name}" perché esiste il branch "{conflictingRef}". In Git, non è possibile avere sia un branch che una cartella con lo stesso nome. Elimina "{conflictingRef}" prima o usa un prefisso diverso.',
  'modal.error.permissionDenied':
    'Non hai i permessi per creare branch in questo repository.',
  'modal.error.generic': 'Si è verificato un errore: {message}',
  'modal.warning.nameTooLong':
    'Il nome del branch è lungo {length} caratteri (massimo consigliato: {max}).',
  'modal.section.diagnostics': 'Dettagli diagnostici',
  'modal.btn.copyDiagnostics': 'Copia diagnostica',
  'modal.diagnostics.copied': 'Copiato!',
  'modal.stateUpdate': 'Lo stato del work item sarà impostato a "{state}".',
  'modal.info.nameLocked': 'Il nome è bloccato dalle impostazioni dell\'amministratore.',  'modal.wi.updated': 'Aggiornato {time}',
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
  'settings.general.language': 'Lingua',
  'settings.general.language.en': 'English',
  'settings.general.language.it': 'Italiano',
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
  'settings.workItemType.selectType': '-- Seleziona un tipo --',
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

  // ── Settings tab descriptions ───────────────────────────────────────
  'settings.tab.general.description':
    'Impostazioni di formattazione globali applicate a tutti i nomi branch generati. Il template predefinito viene usato come fallback quando nessuna regola specifica corrisponde.',
  'settings.tab.sourceBranch.description':
    'Regole abbinate al branch sorgente selezionato dall\'utente nel dialogo. Valutate per prime — massima priorità. Usa pattern glob o regex per branch come "hotfix/*" o "release/x.y" e applica prefisso e template dedicati.',
  'settings.tab.workItemType.description':
    'Regole abbinate al tipo di work item (Bug, User Story, Task, …). Applicate quando nessuna regola per branch sorgente corrisponde. Definisci prefisso e template per ogni tipo per generare nomi coerenti automaticamente.',

  // ── Field tooltips ──────────────────────────────────────────────────
  'settings.tooltip.nonAlnumReplacement':
    'I caratteri nel titolo del work item che non sono lettere o cifre vengono sostituiti con questo carattere.\nScelte comuni: "-" o "_".\nLascia vuoto per eliminarli.',
  'settings.tooltip.maxLength':
    'I nomi branch più lunghi di questo limite generano un avviso nel dialogo. Git supporta fino a 250 caratteri, ma nomi più corti sono più leggibili.',
  'settings.tooltip.allowManualOverride':
    'Se abilitato, gli utenti possono modificare il nome branch generato prima di crearlo. Disabilita per imporre una denominazione uniforme nel team.',
  'settings.tooltip.matchType':
    'Glob: pattern wildcard semplici, es. "hotfix/*" o "main".\nRegex: espressioni regolari complete, es. "^release/\\d+\\.\\d+$".\nEntrambi vengono testati sul nome completo del branch sorgente.',
  'settings.tooltip.pattern':
    'Pattern confrontato con il nome del branch sorgente selezionato.\nEsempio glob: "hotfix/*" corrisponde a "hotfix/qualsiasi".\nEsempio regex: "^release/.*" corrisponde a qualsiasi branch che inizia con "release/".',
  'settings.tooltip.prefix':
    'Testo statico anteposto al nome generato.\nEsempio: prefisso "hotfix/" + template "{prefix}{wi.id}-{wi.title}" → "hotfix/1234-fix-login".\nLascia vuoto se il template contiene già il percorso desiderato.',
  'settings.tooltip.template':
    'Template per il nome branch. Token supportati:\n· {wi.id} → ID work item (es. 1234)\n· {wi.title} → titolo, normalizzato e in minuscolo\n· {wi.type} → tipo work item (Bug, Story…)\n· {wi.state} → stato corrente del work item\n· {prefix} → valore del campo Prefisso sopra',
  'settings.tooltip.stateOnCreate':
    'Quando il branch viene creato, il work item collegato passerà automaticamente a questo stato. Inserisci il nome esatto dello stato del tuo processo (es. "Attivo", "In Corso", "Committed").',

  // ── Action ─────────────────────────────────────────────────────────
  'action.label': 'Nuovo branch... (BranchPilot)',
  'action.title': 'Crea un nuovo branch collegato a questo Work Item',
};
