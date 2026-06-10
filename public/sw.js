// 離線快取：同源 app 檔案用「網路優先」（連得上網就拿最新，免清快取），離線才用快取
const CACHE = "tdee-v63";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./foods_tw.js",
  "./foods_chain.js",
  "./foods_drinks.js",
  "./foods_breakfast.js",
  "./foods_convenience.js",
  "./foods_5050.js",
  "./foods_street.js",
  "./foods_protein.js",
  "./foods_pizza.js",
  "./foods_bread.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API 不快取（需要即時、要帶 token）
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: "離線中" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  // 同源檔案（html/css/js…）：網路優先，成功就更新快取；失敗（離線）才回快取
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // 跨源（如 CDN）：快取優先，背景更新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.status === 200 && url.href.includes("cdn.jsdelivr.net")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
