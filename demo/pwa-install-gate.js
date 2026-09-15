// pwa-install-gate.js — uniwersalny mechanizm wykrywania i wymuszania
// instalacji PWA jako aplikacji standalone (identycznie na iOS, Androidzie
// i desktopie). Wyodrębnione i sprawdzone na żywym urządzeniu w projekcie
// Flota 2.0. Zero zależności od frameworka — wywołuj te funkcje z dowolnego
// miejsca (React effect, Vue lifecycle hook, zwykły <script>).
//
// TRZY PUŁAPKI, które kosztowały długie debugowanie — nie pomijaj ich:
//
// 1. Manifest jako `data:` URI wygląda poprawnie (parsuje się, ikony się
//    ładują), ale REALNIE NIE odpala zdarzenia beforeinstallprompt w Chrome.
//    Zawsze używaj prawdziwego endpointu HTTP (tryb "server", zalecane gdy
//    backend istnieje) albo Blob URL (tryb "blob", fallback bez backendu).
//    Nigdy data:.
//
// 2. beforeinstallprompt wymaga AKTYWNEGO service workera z zarejestrowanym
//    listenerem "fetch" — nawet pustym. To inny, ostrzejszy wymóg niż ręczna
//    instalacja z menu przeglądarki (⋮ → "Zainstaluj aplikację"), która tego
//    już nie wymaga od Chrome 108+/112+. Zarejestruj service-worker.js
//    (przykład w tym samym folderze) zanim spodziewasz się eventu.
//
// 3. Chrome NIE odpala beforeinstallprompt od razu po wejściu na stronę —
//    wymaga z ~30 sekund zaangażowania (czas na stronie) + co najmniej
//    jednego kliknięcia/dotknięcia. Brak eventu zaraz po wejściu to nie
//    znaczy, że coś jest zepsute — poczekaj i wejdź w interakcję ze stroną.

export function isStandalone() {
  return (
    window.navigator.standalone === true || // iOS/Safari — jedyny mechanizm jaki ma
    window.matchMedia("(display-mode: standalone)").matches // Chrome/Android/desktop
  );
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Buduje i wstrzykuje <link rel="manifest"> dopasowany do bieżącego URL-a
 * (np. jednorazowego linku rejestracyjnego). Wywołaj jak najwcześniej,
 * najlepiej w <head>, przed jakimkolwiek innym kodem aplikacji.
 *
 * @param {object} opts
 * @param {"server"|"blob"} opts.mode
 *   "server" — prawdziwy endpoint HTTP generowany przez backend (ZALECANE,
 *   gdy backend istnieje — najbardziej niezawodne, patrz pułapka #1).
 *   "blob" — w pełni frontendowe, bez backendu (fallback dla czysto
 *   statycznego hostingu, np. GitHub Pages).
 * @param {string} opts.startUrl
 *   Pełny, absolutny URL, na który ma wskazywać ikona po instalacji
 *   (np. adres z unikalnym kodem rejestracyjnym danego użytkownika).
 * @param {string} [opts.scope]
 *   Domyślnie katalog nadrzędny startUrl.
 * @param {string} opts.name
 * @param {string} [opts.shortName]
 * @param {string} [opts.themeColor]
 * @param {string} [opts.backgroundColor]
 * @param {{src:string,sizes:string,type?:string}[]} opts.icons
 *   Absolutne URL-e do ikon 192x192 i 512x512 (OBOWIĄZKOWE — bez obu tych
 *   rozmiarów strona nie przejdzie kryteriów instalowalności).
 * @param {string} [opts.serverEndpoint]
 *   Wymagane, gdy mode === "server" — pełny URL do manifestu wygenerowanego
 *   przez backend (jego start_url/id/scope wewnątrz też muszą wskazywać na
 *   startUrl, backend musi to zrobić sam).
 * @returns {HTMLLinkElement}
 */
export function injectManifest(opts) {
  const {
    mode,
    startUrl,
    scope = startUrl.replace(/[^/]*$/, ""),
    name,
    shortName = name,
    themeColor = "#000000",
    backgroundColor = themeColor,
    icons,
    serverEndpoint,
  } = opts;

  if (!icons || icons.length === 0) {
    throw new Error("injectManifest: brak icons (wymagane min. 192x192 i 512x512)");
  }

  const link = document.createElement("link");
  link.rel = "manifest";

  if (mode === "server") {
    if (!serverEndpoint) throw new Error("mode 'server' wymaga opts.serverEndpoint");
    link.href = serverEndpoint;
  } else if (mode === "blob") {
    const manifest = {
      id: startUrl,
      name,
      short_name: shortName,
      start_url: startUrl,
      scope,
      display: "standalone",
      background_color: backgroundColor,
      theme_color: themeColor,
      icons,
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    link.href = URL.createObjectURL(blob);
  } else {
    throw new Error(`injectManifest: nieznany mode "${mode}" (oczekiwano "server" albo "blob")`);
  }

  document.head.appendChild(link);
  return link;
}

/**
 * Rejestruje service worker pod danym URL-em — patrz pułapka #2, to jest
 * WYMAGANE dla beforeinstallprompt, nawet jeśli handler fetch nic nie robi.
 * @param {string} swUrl np. "/sw.js" albo `${import.meta.env.BASE_URL}sw.js`
 */
export function registerServiceWorker(swUrl) {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(swUrl).catch(() => null);
}

/**
 * Łapie zdarzenie beforeinstallprompt i zwraca kontroler z funkcją prompt()
 * do wywołania na kliknięcie własnego przycisku instalacji w UI (Android/
 * desktop — iOS nie ma programistycznego API, patrz isIOS() i pokaż tam
 * ręczną instrukcję "Udostępnij" → "Dodaj do ekranu głównego").
 *
 * @param {object} [callbacks]
 * @param {() => void} [callbacks.onAvailable] wywołane, gdy prompt jest gotowy do pokazania
 * @param {() => void} [callbacks.onUnavailable] wywołane po instalacji / zużyciu prompta
 */
export function createInstallController({ onAvailable, onUnavailable } = {}) {
  let deferredEvent = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredEvent = e;
    onAvailable?.();
  });

  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    onUnavailable?.();
  });

  return {
    isAvailable: () => deferredEvent !== null,
    /** @returns {Promise<{outcome: "accepted"|"dismissed", platform: string} | null>} */
    prompt: async () => {
      if (!deferredEvent) return null;
      deferredEvent.prompt();
      const choice = await deferredEvent.userChoice;
      deferredEvent = null;
      return choice;
    },
  };
}
