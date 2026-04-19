// Leads Sync — Cloudflare Worker beacon injector
//
// Why this exists:
//   WordPress page caches (WP Rocket, LiteSpeed, hosting cache, etc.) serve
//   frozen HTML from before the Leads Sync plugin was installed. Those
//   cached pages don't contain the beacon <script> tag, so visits from
//   cached pages are never counted. Purging the cache fixes it until the
//   next time something re-populates stale HTML.
//
//   This Worker runs at the Cloudflare edge AFTER the origin responds and
//   BEFORE the HTML reaches the browser. It injects the beacon into every
//   HTML response regardless of what the origin cached. You can't serve
//   stale HTML past it — the inject happens every request.
//
// Deploy:
//   1. Cloudflare dashboard → Workers & Pages → Create → Start from Hello
//      World. Replace the default code with this file.
//   2. Fill in ENDPOINT and SITE_KEYS below.
//   3. Save & Deploy.
//   4. Workers → your-worker → Triggers → Add route:
//        locksmith247sydney.com.au/*
//        www.locksmith247sydney.com.au/*
//      Repeat for each domain you want to track.
//   5. Purge Cloudflare cache once so the Worker starts running on cached
//      URLs (otherwise CF might serve HTML from its own edge cache without
//      invoking the Worker).
//
// Verification:
//   Open any page on one of the sites in an incognito window and view
//   source. You should see a <script data-leads-sync-cf> block near
//   </body>. Within ~30s the dashboard's 24h visitor count should tick up.

const ENDPOINT = "https://REPLACE-WITH-YOUR-DASHBOARD.vercel.app/api/track";

// domain → Leads Sync API key. Get each key from the dashboard's Sites
// page. The key is already public (it ships in the plugin's inline
// script), so embedding it here doesn't reduce security.
const SITE_KEYS = {
  "locksmith247sydney.com.au":   "ls_REPLACE_WITH_SYDNEY_KEY",
  "quicklocksmith.co.nz":        "ls_REPLACE_WITH_QUICK_KEY",
  "locksmith247brisbane.com.au": "ls_REPLACE_WITH_BRISBANE_KEY",
};

// Paths that are HTML but aren't real visitor pages. Skip so we don't
// pollute visitor counts with bot scans of admin/xmlrpc endpoints.
const SKIP_PATH_PREFIXES = [
  "/wp-admin",
  "/wp-login",
  "/wp-json",
  "/xmlrpc",
  "/feed",
  "/cgi-bin",
];

export default {
  async fetch(request) {
    // Hostinger/LiteSpeed origins serve HTML pre-compressed with zstd,
    // which HTMLRewriter cannot decode — the body streams through as
    // opaque bytes and the <body> handler never matches, so injection
    // silently no-ops. Workers decodes gzip and brotli transparently,
    // so cap the forwarded accept-encoding to those two formats.
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("accept-encoding", "gzip, br");
    const forwarded = new Request(request, { headers: forwardHeaders });

    const response = await fetch(forwarded);

    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return response;

    const url = new URL(request.url);
    const hostname = url.hostname.replace(/^www\./, "");
    const key = SITE_KEYS[hostname];
    if (!key) return response;

    if (SKIP_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      return response;
    }

    const script = buildScript(key);

    return new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append(script, { html: true });
        },
      })
      .transform(response);
  },
};

function buildScript(apiKey) {
  // The __leadsSyncFired guard makes this co-exist safely with the
  // plugin's built-in tracker (v1.0.7+). Whichever script runs first
  // sets the flag; the other exits early. No double-counting.
  return `<script data-leads-sync-cf>
(function(){
  try {
    if (window.__leadsSyncFired) return;
    window.__leadsSyncFired = true;
    var body = JSON.stringify({
      key: ${JSON.stringify(apiKey)},
      path: location.pathname + location.search,
      referrer: document.referrer || ""
    });
    var url = ${JSON.stringify(ENDPOINT)};
    var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    fetch(url, {
      method: "POST",
      body: body,
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    }).catch(function(){});
  } catch (e) {}
})();
</script>`;
}
