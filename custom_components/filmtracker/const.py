"""Konstanten für Filmtracker."""

DOMAIN = "filmtracker"
VERSION = "1.4.2"
SIGNAL_UPDATE = "filmtracker_update"
CONF_APPS = "apps"
# TMDb-Anbieter-ID -> Android-TV-App
DEFAULT_APPS = {
    "8": "com.netflix.ninja",
    "9": "com.amazon.amazonvideo.livingroom",
    "337": "com.disney.disneyplus",
}

CONF_TMDB_KEY = "tmdb_key"
CONF_KI_PRIMARY = "ki_primary"
CONF_KI_FALLBACK = "ki_fallback"
CONF_ABOS = "abos"
CONF_CHECK_TIME = "check_time"

# Netflix, Amazon Prime Video, Disney Plus, RTL+
DEFAULT_ABOS = [8, 9, 337, 298]
DEFAULT_CHECK_TIME = "09:07:00"

PANEL_URL = "filmtracker"
STATIC_URL = "/filmtracker_static"
PANEL_JS = f"{STATIC_URL}/filmtracker-panel.js"
CARD_JS = f"{STATIC_URL}/filmtracker-card.js"
CONF_TRAKT_ID = "trakt_client_id"
CONF_TRAKT_SECRET = "trakt_client_secret"
TRAKT_URL = "https://api.trakt.tv"
TMDB_URL = "https://api.themoviedb.org/3/"
