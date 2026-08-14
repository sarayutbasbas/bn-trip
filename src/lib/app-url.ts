export function getAppOrigin(request: Request) {
  const configuredUrl = process.env.APP_URL || process.env.GOOGLE_REDIRECT_URI;

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      console.error("BN Trip app URL is invalid");
    }
  }

  return new URL(request.url).origin;
}

export function getAppUrl(request: Request, path = "/") {
  return new URL(path, getAppOrigin(request));
}
