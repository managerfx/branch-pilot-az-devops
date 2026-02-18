// Mock for azure-devops-extension-sdk

export const init = jest.fn().mockResolvedValue(undefined);
export const ready = jest.fn().mockResolvedValue(undefined);
export const notifyLoadSucceeded = jest.fn();
export const register = jest.fn();
export const getAccessToken = jest.fn().mockResolvedValue('mock-token');
export const getExtensionContext = jest.fn().mockReturnValue({ id: 'mock-ext-id', version: '1.0.0' });
export const getPageContext = jest.fn().mockReturnValue({
  webContext: { project: { id: 'mock-project-id', name: 'MockProject' } },
});
export const getConfiguration = jest.fn().mockReturnValue({
  workItemId: 42,
  workItemTitle: 'Test work item',
  workItemType: 'User Story',
  workItemState: 'Active',
  projectId: 'mock-project-id',
  projectName: 'MockProject',
});
export const getService = jest.fn().mockResolvedValue({
  getExtensionDataManager: jest.fn().mockResolvedValue({
    getValue: jest.fn().mockResolvedValue(null),
    setValue: jest.fn().mockResolvedValue(undefined),
  }),
  openDialog: jest.fn().mockResolvedValue(undefined),
  openMessageDialog: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
});

export const CommonServiceIds = {
  ExtensionDataService: 'ms.vss-features.extension-data-service',
  HostDialogService: 'ms.vss-features.host-dialog-service',
  HostPageLayoutService: 'ms.vss-features.host-page-layout-service',
};

export default {
  init,
  ready,
  notifyLoadSucceeded,
  register,
  getAccessToken,
  getExtensionContext,
  getPageContext,
  getConfiguration,
  getService,
  CommonServiceIds,
};
