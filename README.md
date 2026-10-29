# 🎬 Filmtracker für Home Assistant

Film- und Serien-Tracker als Home-Assistant-Integration – pro Person, mit Teilen im Haushalt.

## Funktionen
- **TMDb-Suche**, Listen: Watchlist, Wunschliste, Läuft, Gesehen, Bewertung 1–10
- **Folgen-Tracking** mit Push bei neuen Folgen, tägliche Prüfung deiner Abos (Verfügbarkeit in DE)
- **KI-Tipps** über jede `ai_task`-Entität (z. B. Ollama), mit Fallback-Modell
- **Kino & Releases der Woche**, Leih-/Kauf-Alarm wenn ein Film digital erscheint
- **Teilen**: Titel empfehlen, gemeinsame Listen, Bewertungen & Fortschritt der anderen, Abstimmung „Was schauen wir?“
- **Auf TV öffnen**: Android TV / Google TV, Fire TV (ADB oder Alexa-Cloud, auch an anderen Orten)
- **Auto-Abhaken**: nach „Auf TV öffnen“ fragt eine Push-Nachricht, ob du fertig bist
- **Trakt-Sync** in beide Richtungen (Verlauf, Bewertungen, Watchlist)
- **Sprachbefehle (Assist)**: „Was soll ich heute schauen?“, „Gibt es neue Folgen?“, „Setz Dune auf meine Watchlist“
- Sensoren & Kalender pro Person, Dashboard-Karte `custom:filmtracker-card`, Statistik & Jahresrückblick, CSV-Export, FSK-Filter

## Installation (HACS)
1. HACS → ⋮ → **Benutzerdefinierte Repositories** → URL dieses Repos, Typ **Integration**
2. „Filmtracker“ installieren, Home Assistant neu starten
3. Einstellungen → Geräte & Dienste → **Integration hinzufügen** → Filmtracker
4. TMDb-API-Key eintragen ([kostenlos hier](https://www.themoviedb.org/settings/api))
5. Nach dem ersten Start einmal neu starten, damit die Sprachbefehle aktiv werden

Das Panel erscheint in der Seitenleiste als **Filmtracker**.

## Trakt einrichten (optional)
Admin: auf [trakt.tv/oauth/applications/new](https://trakt.tv/oauth/applications/new) eine App anlegen
(Redirect-URI `urn:ietf:wg:oauth:2.0:oob`), Client-ID und Secret im ⚙-Tab eintragen.
Danach kann jede Person ihr eigenes Konto verbinden.

## Hinweis
This product uses the TMDB API but is not endorsed or certified by TMDB.
Verfügbarkeitsdaten von JustWatch über TMDb.
