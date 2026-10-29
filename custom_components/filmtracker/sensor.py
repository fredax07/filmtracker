"""Sensoren pro Person für Filmtracker."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_UPDATE

KINDS: dict[str, tuple[str, str, SensorDeviceClass | None]] = {
    "new": ("Neue Folgen", "mdi:television-play", None),
    "watchlist": ("Watchlist", "mdi:playlist-play", None),
    "inbox": ("Empfehlungen", "mdi:inbox-arrow-down", None),
    "next": ("Nächste Folge", "mdi:calendar-clock", SensorDeviceClass.TIMESTAMP),
    "year": ("Gesehen dieses Jahr", "mdi:counter", None),
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    ft = hass.data[DOMAIN]

    async def _add() -> None:
        await ft.async_refresh_names()
        async_add_entities(
            FilmtrackerSensor(ft, uid, name, kind) for uid, name in ft.names.items() for kind in KINDS
        )

    if hass.state is CoreState.running:
        await _add()
    else:
        @callback
        def _started(_event) -> None:
            hass.async_create_task(_add())

        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)


class FilmtrackerSensor(SensorEntity):
    """Ein Wert pro Person."""

    _attr_should_poll = False

    def __init__(self, ft, uid: str, person: str, kind: str) -> None:
        self.ft = ft
        self.uid = uid
        self.kind = kind
        label, icon, device_class = KINDS[kind]
        self._attr_name = f"Filmtracker {person} {label}"
        self._attr_unique_id = f"filmtracker_{uid}_{kind}"
        self._attr_icon = icon
        self._attr_device_class = device_class
        if device_class is None:
            self._attr_state_class = SensorStateClass.MEASUREMENT
        self._attr_extra_state_attributes: dict[str, Any] = {}

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self._update))
        self._compute()

    @callback
    def _update(self) -> None:
        self._compute()
        self.async_write_ha_state()

    def _compute(self) -> None:
        value, attrs = self.ft.sensor_value(self.uid, self.kind)
        self._attr_native_value = value
        self._attr_extra_state_attributes = attrs
