type Account = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};

let accountRequest: Promise<Account> | null = null;

/** Deduplicate /api/me across the PWA runtime, dashboard, and settings. */
export function getCurrentAccount() {
  if (!accountRequest) {
    accountRequest = fetch("/api/me").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load account");
      return data as Account;
    });
    accountRequest.catch(() => {
      accountRequest = null;
    });
  }
  return accountRequest;
}

export function updateCurrentAccount(account: Account) {
  accountRequest = Promise.resolve(account);
}

export function clearCurrentAccount() {
  accountRequest = null;
}
