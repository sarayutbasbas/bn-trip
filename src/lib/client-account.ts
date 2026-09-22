type Account = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};

let accountRequest: Promise<Account> | null = null;
let currentAccount: Account | null = null;

/** Read the account synchronously after its first load in this browser session. */
export function getCachedCurrentAccount() {
  return currentAccount;
}

/** Deduplicate /api/me across the PWA runtime, dashboard, and settings. */
export function getCurrentAccount() {
  if (!accountRequest) {
    accountRequest = fetch("/api/me").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load account");
      currentAccount = data as Account;
      return currentAccount;
    });
    accountRequest.catch(() => {
      accountRequest = null;
    });
  }
  return accountRequest;
}

export function updateCurrentAccount(account: Account) {
  currentAccount = account;
  accountRequest = Promise.resolve(account);
}

export function clearCurrentAccount() {
  currentAccount = null;
  accountRequest = null;
}
