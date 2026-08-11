const CLOUDFLARE_BEACON_URL = "https://static.cloudflareinsights.com/beacon.min.js";

export function initializeAnalytics(): void {
  const token = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();
  if (!token || document.querySelector("script[data-cf-beacon]")) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = CLOUDFLARE_BEACON_URL;
  script.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(script);
}
