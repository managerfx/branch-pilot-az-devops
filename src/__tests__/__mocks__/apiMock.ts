// Mock for azure-devops-extension-api
export const getClient = jest.fn().mockReturnValue({
  getRepositories: jest.fn().mockResolvedValue([]),
  getRefs: jest.fn().mockResolvedValue([]),
  updateRefs: jest.fn().mockResolvedValue([{ success: true }]),
  getWorkItem: jest.fn().mockResolvedValue({ id: 42, fields: {} }),
  updateWorkItem: jest.fn().mockResolvedValue({}),
});

export const GitRestClient = class MockGitRestClient {};
export const WorkItemTrackingRestClient = class MockWITRestClient {};
