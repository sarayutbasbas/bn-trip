"use client";

type Loader<T> = () => Promise<T>;

const values = new Map<string, unknown>();
const requests = new Map<string, Promise<unknown>>();

export const flightResourceKey = (tripId: string) => `trip:${tripId}:flights`;
export const workspaceResourceKey = (tripId: string, tab: string) =>
  `trip:${tripId}:workspace:${tab}`;
export const MASTER_CHECKLIST_RESOURCE_KEY = "account:master-checklist";

export function peekClientResource<T>(key: string) {
  return values.get(key) as T | undefined;
}

export function invalidateClientResource(...keys: string[]) {
  for (const key of keys) values.delete(key);
}

export function invalidateClientResourcesContaining(fragment: string) {
  for (const key of values.keys()) {
    if (key.includes(fragment)) values.delete(key);
  }
}

export function loadClientResource<T>(key: string, loader: Loader<T>, force = false) {
  if (!force) {
    const cached = peekClientResource<T>(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = requests.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  }
  const request = loader()
    .then((result) => {
      values.set(key, result);
      return result;
    })
    .finally(() => {
      if (requests.get(key) === request) requests.delete(key);
    });
  requests.set(key, request);
  return request;
}
