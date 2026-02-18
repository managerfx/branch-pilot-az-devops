import {
  sanitizeBranchSegment,
  sanitizeBranchName,
  truncateBranchName,
  validateBranchName,
  stripRefsHeads,
  shortTimestampSuffix,
  encodeBranchForArtifactLink,
} from '../common/utils';
import { DEFAULT_CONFIG } from '../common/constants';
import type { ExtensionConfig } from '../common/types';

const config = DEFAULT_CONFIG as ExtensionConfig;

// ─── sanitizeBranchSegment ────────────────────────────────────────────────────

describe('sanitizeBranchSegment', () => {
  it('replaces spaces with hyphen', () => {
    expect(sanitizeBranchSegment('hello world')).toBe('hello-world');
  });

  it('collapses consecutive replacements', () => {
    expect(sanitizeBranchSegment('hello   world')).toBe('hello-world');
  });

  it('strips leading/trailing hyphens', () => {
    expect(sanitizeBranchSegment('-hello-')).toBe('hello');
  });

  it('preserves alphanumeric, hyphens, underscores, dots', () => {
    expect(sanitizeBranchSegment('feat_1.2-ok')).toBe('feat_1.2-ok');
  });

  it('replaces accented characters', () => {
    expect(sanitizeBranchSegment('café résumé')).toBe('caf-r-sum');
  });

  it('handles empty string', () => {
    expect(sanitizeBranchSegment('')).toBe('');
  });
});

// ─── sanitizeBranchName ───────────────────────────────────────────────────────

describe('sanitizeBranchName', () => {
  it('lowercases when configured', () => {
    const result = sanitizeBranchName('Feature/123-MyTitle', config.general);
    expect(result).toBe('feature/123-mytitle');
  });

  it('preserves slash separator between segments', () => {
    const result = sanitizeBranchName('feature/123-hello world', config.general);
    expect(result).toBe('feature/123-hello-world');
  });

  it('truncates to maxLength', () => {
    const longName = 'feature/123-' + 'a'.repeat(200);
    const result = sanitizeBranchName(longName, { ...config.general, maxLength: 30 });
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('does not lowercase when disabled', () => {
    const result = sanitizeBranchName('Feature/TEST', { ...config.general, lowercase: false });
    expect(result).toBe('Feature/TEST');
  });
});

// ─── truncateBranchName ───────────────────────────────────────────────────────

describe('truncateBranchName', () => {
  it('preserves id segment when truncating', () => {
    const name = 'feature/12345-this-is-a-very-long-title-that-goes-on-and-on';
    const result = truncateBranchName(name, 30);
    expect(result.startsWith('feature/12345-')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('returns name unchanged if within limit', () => {
    expect(truncateBranchName('feature/123-short', 80)).toBe('feature/123-short');
  });

  it('hard truncates if prefix+id exceed limit', () => {
    const name = 'feature/123456789012345678901234567890-foo';
    const result = truncateBranchName(name, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

// ─── validateBranchName ──────────────────────────────────────────────────────

describe('validateBranchName', () => {
  it('passes a valid branch name', () => {
    const v = validateBranchName('feature/123-my-branch', 80);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it('fails on empty name', () => {
    const v = validateBranchName('', 80);
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/empty/i);
  });

  it('fails when name contains spaces', () => {
    const v = validateBranchName('feature/my branch', 80);
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/space/i);
  });

  it('fails on double dots', () => {
    const v = validateBranchName('feat..ure', 80);
    expect(v.valid).toBe(false);
  });

  it('warns when name exceeds recommended max', () => {
    const longName = 'a'.repeat(90);
    const v = validateBranchName(longName, 80);
    expect(v.warnings.length).toBeGreaterThan(0);
  });

  it('fails on name ending with .lock', () => {
    const v = validateBranchName('feature/test.lock', 80);
    expect(v.valid).toBe(false);
  });
});

// ─── stripRefsHeads ───────────────────────────────────────────────────────────

describe('stripRefsHeads', () => {
  it('strips refs/heads/ prefix', () => {
    expect(stripRefsHeads('refs/heads/main')).toBe('main');
  });

  it('returns name unchanged if no prefix', () => {
    expect(stripRefsHeads('main')).toBe('main');
  });

  it('handles hotfix branches', () => {
    expect(stripRefsHeads('refs/heads/hotfix/1.2.3')).toBe('hotfix/1.2.3');
  });
});

// ─── shortTimestampSuffix ─────────────────────────────────────────────────────

describe('shortTimestampSuffix', () => {
  it('returns a string starting with hyphen', () => {
    expect(shortTimestampSuffix()).toMatch(/^-\d{6}-\d{4}$/);
  });
});

// ─── encodeBranchForArtifactLink ─────────────────────────────────────────────

describe('encodeBranchForArtifactLink', () => {
  it('prepends GB to branch name', () => {
    expect(encodeBranchForArtifactLink('main')).toBe('GBmain');
  });

  it('strips refs/heads/ before encoding', () => {
    expect(encodeBranchForArtifactLink('refs/heads/main')).toBe('GBmain');
  });

  it('URL-encodes special characters', () => {
    const result = encodeBranchForArtifactLink('feature/123-hello');
    expect(result).toContain('GB');
    expect(result).toContain('feature');
  });
});
