<p align="center"><img src="custom_components/filmtracker/brand/logo@2x.png" alt="Filmtracker" width="420"></p>

# Filmtracker für Home Assistant

Film- und Serien-Tracker als Home-Assistant-Integration – pro Person, mit Teilen im Haushalt.

## Funktionen
- **TMDb-Suche**, Listen: Watchlist, Wunschliste, Läuft, Gesehen, Bewertung mit 1–5 Sternen (auch halbe)
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
[![In HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=fredax07&repository=filmtracker&category=integration)

1. HACS → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/fredax07/filmtracker`, Typ **Integration**
2. „Filmtracker“ herunterladen und Home Assistant neu starten
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Filmtracker**

Das Panel erscheint danach in der Seitenleiste als **Filmtracker**.

## Einrichtung
Alle Zugangsdaten trägst du in der Integration ein, beim Hinzufügen oder später unter **Filmtracker → ⚙ Konfigurieren**:

| Feld | Pflicht | Woher |
|---|---|---|
| TMDb API-Key (v3) | ✅ | Kostenlos: [themoviedb.org → Einstellungen → API](https://www.themoviedb.org/settings/api) |
| KI primär / Fallback | – | Jede `ai_task`-Entität, z. B. Ollama, OpenAI oder Google Gemini |
| Trakt Client-ID + Secret | – | [trakt.tv → Neue App](https://trakt.tv/oauth/applications/new), Redirect-URI: `urn:ietf:wg:oauth:2.0:oob` |
| Uhrzeit täglicher Check | – | Standard: 09:07 |

Gespeicherte Keys werden nie angezeigt. Lässt du ein Key-Feld leer, bleibt der bisherige Wert erhalten.
Ist Trakt eingerichtet, verbindet jede Person ihr eigenes Konto im Panel unter ⚙.

Für Sprachbefehle nach der ersten Einrichtung einmal neu starten.

## Hinweis
This product uses the TMDB API but is not endorsed or certified by TMDB.
Verfügbarkeitsdaten von JustWatch über TMDb.
