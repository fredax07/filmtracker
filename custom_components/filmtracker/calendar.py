"""Kalender pro Person: neue Folgen und Filmstarts der eigenen Listen."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, SIGNAL_UPDATE


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    ft = hass.data[DOMAIN]

    async def _add() -> None:
        await ft.async_refresh_names()
        async_add_entities(FilmtrackerCalendar(ft, uid, name) for uid, name in ft.names.items())

    if hass.state is CoreState.running:
        await _add()
    else:
        @callback
        def _started(_event) -> None:
            hass.async_create_task(_add())

        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)


def _event(e: dict) -> CalendarEvent:
    start = date.fromisoformat(e["date"])
    return CalendarEvent(start=start, end=start + timedelta(days=1), summary=e["summary"], description=e.get("description") or None)


class FilmtrackerCalendar(CalendarEntity):
    """Termine aus den Listen einer Person."""

    _attr_should_poll = False
    _attr_icon = "mdi:movie-open-play"

    def __init__(self, ft, uid: str, person: str) -> None:
        self.ft = ft
        self.uid = uid
        self._attr_name = f"Filmtracker {person}"
        self._attr_unique_id = f"filmtracker_{uid}_calendar"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self.async_write_ha_state))

    @property
    def event(self) -> CalendarEvent | None:
        today = dt_util.now().date().isoformat()
        upcoming = [e for e in self.ft.event_data(self.uid) if e["date"] >= today]
        return _event(upcoming[0]) if upcoming else None

    async def async_get_events(self, hass: HomeAssistant, start_date: datetime, end_date: datetime) -> list[CalendarEvent]:
        start, end = dt_util.as_local(start_date).date(), dt_util.as_local(end_date).date()
        out = []
        for e in self.ft.event_data(self.uid):
            d = date.fromisoformat(e["date"])
            if start <= d <= end:
                out.append(_event(e))
        return out
