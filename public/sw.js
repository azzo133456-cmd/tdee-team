// 離線快取：同源 app 檔案用「網路優先」（連得上網就拿最新，免清快取），離線才用快取
const CACHE = "tdee-v126";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./app_pets.js",
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
  "./foods_morechains.js",
  "./foods_hotpot_sushi.js",
  "./foods_xlsx.js",
  "./foods_xlsx2.js",
  "./foods_drinks_sugar.js",
  "./foods_xlsx_drinks.js",
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

// 推播通知
self.addEventListener("push", (e) => {
  let d = { title: "TDEE 提醒", body: "" };
  try { if (e.data) d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || "TDEE 提醒", {
    body: d.body || "", icon: "./icon-192.png", badge: "./icon-192.png", vibrate: [80, 40, 80],
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  }));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API 不快取（需要即時、要帶 token）
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: "離線中" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  // 同源檔案（html/css/js…）：快取優先 + 背景更新（stale-while-revalidate）
  //   有快取就「立刻」回應 → 開啟瞬間完成，不必等伺服器（避免冷啟動卡好幾秒）；
  //   同時背景抓最新存回快取，下次開就是新版。版本由 CACHE 常數控管，部署時 bump 即更新。
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetching = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetching;   // 有快取就秒回，沒有才等網路
      })
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
