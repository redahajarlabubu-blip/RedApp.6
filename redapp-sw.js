/* RedApp service worker — notification display and click routing.
   Push delivery still requires a configured push provider and subscribed devices. */
"use strict";

const DEFAULT_APP_PATH = "./app.html";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function safeAppUrl(value) {
  try {
    const url = new URL(value || DEFAULT_APP_PATH, self.location.origin);
    return url.origin === self.location.origin ? url.href : new URL(DEFAULT_APP_PATH, self.location.origin).href;
  } catch {
    return new URL(DEFAULT_APP_PATH, self.location.origin).href;
  }
}

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try { payload = { body: event.data ? event.data.text() : "" }; } catch {}
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const isCall = payload.type === "call" || data.type === "call";
  const title = String(payload.title || (isCall ? "Incoming RedApp call" : "RedApp notification")).slice(0, 100);
  const options = {
    body: String(payload.body || (isCall ? "Someone is calling you. Tap to open RedApp." : "You have a new notification.")).slice(0, 240),
    tag: String(payload.tag || (isCall ? "redapp-incoming-call" : "redapp-notification")).slice(0, 100),
    renotify: true,
    requireInteraction: isCall,
    data: {
      url: safeAppUrl(data.url || payload.url),
      chatId: typeof data.chatId === "string" ? data.chatId.slice(0, 100) : "",
      callId: typeof data.callId === "string" ? data.callId.slice(0, 100) : "",
      type: isCall ? "call" : "message"
    }
  };

  if (payload.icon) options.icon = safeAppUrl(payload.icon);
  if (payload.badge) options.badge = safeAppUrl(payload.badge);
  if (isCall) options.vibrate = [350, 150, 350, 150, 500];

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = safeAppUrl(data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ("focus" in client) {
        await client.focus();
        if (data.chatId || data.callId) {
          client.postMessage({
            open: data.chatId || undefined,
            call: data.callId || undefined,
            type: data.type || "message"
          });
        }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
