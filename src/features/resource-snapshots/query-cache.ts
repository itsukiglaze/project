export const RESOURCE_SNAPSHOT_QUERY_KEYS = {
  latest: "resource-snapshot:latest",
  history: (from: string, to: string) => `resource-snapshot:history:${from}:${to}`,
  historyPrefix: "resource-snapshot:history:",
};
