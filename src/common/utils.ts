import { HARD_MAX_LENGTH } from './constants';
import { ExtensionConfig, ValidationResult } from './types';

/**
 * Sanitizes a string for use as a git branch name segment.
 * Replaces non-alphanumeric characters (except `/`, `-`, `_`, `.`) with the
 * configured replacement character and collapses consecutive replacements.
 */
export function sanitizeBranchSegment(
  value: string,
  replacement: string = '-',
): string {
  // Replace non-allowed chars (allow alnum, -, _, .)
  let result = value.replace(/[^a-zA-Z0-9\-_.]/g, replacement);
  // Collapse consecutive replacements
  const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (replacement.length > 0) {
    result = result.replace(new RegExp(`${escapedReplacement}+`, 'g'), replacement);
  }
  // Remove leading/trailing replacement chars or dots
  result = result.replace(new RegExp(`^[${escapedReplacement}.]+|[${escapedReplacement}.]+$`, 'g'), '');
  return result;
}

/**
 * Applies full sanitization to a branch name, respecting the extension config:
 * - replaces non-alnum (excluding `/`, `-`, `_`, `.`)
 * - forces lowercase if configured
 * - truncates to maxLength, keeping the `{wi.id}` part intact
 */
export function sanitizeBranchName(
  name: string,
  config: Pick<ExtensionConfig['general'], 'lowercase' | 'nonAlnumReplacement' | 'maxLength'>,
): string {
  let result = name;

  // Sanitize each segment separated by `/`
  const segments = result.split('/');
  const sanitized = segments.map((seg) =>
    sanitizeBranchSegment(seg, config.nonAlnumReplacement),
  );
  result = sanitized.filter((s) => s.length > 0).join('/');

  // Lowercase
  if (config.lowercase) {
    result = result.toLowerCase();
  }

  // Truncate, preserving prefix and id if possible
  if (result.length > config.maxLength) {
    result = truncateBranchName(result, config.maxLength);
  }

  return result;
}

/**
 * Truncates a branch name to maxLength.
 * Strategy: preserve everything up to and including the first numeric segment
 * (the work item ID), then truncate the title part.
 *
 * Example: "feature/12345-this-is-a-very-long-title" → "feature/12345-this-is-a"
 */
export function truncateBranchName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;

  // Find the work item id portion (e.g. "12345-")
  const idMatch = name.match(/^([^/]*\/)?(\d+-)(.*)$/);
  if (idMatch) {
    const prefix = idMatch[1] || '';
    const id = idMatch[2]; // e.g. "12345-"
    const title = idMatch[3];
    const reserved = prefix.length + id.length;
    const available = maxLength - reserved;
    if (available > 0) {
      return prefix + id + title.slice(0, available).replace(/-+$/, '');
    }
    // Can't fit even the prefix+id — just truncate hard
    return name.slice(0, maxLength);
  }

  return name.slice(0, maxLength).replace(/-+$/, '');
}

/**
 * Validates a branch name for common Git rules.
 */
export function validateBranchName(
  name: string,
  maxLength: number,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Branch name cannot be empty.');
  }

  if (name.length > maxLength) {
    warnings.push(`Branch name is ${name.length} characters (max: ${maxLength}).`);
  }

  if (name.length > HARD_MAX_LENGTH) {
    errors.push(`Branch name exceeds the hard limit of ${HARD_MAX_LENGTH} characters.`);
  }

  // Git disallows these patterns
  if (/\s/.test(name)) {
    errors.push('Branch name cannot contain spaces.');
  }
  if (/\.\./.test(name)) {
    errors.push('Branch name cannot contain "..".');
  }
  if (/^-/.test(name) || /-$/.test(name)) {
    errors.push('Branch name cannot start or end with a hyphen.');
  }
  if (/[~^:?*\[\\]/.test(name)) {
    errors.push('Branch name contains invalid characters.');
  }
  if (name.endsWith('.lock')) {
    errors.push('Branch name cannot end with ".lock".');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Strips the "refs/heads/" prefix from a branch name, if present.
 */
export function stripRefsHeads(branch: string): string {
  return branch.startsWith('refs/heads/') ? branch.slice('refs/heads/'.length) : branch;
}

/**
 * Generates a short timestamp suffix for deduplication (e.g. "-240118-1530").
 */
export function shortTimestampSuffix(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `-${y}${mo}${d}-${h}${mi}`;
}

/**
 * Deep-merges two objects. Arrays are replaced (not merged).
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key as keyof T];
    const baseVal = base[key as keyof T];
    if (
      overrideVal !== undefined &&
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

/** Encodes a branch name for use in a vstfs artifact link URI */
export function encodeBranchForArtifactLink(branchName: string): string {
  // Azure DevOps uses "GB" prefix + URL-encoded branch name (without refs/heads/)
  const name = stripRefsHeads(branchName);
  return 'GB' + encodeURIComponent(name).replace(/%2F/g, '%2F');
}
