export interface StorageStatus {
  persisted: boolean | null;
  usageMB: number | null;
  quotaMB: number | null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const s = navigator.storage;
  const persisted = s?.persisted ? await s.persisted() : null;
  const est = s?.estimate ? await s.estimate() : undefined;
  const mb = (n?: number) => (n === undefined ? null : Math.round((n / 1048576) * 10) / 10);
  return { persisted, usageMB: mb(est?.usage), quotaMB: mb(est?.quota) };
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}
