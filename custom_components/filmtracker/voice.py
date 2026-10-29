"""Sprachbefehle (Assist) für Filmtracker – antwortet immer für die sprechende Person."""
from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import intent

from .const import DOMAIN


def async_setup_intents(hass: HomeAssistant) -> None:
    for handler in (TipIntent(), NewEpisodesIntent(), WatchlistIntent()):
        intent.async_register(hass, handler)


class _Base(intent.IntentHandler):
    platforms = None

    def _who(self, intent_obj: intent.Intent):
        ft = intent_obj.hass.data.get(DOMAIN)
        if ft is None:
            raise intent.IntentHandleError("Filmtracker ist nicht geladen")
        uid = intent_obj.context.user_id
        if not uid or uid not in ft.names:
            uid = ft.owner_id
        return ft, uid

    @staticmethod
    def _say(intent_obj: intent.Intent, text: str) -> intent.IntentResponse:
        resp = intent_obj.create_response()
        resp.async_set_speech(text)
        return resp


class TipIntent(_Base):
    intent_type = "FilmtrackerTipp"
    description = "Schlägt einen Film oder eine Serie aus den eigenen Filmtracker-Listen vor"

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        ft, uid = self._who(intent_obj)
        return self._say(intent_obj, ft.voice_tip(uid))


class NewEpisodesIntent(_Base):
    intent_type = "FilmtrackerNeueFolgen"
    description = "Sagt, bei welchen laufenden Serien es neue Folgen gibt"

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        ft, uid = self._who(intent_obj)
        _, attrs = ft.sensor_value(uid, "new")
        shows = attrs.get("serien") or []
        if not shows:
            return self._say(intent_obj, "Bei deinen Serien gibt es gerade keine neuen Folgen.")
        return self._say(intent_obj, "Neue Folgen gibt es bei " + ft.join_de(shows[:5]) + ".")


class WatchlistIntent(_Base):
    intent_type = "FilmtrackerWatchlist"
    description = "Setzt einen Film oder eine Serie auf die eigene Watchlist"
    slot_schema = {"titel": intent.non_empty_string}

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        ft, uid = self._who(intent_obj)
        title = intent_obj.slots["titel"]["value"]
        return self._say(intent_obj, await ft.voice_add(uid, title))
