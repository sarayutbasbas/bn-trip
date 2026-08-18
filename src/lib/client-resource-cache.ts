"use client";

type Loader<T> = () => Promise<T>;

const values = new Map<string, unknown>();
const requests = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();

export const flightResourceKey = (tripId: string) => `trip:${tripId}:flights`;
export const workspaceResourceKey = (tripId: string, tab: string) =>
  `trip:${tripId}:workspace:${tab}`;
export const MASTER_CHECKLIST_RESOURCE_KEY = "account:master-checklist";

export function peekClientResource<T>(key: string) {
  return values.get(key) as T | undefined;
}

export function invalidateClientResource(...keys: string[]) {
  for (const key of keys) {
    values.delete(key);
    requests.delete(key);
    generations.set(key, (generations.get(key) || 0) + 1);
  }
}

export function invalidateClientResourcesContaining(fragment: string) {
  const matchingKeys = new Set([...values.keys(), ...requests.keys()]);
  invalidateClientResource(
    ...[...matchingKeys].filter((key) => key.includes(fragment)),
  );
}

export function loadClientResource<T>(key: string, loader: Loader<T>, force = false) {
  if (!force) {
    const cached = peekClientResource<T>(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = requests.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  }
  const generation = generations.get(key) || 0;
  const request = loader()
    .then((result) => {
      if ((generations.get(key) || 0) === generation) values.set(key, result);
      return result;
    })
    .finally(() => {
      if (requests.get(key) === request) requests.delete(key);
    });
  requests.set(key, request);
  return request;
}
