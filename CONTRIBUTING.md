# Contributing to BranchPilot

## Development setup

```bash
git clone https://github.com/YOUR_ORG/branch-pilot.git
cd branch-pilot
npm install
npm run build:dev
```

## Running tests

```bash
npm test            # single run with coverage
npm run test:watch  # watch mode
```

## Testing locally in Azure DevOps

1. Build: `npm run build`
2. Package: `npm run package` → generates a `.vsix`
3. Upload to your Azure DevOps organisation under **Manage Extensions → Upload**
4. Assign the extension to your project

> Use `overrides-dev.json` + `npm run package:dev` for a dev-only non-public build.

## Adding a new rule type

1. Add the type to `src/common/types.ts`
2. Add matching logic in `src/rules/RulesEngine.ts`
3. Add UI in `src/settings/settings.tsx`
4. Add tests in `src/__tests__/RulesEngine.test.ts`

## i18n

- Add keys to `src/i18n/en.ts` first (source of truth)
- Add Italian translations to `src/i18n/it.ts`
- The `I18nKey` type is inferred from `en.ts` — TypeScript will catch missing keys

## Commit style

```
feat: add per-repository template override
fix: handle WI ID 0 gracefully
docs: update troubleshooting section
test: add truncation edge case
```
