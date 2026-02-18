import { TemplateRenderer } from '../rules/TemplateRenderer';
import type { WorkItemContext } from '../common/types';

const renderer = new TemplateRenderer();

const workItem: WorkItemContext = {
  id: 42,
  title: 'Fix login bug',
  type: 'Bug',
  state: 'Active',
  assignedTo: 'John Doe',
};

describe('TemplateRenderer', () => {
  it('renders {wi.id}', () => {
    expect(renderer.render('{wi.id}', { workItem, prefix: '' })).toBe('42');
  });

  it('renders {wi.title}', () => {
    expect(renderer.render('{wi.title}', { workItem, prefix: '' })).toBe('Fix login bug');
  });

  it('renders {wi.type}', () => {
    expect(renderer.render('{wi.type}', { workItem, prefix: '' })).toBe('Bug');
  });

  it('renders {wi.state}', () => {
    expect(renderer.render('{wi.state}', { workItem, prefix: '' })).toBe('Active');
  });

  it('renders {wi.assignedTo}', () => {
    expect(renderer.render('{wi.assignedTo}', { workItem, prefix: '' })).toBe('John Doe');
  });

  it('renders {prefix}', () => {
    expect(renderer.render('{prefix}{wi.id}', { workItem, prefix: 'hotfix/' }))
      .toBe('hotfix/42');
  });

  it('renders a full template', () => {
    const result = renderer.render('{prefix}{wi.id}-{wi.title}', { workItem, prefix: 'feature/' });
    expect(result).toBe('feature/42-Fix login bug');
  });

  it('replaces unknown tokens with empty string', () => {
    expect(renderer.render('{unknown.token}', { workItem, prefix: '' })).toBe('');
  });

  it('handles missing assignedTo gracefully', () => {
    const wiNoAssignee: WorkItemContext = { ...workItem, assignedTo: undefined };
    expect(renderer.render('{wi.assignedTo}', { workItem: wiNoAssignee, prefix: '' })).toBe('');
  });

  it('renders multiple tokens', () => {
    const result = renderer.render('{wi.type}/{wi.id}-{wi.title}', { workItem, prefix: '' });
    expect(result).toBe('Bug/42-Fix login bug');
  });
});
