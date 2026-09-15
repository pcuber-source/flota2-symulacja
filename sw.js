// Minimalny service worker — wymagany przez Chrome, żeby PWA było w pełni
// "installable". Świadomie bez cache'owania na razie, żeby w terenie nikt
// nie dostał nieaktualnej wersji aplikacji.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
