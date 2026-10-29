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
    DEFAULT_ABOS,
    DEFAULT_CHECK_TIME,
    DOMAIN,
    TMDB_URL,
)


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


class FilmtrackerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            key = user_input[CONF_TMDB_KEY].strip()
            if not (err := await _validate_key(self.hass, key)):
                return self.async_create_entry(
                    title="Filmtracker",
                    data={CONF_TMDB_KEY: key},
                    options={CONF_ABOS: DEFAULT_ABOS, CONF_CHECK_TIME: DEFAULT_CHECK_TIME},
                )
            errors["base"] = err
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_TMDB_KEY): selector.TextSelector(
                        selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
                    )
                }
            ),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FilmtrackerOptionsFlow()


class FilmtrackerOptionsFlow(OptionsFlow):
    """Optionen: KI und Uhrzeit."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        current = dict(self.config_entry.options)
        if user_input is not None:
            opts = {k: v for k, v in current.items() if k not in (CONF_KI_PRIMARY, CONF_KI_FALLBACK)}
            opts.update({k: v for k, v in user_input.items() if v not in (None, "")})
            return self.async_create_entry(data=opts)
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_KI_PRIMARY, description={"suggested_value": current.get(CONF_KI_PRIMARY)}
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task")),
                vol.Optional(
                    CONF_KI_FALLBACK, description={"suggested_value": current.get(CONF_KI_FALLBACK)}
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task")),
                vol.Required(
                    CONF_CHECK_TIME, default=current.get(CONF_CHECK_TIME, DEFAULT_CHECK_TIME)
                ): selector.TimeSelector(),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
