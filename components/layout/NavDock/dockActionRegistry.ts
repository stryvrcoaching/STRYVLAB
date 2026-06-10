export const dockActionRegistry: Record<string, (() => void) | undefined> = {};

export function registerDockAction(key: string, handler: () => void) {
  dockActionRegistry[key] = handler;
}

export function unregisterDockAction(key: string) {
  delete dockActionRegistry[key];
}
