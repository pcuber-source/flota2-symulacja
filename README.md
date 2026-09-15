# Flota 2.0 — build testowy (tryb symulacji)

To jest wyłącznie statyczny build frontendu aplikacji kierowcy Flota 2.0,
zbudowany w trybie symulacji (`npm run build:mock` w repo głównym projektu).

- **Bez żywego backendu** — wyszukiwanie pojazdu, logowanie i zapis
  formularzy są symulowane w przeglądarce.
- **Bez prawdziwych danych floty** — żadne dane nie są wysyłane na żaden
  serwer. Zdjęcia zrobione podczas testu zostają wyłącznie na telefonie.
- Każdy formularz na końcu zapisuje wynik jako plik JSON do pobrania
  (do dalszej analizy na komputerze).
- Służy wyłącznie do testowania na prawdziwym telefonie: instalacji PWA
  (tryb standalone) i działania aparatu — patrz `CLAUDE.md` w repo głównym.

Ten folder nie zawiera kodu źródłowego ani żadnych sekretów — to sam
wynik builda, publikowany przez GitHub Pages.
