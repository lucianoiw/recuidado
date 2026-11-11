// Service worker: receives dose reminders and opens the patient screen.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Hora do remédio";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Toque para confirmar que tomou.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.doseId || "dose",
      requireInteraction: true,
      data: { url: data.url || "/patient" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
