// Minimalny service worker wymagany dla beforeinstallprompt (patrz pułapka
// #2 w pwa-install-gate.js). Handler "fetch" musi istnieć, nawet pusty —
// sama jego obecność wystarcza do spełnienia kryterium instalowalności
// Chrome. Świadomie bez cache'owania — dorzuć własną logikę offline tylko
// jeśli faktycznie jej potrzebujesz.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
