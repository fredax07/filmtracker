"""Config Flow für Filmtracker."""
from __future__ import annotations

import asyncio
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_ABOS,
    CONF_CHECK_TIME,
    CONF_KI_FALLBACK,
    CONF_KI_PRIMARY,
    CONF_TMDB_KEY,
    CONF_TRAKT_ID,
    CONF_TRAKT_SECRET,
    DEFAULT_ABOS,
    DEFAULT_CHECK_TIME,
    DOMAIN,
    TMDB_URL,
)

PASSWORD = selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD))
TEXT = selector.TextSelector()
AI = selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task"))
LINKS = {
    "tmdb_url": "https://www.themoviedb.org/settings/api",
    "trakt_url": "https://trakt.tv/oauth/applications/new",
    "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
}


async def _validate_key(hass, key: str) -> str | None:
    session = async_get_clientsession(hass)
    try:
        async with asyncio.timeout(15):
            async with session.get(TMDB_URL + "configuration", params={"api_key": key}) as resp:
                if resp.status == 401:
                    return "invalid_auth"
                if resp.status != 200:
                    return "cannot_connect"
    except Exception:  # noqa: BLE001
        return "cannot_connect"
    return None


def _trakt_error(cid: str, secret: str) -> str | None:
    """Trakt braucht beides oder nichts."""
    return "trakt_incomplete" if bool(cid) != bool(secret) else None


class FilmtrackerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            key = user_input[CONF_TMDB_KEY].strip()
            cid = (user_input.get(CONF_TRAKT_ID) or "").strip()
            secret = (user_input.get(CONF_TRAKT_SECRET) or "").strip()
            err = await _validate_key(self.hass, key) or _trakt_error(cid, secret)
            if not err:
                options: dict[str, Any] = {CONF_ABOS: DEFAULT_ABOS, CONF_CHECK_TIME: DEFAULT_CHECK_TIME}
                for k in (CONF_KI_PRIMARY, CONF_KI_FALLBACK):
                    if user_input.get(k):
                        options[k] = user_input[k]
                if cid:
                    options[CONF_TRAKT_ID], options[CONF_TRAKT_SECRET] = cid, secret
                return self.async_create_entry(title="Filmtracker", data={CONF_TMDB_KEY: key}, options=options)
            errors["base"] = err
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_TMDB_KEY): PASSWORD,
                    vol.Optional(CONF_KI_PRIMARY): AI,
                    vol.Optional(CONF_KI_FALLBACK): AI,
                    vol.Optional(CONF_TRAKT_ID): TEXT,
                    vol.Optional(CONF_TRAKT_SECRET): PASSWORD,
                }
            ),
            errors=errors,
            description_placeholders=LINKS,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FilmtrackerOptionsFlow()


class FilmtrackerOptionsFlow(OptionsFlow):
    """Einstellungen: API-Keys, KI, Uhrzeit."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        current = dict(self.config_entry.options)
        errors: dict[str, str] = {}
        if user_input is not None:
            key = (user_input.get(CONF_TMDB_KEY) or "").strip()
            cid = (user_input.get(CONF_TRAKT_ID) or "").strip()
            # Leeres Secret-Feld = bisheriges behalten (wird nie angezeigt)
            secret = (user_input.get(CONF_TRAKT_SECRET) or "").strip() or (current.get(CONF_TRAKT_SECRET) or "" if cid else "")
            err = (await _validate_key(self.hass, key) if key else None) or _trakt_error(cid, secret)
            if not err:
                if key and key != self.config_entry.data.get(CONF_TMDB_KEY):
                    self.hass.config_entries.async_update_entry(
                        self.config_entry, data={**self.config_entry.data, CONF_TMDB_KEY: key}
                    )
                drop = (CONF_KI_PRIMARY, CONF_KI_FALLBACK, CONF_TRAKT_ID, CONF_TRAKT_SECRET)
                opts = {k: v for k, v in current.items() if k not in drop}
                for k in (CONF_KI_PRIMARY, CONF_KI_FALLBACK):
                    if user_input.get(k):
                        opts[k] = user_input[k]
                opts[CONF_CHECK_TIME] = user_input.get(CONF_CHECK_TIME) or current.get(CONF_CHECK_TIME, DEFAULT_CHECK_TIME)
                if cid:
                    opts[CONF_TRAKT_ID], opts[CONF_TRAKT_SECRET] = cid, secret
                return self.async_create_entry(data=opts)
            errors["base"] = err
        schema = vol.Schema(
            {
                vol.Optional(CONF_TMDB_KEY): PASSWORD,
                vol.Optional(CONF_KI_PRIMARY, description={"suggested_value": current.get(CONF_KI_PRIMARY)}): AI,
                vol.Optional(CONF_KI_FALLBACK, description={"suggested_value": current.get(CONF_KI_FALLBACK)}): AI,
                vol.Required(CONF_CHECK_TIME, default=current.get(CONF_CHECK_TIME, DEFAULT_CHECK_TIME)): selector.TimeSelector(),
                vol.Optional(CONF_TRAKT_ID, description={"suggested_value": current.get(CONF_TRAKT_ID)}): TEXT,
                vol.Optional(CONF_TRAKT_SECRET): PASSWORD,
            }
        )
        return self.async_show_form(
            step_id="init",
            data_schema=schema,
            errors=errors,
            description_placeholders={
                **LINKS,
                "tmdb": "✓" if self.config_entry.data.get(CONF_TMDB_KEY) else "✗",
                "trakt": "✓" if current.get(CONF_TRAKT_SECRET) else "✗",
            },
        )
