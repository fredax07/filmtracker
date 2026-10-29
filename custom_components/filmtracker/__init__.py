"""Filmtracker – Film- & Serien-Tracker pro Person für Home Assistant."""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import secrets
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .voice import async_setup_intents
from .const import (
    CARD_JS,
    CONF_ABOS,
    CONF_APPS,
    CONF_TRAKT_ID,
    CONF_TRAKT_SECRET,
    DEFAULT_APPS,
    STATIC_URL,
    TRAKT_URL,
    SIGNAL_UPDATE,
    CONF_CHECK_TIME,
    CONF_KI_FALLBACK,
    CONF_KI_PRIMARY,
    CONF_TMDB_KEY,
    DEFAULT_ABOS,
    DEFAULT_CHECK_TIME,
    DOMAIN,
    PANEL_JS,
    PANEL_URL,
    TMDB_URL,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.data"
PATH_RE = re.compile(r"^[a-z0-9_/]+$")
CACHE_TTL = 6 * 3600
LISTS = ("watchlist", "wish", "running", "seen")
ACTIVE = ("watchlist", "wish", "running")
SERVER_FIELDS = ("avail", "last_ep", "rb")
PLATFORMS = ["sensor", "calendar"]
LOG_MAX = 20000
# Fire TV hat für Prime Video eine eigene App
FIRETV_APPS = {"9": "com.amazon.firebat"}
RELEASE_TYPES = {1: "Premiere", 2: "Kino (limitiert)", 3: "Kinostart", 4: "Digital", 5: "DVD/Blu-ray", 6: "TV"}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Filmtracker einrichten."""
    ft = Filmtracker(hass, entry)
    await ft.async_load()
    hass.data[DOMAIN] = ft

    def _install_sentences() -> bool:
        src = Path(__file__).parent / "custom_sentences" / "de" / "filmtracker.yaml"
        dst = Path(hass.config.path("custom_sentences", "de", "filmtracker.yaml"))
        if not src.exists() or (dst.exists() and dst.read_bytes() == src.read_bytes()):
            return False
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        return True

    if await hass.async_add_executor_job(_install_sentences):
        _LOGGER.warning("Filmtracker: Sprachbefehle installiert – nach dem nächsten Neustart aktiv")

    if not hass.data.get(f"{DOMAIN}_ws"):
        for cmd in (
            ws_get,
            ws_items_save,
            ws_item_remove,
            ws_user_save,
            ws_settings_save,
            ws_tmdb,
            ws_ai,
            ws_check,
            ws_social,
            ws_recommend,
            ws_inbox_remove,
            ws_shared_save,
            ws_shared_delete,
            ws_shared_items,
            ws_shared_remove,
            ws_play,
            ws_poll,
            ws_certs,
            ws_household,
            ws_abocheck,
            ws_admin_user,
            ws_trakt_config,
            ws_trakt_start,
            ws_trakt_sync,
            ws_trakt_disconnect,
        ):
            websocket_api.async_register_command(hass, cmd)
        hass.data[f"{DOMAIN}_ws"] = True
        async_setup_intents(hass)

    if not hass.data.get(f"{DOMAIN}_static"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)]
        )
        hass.data[f"{DOMAIN}_static"] = True

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name="filmtracker-panel",
        sidebar_title="Filme & Serien",
        sidebar_icon="mdi:movie-open-play",
        module_url=f"{PANEL_JS}?v={VERSION}",
        require_admin=False,
        config={},
    )
    frontend.add_extra_js_url(hass, f"{CARD_JS}?v={VERSION}")

    async def _check_now(call: ServiceCall) -> None:
        await ft.async_daily_check()

    hass.services.async_register(DOMAIN, "check_now", _check_now)

    ft.schedule()
    entry.async_on_unload(ft.unschedule)
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    @callback
    def _meta_tick(_now=None) -> None:
        hass.async_create_background_task(ft.async_refresh_meta(), "filmtracker_meta")

    entry.async_on_unload(async_track_time_interval(hass, _meta_tick, timedelta(hours=6)))
    if hass.state is CoreState.running:
        _meta_tick()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _meta_tick)

    @callback
    def _session_tick(_now=None) -> None:
        ft.tick_sessions()

    entry.async_on_unload(async_track_time_interval(hass, _session_tick, timedelta(seconds=60)))

    @callback
    def _trakt_tick(_now=None) -> None:
        hass.async_create_background_task(ft.async_trakt_sync_all(), "filmtracker_trakt")

    entry.async_on_unload(async_track_time_interval(hass, _trakt_tick, timedelta(hours=6)))

    async def _notify_action(event) -> None:
        await ft.async_handle_action(str(event.data.get("action") or ""))

    entry.async_on_unload(hass.bus.async_listen("mobile_app_notification_action", _notify_action))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Filmtracker entladen."""
    await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    frontend.async_remove_panel(hass, PANEL_URL)
    frontend.remove_extra_js_url(hass, f"{CARD_JS}?v={VERSION}")
    hass.services.async_remove(DOMAIN, "check_now")
    ft: Filmtracker | None = hass.data.pop(DOMAIN, None)
    if ft:
        await ft.store.async_save(ft.data)
    return True


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ft: Filmtracker | None = hass.data.get(DOMAIN)
    if ft:
        ft.schedule()


def _progress(d: dict[str, Any]) -> int | None:
    if d.get("type") != "tv" or not d.get("seasons"):
        return None
    try:
        total = sum(int(v) for k, v in d["seasons"].items() if int(k) > 0)
    except (TypeError, ValueError):
        return None
    seen = len([e for e in d.get("eps") or [] if not str(e).startswith("0x")])
    return min(100, round(seen / total * 100)) if total else None


def _next_ep(d: dict[str, Any]) -> str | None:
    if d.get("type") != "tv" or not d.get("seasons"):
        return None
    seen = set(d.get("eps") or [])
    try:
        seasons = {int(k): int(v) for k, v in d["seasons"].items()}
    except (TypeError, ValueError, AttributeError):
        return None
    for s in sorted(k for k in seasons if k > 0):
        for e in range(1, seasons[s] + 1):
            if f"{s}x{e}" not in seen:
                return f"S{s}E{e}"
    return None


class Filmtracker:
    """Daten und Logik."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, Any] = {"users": {}, "shared": {}}
        self.names: dict[str, str] = {}
        self.meta: dict[str, dict[str, Any]] = {}
        self.pnames: dict[int, str] = {}
        self.owner_id: str | None = None
        self._cache: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()
        self._unsub = None
        self.sessions: dict[str, dict[str, Any]] = {}
        self._trakt_pending: dict[str, asyncio.Task] = {}

    # ---------- Grundlagen ----------
    @property
    def opts(self) -> dict[str, Any]:
        return dict(self.entry.options)

    async def async_load(self) -> None:
        stored = await self.store.async_load()
        if isinstance(stored, dict):
            self.data = stored
        self.data.setdefault("users", {})
        self.data.setdefault("shared", {})
        await self.async_refresh_names()

    async def async_refresh_names(self) -> None:
        users = await self.hass.auth.async_get_users()
        active = {u.id: u.name or "?" for u in users if not u.system_generated and u.is_active}
        persons = {
            st.attributes.get("user_id"): st.name
            for st in self.hass.states.async_all("person")
            if st.attributes.get("user_id") in active
        }
        self.names = persons or active
        owner = next((u.id for u in users if u.is_owner), None)
        self.owner_id = owner if owner in self.names else next(iter(self.names), None)

    def save(self) -> None:
        self.store.async_delay_save(lambda: self.data, 2)
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    def tv_devices(self) -> list[dict[str, str]]:
        """Android-TV-Fernbedienungen und Fire TV (ADB-Integration)."""
        out = [
            {"id": s.entity_id, "name": s.name, "kind": "remote"}
            for s in self.hass.states.async_all("remote")
            if s.state != "unavailable"
        ]
        reg = er.async_get(self.hass)
        for ent in reg.entities.values():
            if ent.platform == "androidtv" and ent.domain == "media_player":
                st = self.hass.states.get(ent.entity_id)
                if st and st.state != "unavailable":
                    out.append({"id": ent.entity_id, "name": st.name, "kind": "firetv"})
        # Fire TV über die Alexa-Devices-Integration (Cloud – funktioniert an jedem Ort)
        dreg = dr.async_get(self.hass)
        for entry in self.hass.config_entries.async_entries("alexa_devices"):
            for dev in dr.async_entries_for_config_entry(dreg, entry.entry_id):
                if dev.disabled_by:
                    continue
                label = f"{dev.model or ''} {dev.name or ''}".lower()
                if "fire" in label and "tv" in label:
                    out.append({"id": f"alexa:{dev.id}", "name": dev.name_by_user or dev.name or "Fire TV", "kind": "alexa"})
        return out

    def apps(self) -> dict[str, str]:
        apps = dict(DEFAULT_APPS)
        apps.update(self.opts.get(CONF_APPS) or {})
        return {k: v for k, v in apps.items() if v}

    # ---------- Termine / Sensoren ----------
    def _meta_keys(self) -> set[str]:
        keys: set[str] = set()
        for u in self.data["users"].values():
            for k, d in (u.get("items") or {}).items():
                if d.get("type") == "tv" and d.get("list") in ACTIVE:
                    keys.add(k)
                elif d.get("type") == "movie" and d.get("list") in ("watchlist", "wish"):
                    keys.add(k)
        return keys

    async def async_refresh_meta(self, keys: set[str] | None = None) -> None:
        keys = self._meta_keys() if keys is None else keys
        await self.async_load_pnames()
        for k in keys:
            typ, _, tid = k.partition(":")
            try:
                if typ == "tv":
                    x = await self.tmdb(f"tv/{tid}")
                    m: dict[str, Any] = {"status": x.get("status")}
                    for field, name in (("next_episode_to_air", "next"), ("last_episode_to_air", "last")):
                        e = x.get(field)
                        if e and e.get("air_date"):
                            m[name] = {
                                "date": e["air_date"],
                                "s": e.get("season_number"),
                                "e": e.get("episode_number"),
                                "name": e.get("name") or "",
                            }
                else:
                    x = await self.tmdb(f"movie/{tid}", {"append_to_response": "release_dates"})
                    de = next(
                        (r for r in (x.get("release_dates") or {}).get("results", []) if r.get("iso_3166_1") == "DE"),
                        None,
                    )
                    m = {
                        "release": x.get("release_date"),
                        "releases": [
                            {"date": rd["release_date"][:10], "type": rd.get("type")}
                            for rd in (de or {}).get("release_dates", [])
                            if rd.get("release_date")
                        ],
                    }
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Filmtracker Meta %s: %s", k, err)
                continue
            self.meta[k] = m
            await asyncio.sleep(0.05)
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    async def async_load_pnames(self) -> None:
        if self.pnames:
            return
        for kind in ("movie", "tv"):
            try:
                r = await self.tmdb(f"watch/providers/{kind}", {"watch_region": "DE"})
            except Exception:  # noqa: BLE001
                continue
            for p in r.get("results") or []:
                self.pnames[int(p["provider_id"])] = p["provider_name"]

    # ---------- Sprache ----------
    @staticmethod
    def join_de(parts: list[str]) -> str:
        parts = [p for p in parts if p]
        return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " und " + parts[-1]

    def voice_tip(self, uid: str | None) -> str:
        u = self.data["users"].get(uid or "") or {}
        items = u.get("items") or {}
        abos = set(self.abos_for(u)) if u else set()
        tips: list[str] = []
        running = [d for d in items.values() if d.get("type") == "tv" and d.get("list") == "running" and _next_ep(d)]
        running.sort(key=lambda d: d.get("updated") or "", reverse=True)
        if running:
            d = running[0]
            code = _next_ep(d) or ""
            s, _, e = code[1:].partition("E")
            tips.append(f"Bei {d.get('title')} geht es weiter mit Staffel {s}, Folge {e}.")
        avail = [d for d in items.values() if d.get("list") in ("watchlist", "wish") and set(d.get("avail") or []) & abos]
        if avail:
            d = random.choice(avail)
            where = self.join_de([self.pnames.get(i, "") for i in d.get("avail") or [] if i in abos][:2])
            kind = "der Serie" if d.get("type") == "tv" else "dem Film"
            tips.append(f"{'Oder w' if tips else 'W'}ie wäre es mit {kind} {d.get('title')}" + (f", läuft bei {where}." if where else "."))
        if not tips:
            wl = [d for d in items.values() if d.get("list") in ("watchlist", "wish")]
            if wl:
                d = random.choice(wl)
                tips.append(f"Von deiner Watchlist: {d.get('title')}.")
        return " ".join(tips) or "Deine Listen sind noch leer. Füg im Filmtracker ein paar Titel hinzu."

    async def voice_add(self, uid: str | None, title: str) -> str:
        if not uid:
            return "Ich weiß nicht, für wen ich das merken soll."
        try:
            r = await self.tmdb("search/multi", {"query": title, "include_adult": "false"})
        except Exception:  # noqa: BLE001
            return "Ich komme gerade nicht an die Filmdatenbank."
        x = next((z for z in r.get("results") or [] if z.get("media_type") in ("movie", "tv")), None)
        if not x:
            return f"Ich habe nichts zu {title} gefunden."
        typ = x["media_type"]
        key = f"{typ}:{x['id']}"
        u = self.user(uid)
        name = x.get("title") or x.get("name")
        year = str(x.get("release_date") or x.get("first_air_date") or "")[:4]
        if key in u["items"] and u["items"][key].get("list"):
            return f"{name} ist schon auf deiner Liste."
        u["items"][key] = {
            "tmdb": x["id"], "type": typ, "title": name, "year": year, "poster": x.get("poster_path"),
            "vote": round(x["vote_average"], 1) if x.get("vote_average") else None, "genres": [],
            "list": "watchlist", "rating": None, "eps": [], "seasons": None,
            "added": dt_util.now().date().isoformat(), "updated": dt_util.now().isoformat(),
        }
        self.save()
        self.hass.async_create_background_task(self.async_refresh_meta({key}), "filmtracker_meta_voice")
        kind = "Die Serie" if typ == "tv" else "Der Film"
        return f"{kind} {name}{f' von {year}' if year else ''} ist jetzt auf deiner Watchlist."

    # ---------- FSK ----------
    async def cert(self, key: str) -> int | None:
        typ, _, tid = key.partition(":")
        try:
            if typ == "movie":
                r = await self.tmdb(f"movie/{tid}/release_dates")
                for c in r.get("results") or []:
                    if c.get("iso_3166_1") == "DE":
                        for rd in c.get("release_dates") or []:
                            m = re.search(r"\d+", rd.get("certification") or "")
                            if m:
                                return int(m.group())
            else:
                r = await self.tmdb(f"tv/{tid}/content_ratings")
                for c in r.get("results") or []:
                    if c.get("iso_3166_1") == "DE":
                        m = re.search(r"\d+", c.get("rating") or "")
                        if m:
                            return int(m.group())
        except Exception:  # noqa: BLE001
            return None
        return None

    # ---------- Haushalt-Statistik ----------
    def household(self, me: str) -> dict[str, Any]:
        year = str(dt_util.now().year)
        people = []
        agg: dict[str, dict[str, Any]] = {}
        for uid, name in self.names.items():
            u = self.data["users"].get(uid) or {}
            if uid != me and not u.get("share", True):
                continue
            items = u.get("items") or {}
            log = [x for x in u.get("log") or [] if str(x.get("d", "")).startswith(year)]
            genres: dict[str, int] = {}
            for x in log:
                for g in (items.get(x.get("k")) or {}).get("genres") or []:
                    genres[g] = genres.get(g, 0) + 1
            rated = [d["rating"] for d in items.values() if d.get("rating")]
            people.append({
                "name": name, "me": uid == me,
                "eps": sum(1 for x in log if x.get("e")),
                "movies": sum(1 for x in log if not x.get("e")),
                "hours": round(sum(int(x.get("m") or 0) for x in log) / 60),
                "genre": max(genres, key=genres.get) if genres else None,
                "avg": round(sum(rated) / len(rated), 1) if rated else None,
            })
            for k, d in items.items():
                if not (d.get("rating") or d.get("list") in ("seen", "running")):
                    continue
                a = agg.setdefault(k, {"key": k, "title": d.get("title"), "type": d.get("type"), "poster": d.get("poster"), "tmdb": d.get("tmdb"), "who": [], "ratings": []})
                a["who"].append(name)
                if d.get("rating"):
                    a["ratings"].append(d["rating"])
        top = [a for a in agg.values() if len(a["who"]) >= 2]
        for a in top:
            a["avg"] = round(sum(a["ratings"]) / len(a["ratings"]), 1) if a["ratings"] else None
        top.sort(key=lambda a: (len(a["who"]), a["avg"] or 0), reverse=True)
        people.sort(key=lambda p: p["eps"] + p["movies"], reverse=True)
        return {"year": year, "people": people, "top": top[:8]}

    def event_data(self, uid: str) -> list[dict[str, Any]]:
        items = (self.data["users"].get(uid) or {}).get("items") or {}
        out: list[dict[str, Any]] = []
        for k, d in items.items():
            m = self.meta.get(k)
            if not m:
                continue
            if d.get("type") == "tv" and d.get("list") in ACTIVE:
                for name in ("last", "next"):
                    e = m.get(name)
                    if e:
                        out.append({
                            "date": e["date"], "kind": "ep", "key": k,
                            "summary": f"📺 {d.get('title')} S{e['s']}E{e['e']}",
                            "description": e.get("name") or "",
                        })
            elif d.get("type") == "movie" and d.get("list") in ("watchlist", "wish"):
                done = set()
                for r in m.get("releases") or []:
                    if r.get("type") in (3, 4) and (r["date"], r["type"]) not in done:
                        done.add((r["date"], r["type"]))
                        out.append({
                            "date": r["date"], "kind": "movie", "key": k,
                            "summary": f"🎬 {d.get('title')} – {RELEASE_TYPES[r['type']]}",
                            "description": "",
                        })
                if not done and m.get("release"):
                    out.append({"date": m["release"], "kind": "movie", "key": k, "summary": f"🎬 {d.get('title')} – Release", "description": ""})
        uniq = {(e["date"], e["summary"]): e for e in out}
        return sorted(uniq.values(), key=lambda e: e["date"])

    def sensor_value(self, uid: str, kind: str) -> tuple[Any, dict[str, Any]]:
        u = self.data["users"].get(uid) or {}
        items = u.get("items") or {}
        today = dt_util.now().date()
        if kind == "new":
            out = []
            for k, d in items.items():
                if d.get("type") != "tv" or d.get("list") != "running":
                    continue
                last = (self.meta.get(k) or {}).get("last")
                if last and last.get("s") and f"{last['s']}x{last['e']}" not in set(d.get("eps") or []):
                    out.append(f"{d.get('title')} S{last['s']}E{last['e']}")
            return len(out), {"serien": out}
        if kind == "watchlist":
            titles = [d.get("title") for d in items.values() if d.get("list") in ("watchlist", "wish")]
            return len(titles), {"titel": titles[:30]}
        if kind == "inbox":
            ib = u.get("inbox") or []
            return len(ib), {"empfehlungen": [f"{r['item'].get('title')} (von {r.get('from_name')})" for r in ib[:20]]}
        if kind == "next":
            evs = [e for e in self.event_data(uid) if e["kind"] == "ep" and e["date"] >= today.isoformat()]
            if not evs:
                return None, {}
            e = evs[0]
            return dt_util.start_of_local_day(date.fromisoformat(e["date"])), {"titel": e["summary"], "folge": e["description"]}
        if kind == "year":
            year = str(today.year)
            log = [x for x in u.get("log") or [] if str(x.get("d", "")).startswith(year)]
            eps = sum(1 for x in log if x.get("e"))
            movies = len(log) - eps
            minutes = sum(int(x.get("m") or 0) for x in log)
            return len(log), {"folgen": eps, "filme": movies, "stunden": round(minutes / 60, 1)}
        return None, {}

    def user(self, uid: str) -> dict[str, Any]:
        u = self.data["users"].setdefault(uid, {})
        u.setdefault("items", {})
        u.setdefault("dismissed", [])
        u.setdefault("abos", None)
        u.setdefault("notify", None)
        u.setdefault("push", True)
        u.setdefault("share", True)
        u.setdefault("inbox", [])
        u.setdefault("max_fsk", None)
        u.setdefault("autoask", True)
        return u

    def global_abos(self) -> list[int]:
        return [int(x) for x in self.opts.get(CONF_ABOS, DEFAULT_ABOS)]

    def abos_for(self, u: dict[str, Any]) -> list[int]:
        return u["abos"] if u.get("abos") is not None else self.global_abos()

    def ai_entities(self) -> list[str]:
        return sorted(s.entity_id for s in self.hass.states.async_all("ai_task"))

    def notify_services(self) -> list[str]:
        return sorted(
            s for s in self.hass.services.async_services().get("notify", {})
            if s.startswith("mobile_app_")
        )

    def guess_notify(self, uid: str) -> str | None:
        for st in self.hass.states.async_all("person"):
            if st.attributes.get("user_id") != uid:
                continue
            for tracker in st.attributes.get("device_trackers") or []:
                svc = "mobile_app_" + tracker.split(".", 1)[-1]
                if self.hass.services.has_service("notify", svc):
                    return svc
        return None

    async def push(self, uid: str, message: str, title: str = "Filmtracker", force: bool = False, actions: list | None = None) -> bool:
        u = self.user(uid)
        if not force and not u.get("push", True):
            return False
        target = u.get("notify") or self.guess_notify(uid)
        if not target or not self.hass.services.has_service("notify", target):
            return False
        await self.hass.services.async_call(
            "notify",
            target,
            {
                "title": title,
                "message": message,
                "data": {
                    "url": f"/{PANEL_URL}", "clickAction": f"/{PANEL_URL}", "group": "filmtracker",
                    **({"actions": actions} if actions else {}),
                },
            },
            blocking=False,
        )
        return True

    # ---------- Auto-Abhaken ----------
    def media_for(self, dev: dict[str, str]) -> str | None:
        if dev["kind"] == "firetv":
            return dev["id"]
        if dev["kind"] != "remote":
            return None
        reg = er.async_get(self.hass)
        ent = reg.async_get(dev["id"])
        if not ent or not ent.device_id:
            return None
        for e in er.async_entries_for_device(reg, ent.device_id):
            if e.domain == "media_player":
                return e.entity_id
        return None

    def start_session(self, uid: str, key: str, dev: dict[str, str], pkg: str | None) -> bool:
        u = self.user(uid)
        d = u["items"].get(key)
        if not d or not u.get("autoask", True):
            return False
        for tok, s in list(self.sessions.items()):
            if s["uid"] == uid:
                self.sessions.pop(tok)
        runtime = int(d.get("runtime") or (45 if d.get("type") == "tv" else 100))
        self.sessions[secrets.token_hex(4)] = {
            "uid": uid, "key": key, "media": self.media_for(dev), "pkg": pkg,
            "need": max(10, runtime * 0.8) * 60, "acc": 0, "start": time.monotonic(), "asked": False,
        }
        return True

    @callback
    def tick_sessions(self) -> None:
        now = time.monotonic()
        for tok, s in list(self.sessions.items()):
            if now - s["start"] > 8 * 3600:
                self.sessions.pop(tok, None)
                continue
            if s["asked"]:
                continue
            active = True
            if s["media"]:
                st = self.hass.states.get(s["media"])
                app = (st.attributes.get("app_id") or st.attributes.get("app_name") or "") if st else ""
                active = bool(st) and (st.state == "playing" or (st.state == "on" and (not s["pkg"] or app == s["pkg"])))
            if active:
                s["acc"] += 60
            if s["acc"] >= s["need"]:
                s["asked"] = True
                self.hass.async_create_background_task(self._ask(tok, s), "filmtracker_ask")

    def _what(self, uid: str, key: str) -> tuple[dict[str, Any] | None, str]:
        d = (self.data["users"].get(uid) or {}).get("items", {}).get(key)
        if not d:
            return None, ""
        if d.get("type") == "tv":
            code = _next_ep(d)
            return d, f"{d.get('title')} {code}" if code else d.get("title", "")
        return d, d.get("title", "")

    async def _ask(self, tok: str, s: dict[str, Any]) -> None:
        d, what = self._what(s["uid"], s["key"])
        if not d:
            return
        sent = await self.push(
            s["uid"], f"Hast du {what} zu Ende geschaut?", title="Filmtracker", force=True,
            actions=[{"action": f"FT_SEEN_{tok}", "title": "✓ Ja, abhaken"}, {"action": f"FT_NO_{tok}", "title": "Noch nicht"}],
        )
        if not sent:
            self.sessions.pop(tok, None)

    async def async_handle_action(self, action: str) -> None:
        if not action.startswith("FT_"):
            return
        kind, _, tok = action[3:].partition("_")
        s = self.sessions.pop(tok, None)
        if not s or kind != "SEEN":
            return
        self.mark_seen(s["uid"], s["key"])

    def mark_seen(self, uid: str, key: str) -> str | None:
        u = self.user(uid)
        d = u["items"].get(key)
        if not d:
            return None
        today = dt_util.now().date().isoformat()
        log = u.setdefault("log", [])
        minutes = int(d.get("runtime") or 0)
        if d.get("type") == "tv":
            code = _next_ep(d)
            if not code:
                return None
            s, _, e = code[1:].partition("E")
            ep = f"{s}x{e}"
            d["eps"] = sorted(set(d.get("eps") or []) | {ep})
            if d.get("list") != "running":
                d["list"] = "running"
            log.append({"k": key, "e": ep, "d": today, "m": minutes})
            done = code
        else:
            if d.get("list") != "seen":
                log.append({"k": key, "e": None, "d": today, "m": minutes})
            d["list"] = "seen"
            d.setdefault("watched", today)
            done = d.get("title")
        d["updated"] = dt_util.now().isoformat()
        self.save()
        return done

    # ---------- Trakt ----------
    def trakt_conf(self) -> tuple[str | None, str | None]:
        o = self.opts
        return o.get(CONF_TRAKT_ID), o.get(CONF_TRAKT_SECRET)

    async def _trakt_raw(self, method: str, path: str, body: Any = None, token: str | None = None) -> tuple[int, Any]:
        cid, _ = self.trakt_conf()
        headers = {
            "Content-Type": "application/json", "trakt-api-version": "2",
            "trakt-api-key": cid or "", "User-Agent": f"HomeAssistant-Filmtracker/{VERSION}",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        session = async_get_clientsession(self.hass)
        async with asyncio.timeout(30):
            async with session.request(method, TRAKT_URL + path, json=body, headers=headers) as resp:
                try:
                    data = await resp.json(content_type=None)
                except Exception:  # noqa: BLE001
                    data = None
                return resp.status, data

    async def _trakt_token(self, uid: str) -> str:
        t = self.user(uid).get("trakt") or {}
        if not t.get("access"):
            raise HomeAssistantError("Nicht mit Trakt verbunden")
        if t.get("expires", 0) - time.time() < 86400:
            cid, secret = self.trakt_conf()
            status, data = await self._trakt_raw("POST", "/oauth/token", {
                "refresh_token": t["refresh"], "client_id": cid, "client_secret": secret,
                "redirect_uri": "urn:ietf:wg:oauth:2.0:oob", "grant_type": "refresh_token",
            })
            if status != 200 or not data:
                raise HomeAssistantError("Trakt-Anmeldung abgelaufen – bitte neu verbinden")
            t.update(access=data["access_token"], refresh=data["refresh_token"], expires=data["created_at"] + data["expires_in"])
            self.save()
        return t["access"]

    async def trakt(self, method: str, path: str, uid: str, body: Any = None) -> Any:
        status, data = await self._trakt_raw(method, path, body, await self._trakt_token(uid))
        if status >= 400:
            raise HomeAssistantError(f"Trakt {status}")
        return data

    async def async_trakt_start(self, uid: str) -> dict[str, Any]:
        cid, secret = self.trakt_conf()
        if not cid or not secret:
            raise HomeAssistantError("Trakt ist noch nicht eingerichtet (Client-ID fehlt)")
        status, data = await self._trakt_raw("POST", "/oauth/device/code", {"client_id": cid})
        if status != 200 or not data:
            raise HomeAssistantError(f"Trakt antwortet nicht ({status})")
        if (old := self._trakt_pending.pop(uid, None)) and not old.done():
            old.cancel()
        self._trakt_pending[uid] = self.hass.async_create_background_task(
            self._trakt_poll(uid, data["device_code"], int(data.get("interval", 5)), int(data.get("expires_in", 600))),
            "filmtracker_trakt_login",
        )
        return {"code": data["user_code"], "url": data["verification_url"]}

    async def _trakt_poll(self, uid: str, code: str, interval: int, expires: int) -> None:
        cid, secret = self.trakt_conf()
        end = time.monotonic() + expires
        while time.monotonic() < end:
            await asyncio.sleep(interval)
            status, data = await self._trakt_raw("POST", "/oauth/device/token", {"code": code, "client_id": cid, "client_secret": secret})
            if status == 200 and data:
                u = self.user(uid)
                u["trakt"] = {
                    "access": data["access_token"], "refresh": data["refresh_token"],
                    "expires": data["created_at"] + data["expires_in"], "pushed": 0, "last_sync": None,
                }
                self.save()
                try:
                    await self.async_trakt_sync(uid)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Filmtracker Trakt-Erstsync: %s", err)
                return
            if status == 429:
                interval += 1
            elif status in (404, 409, 410, 418):
                return

    async def async_trakt_sync_all(self) -> None:
        for uid, u in list(self.data["users"].items()):
            if (u.get("trakt") or {}).get("access"):
                try:
                    await self.async_trakt_sync(uid)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Filmtracker Trakt-Sync %s: %s", self.names.get(uid, uid), err)

    async def async_trakt_sync(self, uid: str) -> dict[str, int]:
        u = self.user(uid)
        items = u["items"]
        today = dt_util.now().date().isoformat()
        stats = {"neu": 0, "folgen": 0, "bewertungen": 0, "hochgeladen": 0}
        new_keys: set[str] = set()

        def ensure(typ: str, obj: dict, lst: str) -> dict | None:
            tid = (obj.get("ids") or {}).get("tmdb")
            if not tid:
                return None
            key = f"{typ}:{tid}"
            d = items.get(key)
            if not d:
                d = items[key] = {
                    "tmdb": int(tid), "type": typ, "title": obj.get("title"), "year": str(obj.get("year") or ""),
                    "poster": None, "vote": None, "genres": [], "list": lst, "rating": None, "eps": [],
                    "seasons": None, "added": today, "from_trakt": True,
                }
                new_keys.add(key)
                stats["neu"] += 1
            elif not d.get("list"):
                d["list"] = lst
            return d

        # --- Import ---
        for row in await self.trakt("GET", "/sync/watched/movies", uid) or []:
            if (d := ensure("movie", row.get("movie") or {}, "seen")) is not None:
                d["list"] = "seen"
        for row in await self.trakt("GET", "/sync/watched/shows", uid) or []:
            d = ensure("tv", row.get("show") or {}, "running")
            if d is None:
                continue
            eps = set(d.get("eps") or [])
            before = len(eps)
            for season in row.get("seasons") or []:
                for ep in season.get("episodes") or []:
                    eps.add(f"{season['number']}x{ep['number']}")
            d["eps"] = sorted(eps)
            stats["folgen"] += len(eps) - before
            if d.get("list") in (None, "watchlist", "wish"):
                d["list"] = "running"
        trakt_ratings: dict[str, int] = {}
        for typ, kind in (("movies", "movie"), ("shows", "tv")):
            for row in await self.trakt("GET", f"/sync/ratings/{typ}", uid) or []:
                obj = row.get(kind if kind == "movie" else "show") or {}
                tid = (obj.get("ids") or {}).get("tmdb")
                if not tid:
                    continue
                key = f"{kind}:{tid}"
                trakt_ratings[key] = row.get("rating")
                d = items.get(key) or ensure(kind, obj, "seen")
                if d is not None and not d.get("rating") and row.get("rating"):
                    d["rating"] = int(row["rating"])
                    stats["bewertungen"] += 1
        trakt_watch: set[str] = set()
        for row in await self.trakt("GET", "/sync/watchlist", uid) or []:
            kind = "movie" if row.get("type") == "movie" else "tv" if row.get("type") == "show" else None
            if not kind:
                continue
            obj = row.get("movie" if kind == "movie" else "show") or {}
            tid = (obj.get("ids") or {}).get("tmdb")
            if tid:
                trakt_watch.add(f"{kind}:{tid}")
                ensure(kind, obj, "watchlist")

        # --- Export ---
        t = u["trakt"]
        log = u.get("log") or []
        pending = log[t.get("pushed", 0):]
        movies, shows = [], {}
        for x in pending:
            typ, _, tid = str(x.get("k", "")).partition(":")
            if not tid.isdigit():
                continue
            when = f"{x.get('d')}T20:00:00.000Z"
            if typ == "movie":
                movies.append({"ids": {"tmdb": int(tid)}, "watched_at": when})
            elif x.get("e"):
                s, _, e = str(x["e"]).partition("x")
                if s.isdigit() and e.isdigit():
                    shows.setdefault(tid, {}).setdefault(int(s), []).append({"number": int(e), "watched_at": when})
        if movies or shows:
            await self.trakt("POST", "/sync/history", uid, {
                "movies": movies,
                "shows": [
                    {"ids": {"tmdb": int(tid)}, "seasons": [{"number": s, "episodes": eps} for s, eps in seasons.items()]}
                    for tid, seasons in shows.items()
                ],
            })
            stats["hochgeladen"] += len(pending)
        t["pushed"] = len(log)
        out_r = {"movies": [], "shows": []}
        for key, d in items.items():
            if d.get("rating") and trakt_ratings.get(key) != d["rating"]:
                typ, _, tid = key.partition(":")
                out_r["movies" if typ == "movie" else "shows"].append({"ids": {"tmdb": int(tid)}, "rating": int(d["rating"])})
        if out_r["movies"] or out_r["shows"]:
            await self.trakt("POST", "/sync/ratings", uid, out_r)
        out_w = {"movies": [], "shows": []}
        for key, d in items.items():
            if d.get("list") in ("watchlist", "wish") and key not in trakt_watch:
                typ, _, tid = key.partition(":")
                out_w["movies" if typ == "movie" else "shows"].append({"ids": {"tmdb": int(tid)}})
        if out_w["movies"] or out_w["shows"]:
            await self.trakt("POST", "/sync/watchlist", uid, out_w)
        t["last_sync"] = dt_util.now().isoformat()
        self.save()

        # Poster, Titel, Staffeln für neue Titel nachladen
        sem = asyncio.Semaphore(4)

        async def fill(key: str) -> None:
            typ, _, tid = key.partition(":")
            async with sem:
                try:
                    x = await self.tmdb(f"{typ}/{tid}")
                except Exception:  # noqa: BLE001
                    return
            d = items.get(key)
            if not d:
                return
            d.update(
                title=x.get("title") or x.get("name") or d.get("title"),
                poster=x.get("poster_path"), genres=[g["name"] for g in x.get("genres") or []],
                vote=round(x["vote_average"], 1) if x.get("vote_average") else None,
                runtime=x.get("runtime") or (x.get("episode_run_time") or [None])[0],
            )
            if typ == "tv":
                d["seasons"] = {str(s["season_number"]): s["episode_count"] for s in x.get("seasons") or [] if s.get("episode_count")}
                if not _next_ep(d) and x.get("status") in ("Ended", "Canceled"):
                    d["list"] = "seen"

        fill_keys = new_keys | {k for k, d in items.items() if d.get("from_trakt") and not d.get("poster")}
        await asyncio.gather(*(fill(k) for k in list(fill_keys)[:300]))
        self.save()
        if new_keys:
            self.hass.async_create_background_task(self.async_refresh_meta(new_keys), "filmtracker_meta_trakt")
        return stats

    # ---------- Haushalt ----------
    def status_of(self, uid: str, key: str, me: str | None = None) -> dict[str, Any] | None:
        u = self.data["users"].get(uid) or {}
        if uid != me and not u.get("share", True):
            return None
        d = (u.get("items") or {}).get(key)
        if not d:
            return None
        return {
            "uid": uid,
            "name": self.names.get(uid, "?"),
            "me": uid == me,
            "list": d.get("list"),
            "rating": d.get("rating"),
            "progress": _progress(d),
            "next": _next_ep(d),
        }

    def social(self, key: str, uids: list[str] | None, me: str) -> list[dict[str, Any]]:
        out = []
        for uid in uids if uids is not None else list(self.data["users"]):
            if uid not in self.names:
                continue
            st = self.status_of(uid, key, me)
            if st:
                out.append(st)
        return out

    def shared_for(self, uid: str) -> list[dict[str, Any]]:
        out = []
        for sl in self.data["shared"].values():
            if uid not in sl.get("members", []):
                continue
            items = sl.get("items", {})
            out.append(
                {
                    "id": sl["id"],
                    "name": sl["name"],
                    "owner": sl.get("owner"),
                    "members": [{"id": m, "name": self.names.get(m, "?")} for m in sl["members"]],
                    "items": items,
                    "status": {k: self.social(k, sl["members"], uid) for k in items},
                    "poll": sl.get("poll"),
                }
            )
        return sorted(out, key=lambda s: s["name"].lower())

    async def async_payload(self, connection) -> dict[str, Any]:
        await self.async_refresh_names()
        uid = connection.user.id
        u = self.user(uid)
        o = self.opts
        return {
            "user_id": uid,
            "user_name": connection.user.name,
            "is_admin": connection.user.is_admin,
            "items": u["items"],
            "dismissed": u["dismissed"],
            "abos": self.abos_for(u),
            "own_abos": u.get("abos") is not None,
            "notify": u.get("notify"),
            "notify_guess": self.guess_notify(uid),
            "push": u.get("push", True),
            "share": u.get("share", True),
            "inbox": u.get("inbox", []),
            "log": u.get("log", []),
            "remotes": self.tv_devices(),
            "apps": self.apps(),
            "max_fsk": u.get("max_fsk"),
            "autoask": u.get("autoask", True),
            "trakt": {
                "configured": all(self.trakt_conf()),
                "connected": bool((u.get("trakt") or {}).get("access")),
                "last_sync": (u.get("trakt") or {}).get("last_sync"),
            },
            "people_fsk": (
                {k: (self.data["users"].get(k) or {}).get("max_fsk") for k in self.names}
                if connection.user.is_admin else {}
            ),
            "people": sorted(
                ({"id": k, "name": v} for k, v in self.names.items() if k != uid),
                key=lambda p: p["name"].lower(),
            ),
            "shared": self.shared_for(uid),
            "notify_services": self.notify_services(),
            "ai_entities": self.ai_entities(),
            "ai_names": {
                e: (self.hass.states.get(e).name if self.hass.states.get(e) else e)
                for e in self.ai_entities()
            },
            "settings": {
                "ki_primary": o.get(CONF_KI_PRIMARY),
                "ki_fallback": o.get(CONF_KI_FALLBACK),
                "abos": self.global_abos(),
                "check_time": o.get(CONF_CHECK_TIME, DEFAULT_CHECK_TIME),
            },
        }

    # ---------- Zeitplan ----------
    @callback
    def schedule(self) -> None:
        self.unschedule()
        parts = str(self.opts.get(CONF_CHECK_TIME) or DEFAULT_CHECK_TIME).split(":")
        try:
            hour, minute = int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            hour, minute = 9, 7
        self._unsub = async_track_time_change(
            self.hass, self._tick, hour=hour, minute=minute, second=0
        )

    @callback
    def unschedule(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    @callback
    def _tick(self, _now) -> None:
        self.hass.async_create_background_task(
            self.async_daily_check(), "filmtracker_daily_check"
        )

    # ---------- TMDb ----------
    async def tmdb(self, path: str, params: dict[str, Any] | None = None, cache: bool = True) -> Any:
        if not PATH_RE.match(path) or ".." in path:
            raise HomeAssistantError("Ungültiger TMDb-Pfad")
        query = {"language": "de-DE"}
        query.update({k: str(v) for k, v in (params or {}).items()})
        ckey = path + "?" + "&".join(f"{k}={query[k]}" for k in sorted(query))
        now = time.monotonic()
        if cache and ckey in self._cache and self._cache[ckey][0] > now:
            return self._cache[ckey][1]
        query["api_key"] = self.entry.data[CONF_TMDB_KEY]
        session = async_get_clientsession(self.hass)
        try:
            async with asyncio.timeout(20):
                async with session.get(TMDB_URL + path, params=query) as resp:
                    if resp.status != 200:
                        raise HomeAssistantError(f"TMDb {resp.status}")
                    result = await resp.json()
        except TimeoutError as err:
            raise HomeAssistantError("TMDb Zeitüberschreitung") from err
        if cache:
            if len(self._cache) > 3000:
                self._cache.clear()
            self._cache[ckey] = (now + CACHE_TTL, result)
        return result

    # ---------- KI ----------
    async def ai(self, instructions: str) -> dict[str, str]:
        o = self.opts
        order = [e for e in (o.get(CONF_KI_PRIMARY), o.get(CONF_KI_FALLBACK)) if e]
        order = list(dict.fromkeys(order)) or self.ai_entities()[:1]
        if not order:
            raise HomeAssistantError("Keine KI eingestellt")
        errors: list[str] = []
        for entity in order:
            try:
                async with asyncio.timeout(300):
                    res = await self.hass.services.async_call(
                        "ai_task",
                        "generate_data",
                        {"task_name": "Filmtracker", "instructions": instructions, "entity_id": entity},
                        blocking=True,
                        return_response=True,
                    )
                data = (res or {}).get("data")
                if data in (None, ""):
                    raise HomeAssistantError("leere Antwort")
                text = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
                return {"text": text, "model": entity}
            except Exception as err:  # noqa: BLE001 - nächste KI versuchen
                _LOGGER.warning("Filmtracker KI %s fehlgeschlagen: %s", entity, err)
                errors.append(f"{entity}: {err or type(err).__name__}")
        raise HomeAssistantError(" | ".join(errors))

    # ---------- Täglicher Check ----------
    async def async_daily_check(self, only_uid: str | None = None) -> dict[str, int]:
        result: dict[str, int] = {}
        async with self._lock:
            today = dt_util.now().date().isoformat()
            for uid, u in list(self.data["users"].items()):
                if only_uid and uid != only_uid:
                    continue
                abos = set(self.abos_for(u))
                msgs: list[str] = []
                for d in list(u.get("items", {}).values()):
                    if d.get("list") not in ACTIVE:
                        continue
                    try:
                        if d["list"] in ("watchlist", "wish"):
                            prov = await self.tmdb(f"{d['type']}/{d['tmdb']}/watch/providers", cache=False)
                            flat = [
                                p for p in (((prov.get("results") or {}).get("DE") or {}).get("flatrate") or [])
                                if p.get("provider_id") in abos
                            ]
                            ids = sorted({p["provider_id"] for p in flat})
                            if "avail" in d:
                                new = [p["provider_name"] for p in flat if p["provider_id"] not in d["avail"]]
                                if new:
                                    msgs.append(f"🍿 {d['title']} jetzt bei {', '.join(new)}")
                            d["avail"] = ids
                            de = (prov.get("results") or {}).get("DE") or {}
                            rb_prov = {p["provider_id"]: p["provider_name"] for p in (de.get("rent") or []) + (de.get("buy") or [])}
                            if d["type"] == "movie" and "rb" in d and not d["rb"] and rb_prov:
                                msgs.append(f"🎟 {d['title']} jetzt zum Leihen/Kaufen: {', '.join(list(rb_prov.values())[:3])}")
                            d["rb"] = sorted(rb_prov)
                        if d.get("type") == "tv":
                            show = await self.tmdb(f"tv/{d['tmdb']}", cache=False)
                            seasons = {
                                str(s["season_number"]): s["episode_count"]
                                for s in show.get("seasons") or []
                                if s.get("episode_count")
                            }
                            if seasons:
                                d["seasons"] = seasons
                            last = show.get("last_episode_to_air") or {}
                            if last.get("air_date") and last["air_date"] <= today:
                                code = f"S{last['season_number']}E{last['episode_number']}"
                                if d.get("last_ep") and d["last_ep"] != code:
                                    msgs.append(f"📺 {d['title']} {code} ist da: „{last.get('name', '')}“")
                                d["last_ep"] = code
                    except Exception as err:  # noqa: BLE001
                        _LOGGER.debug("Filmtracker Check %s: %s", d.get("title"), err)
                self.save()
                if msgs:
                    text = "\n".join(msgs[:12])
                    if len(msgs) > 12:
                        text += f"\n… und {len(msgs) - 12} weitere"
                    await self.push(uid, text)
                result[uid] = len(msgs)
        return result


# ---------- WebSocket-API ----------
def _ft(hass: HomeAssistant, connection, msg) -> Filmtracker | None:
    ft = hass.data.get(DOMAIN)
    if ft is None:
        connection.send_error(msg["id"], "not_loaded", "Filmtracker ist nicht geladen")
    return ft


def _clean_item(raw: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("type") not in ("movie", "tv"):
        raise vol.Invalid("type")
    item = dict(raw)
    item["tmdb"] = int(item["tmdb"])
    if item.get("list") not in (*LISTS, None):
        item["list"] = None
    if len(json.dumps(item)) > 30000:
        raise vol.Invalid("zu groß")
    return item


def _brief(item: dict[str, Any]) -> dict[str, Any]:
    """Nur die Stammdaten eines Titels (für Teilen)."""
    keep = ("tmdb", "type", "title", "year", "poster", "vote", "genres")
    return {k: item.get(k) for k in keep}


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/get"})
@websocket_api.async_response
async def ws_get(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/items/save",
        vol.Required("items"): vol.All(list, vol.Length(max=1000)),
        vol.Optional("nolog", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_items_save(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    u = ft.user(connection.user.id)
    log = u.setdefault("log", [])
    today = dt_util.now().date().isoformat()
    saved = 0
    new_keys: set[str] = set()
    for raw in msg["items"]:
        try:
            item = _clean_item(raw)
        except (vol.Invalid, KeyError, TypeError, ValueError):
            continue
        key = f"{item['type']}:{item['tmdb']}"
        old = u["items"].get(key) or {}
        for f in SERVER_FIELDS:
            if f in old and f not in item:
                item[f] = old[f]
        if not msg["nolog"]:
            minutes = int(item.get("runtime") or 0)
            old_eps, new_eps = set(old.get("eps") or []), set(item.get("eps") or [])
            for ep in sorted(new_eps - old_eps):
                log.append({"k": key, "e": ep, "d": today, "m": minutes})
            gone = old_eps - new_eps
            if gone:
                u["log"] = log = [x for x in log if not (x.get("k") == key and x.get("e") in gone)]
            if item["type"] == "movie" and item.get("list") == "seen" and old.get("list") != "seen":
                log.append({"k": key, "e": None, "d": today, "m": minutes})
        if key not in ft.meta:
            new_keys.add(key)
        u["items"][key] = item
        saved += 1
    if len(log) > LOG_MAX:
        u["log"] = log[-LOG_MAX:]
    ft.save()
    if new_keys:
        hass.async_create_background_task(ft.async_refresh_meta(new_keys), "filmtracker_meta_new")
    connection.send_result(msg["id"], {"saved": saved})


@websocket_api.websocket_command(
    {vol.Required("type"): "filmtracker/items/remove", vol.Required("key"): str}
)
@websocket_api.async_response
async def ws_item_remove(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    ft.user(connection.user.id)["items"].pop(msg["key"], None)
    ft.save()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/user/save",
        vol.Optional("abos"): vol.Any(None, [vol.Coerce(int)]),
        vol.Optional("notify"): vol.Any(None, str),
        vol.Optional("push"): bool,
        vol.Optional("share"): bool,
        vol.Optional("autoask"): bool,
        vol.Optional("dismissed"): vol.All([str], vol.Length(max=2000)),
    }
)
@websocket_api.async_response
async def ws_user_save(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    u = ft.user(connection.user.id)
    if "abos" in msg:
        u["abos"] = msg["abos"]
    if "notify" in msg:
        u["notify"] = msg["notify"] or None
    for key in ("push", "share", "autoask"):
        if key in msg:
            u[key] = msg[key]
    if "dismissed" in msg:
        u["dismissed"] = msg["dismissed"][-1000:]
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/settings/save",
        vol.Optional(CONF_KI_PRIMARY): vol.Any(None, str),
        vol.Optional(CONF_KI_FALLBACK): vol.Any(None, str),
        vol.Optional(CONF_ABOS): [vol.Coerce(int)],
        vol.Optional(CONF_CHECK_TIME): str,
        vol.Optional(CONF_APPS): {str: str},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_settings_save(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    opts = ft.opts
    for key in (CONF_KI_PRIMARY, CONF_KI_FALLBACK, CONF_ABOS, CONF_CHECK_TIME, CONF_APPS):
        if key in msg:
            if msg[key] in (None, ""):
                opts.pop(key, None)
            else:
                opts[key] = msg[key]
    hass.config_entries.async_update_entry(ft.entry, options=opts)
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/tmdb",
        vol.Required("path"): str,
        vol.Optional("params"): {str: vol.Any(str, int, float)},
    }
)
@websocket_api.async_response
async def ws_tmdb(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    try:
        res = await ft.tmdb(msg["path"], msg.get("params"))
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "tmdb_error", str(err))
        return
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "tmdb_error", f"TMDb nicht erreichbar: {err}")
        return
    connection.send_result(msg["id"], res)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/ai",
        vol.Required("instructions"): vol.All(str, vol.Length(max=30000)),
    }
)
@websocket_api.async_response
async def ws_ai(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    try:
        res = await ft.ai(msg["instructions"])
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "ai_error", str(err))
        return
    connection.send_result(msg["id"], res)


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/check"})
@websocket_api.async_response
async def ws_check(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    res = await ft.async_daily_check(only_uid=connection.user.id)
    connection.send_result(msg["id"], {"messages": res.get(connection.user.id, 0)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/play",
        vol.Required("remote"): str,
        vol.Required("provider"): vol.Coerce(int),
        vol.Optional("title"): vol.All(str, vol.Length(max=150)),
        vol.Optional("key"): str,
    }
)
@websocket_api.async_response
async def ws_play(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    remote = msg["remote"]
    dev = next((d for d in ft.tv_devices() if d["id"] == remote), None)
    if not dev:
        connection.send_error(msg["id"], "no_remote", "Fernseher nicht gefunden")
        return
    if dev["kind"] == "alexa":
        await ft.async_load_pnames()
        pname = ft.pnames.get(int(msg["provider"]), "")
        pname = {"Amazon Prime Video": "Prime Video", "Disney Plus": "Disney Plus", "RTL+": "RTL Plus"}.get(pname, pname)
        title = (msg.get("title") or "").strip()
        command = f"Spiele {title} auf {pname}" if title else f"Öffne {pname}"
        try:
            await hass.services.async_call(
                "alexa_devices", "send_text_command",
                {"device_id": remote.split(":", 1)[1], "text_command": command},
                blocking=True, context=connection.context(msg),
            )
        except Exception as err:  # noqa: BLE001
            connection.send_error(msg["id"], "play_error", str(err))
            return
        asked = ft.start_session(connection.user.id, msg.get("key") or "", dev, None)
        connection.send_result(msg["id"], {"ok": True, "command": command, "ask": asked})
        return
    pkg = ft.apps().get(str(msg["provider"]))
    if dev["kind"] == "firetv":
        pkg = FIRETV_APPS.get(str(msg["provider"]), pkg)
    if not pkg:
        connection.send_error(msg["id"], "no_app", "Für diesen Anbieter ist keine TV-App hinterlegt")
        return
    try:
        if dev["kind"] == "firetv":
            await hass.services.async_call(
                "media_player", "select_source", {"entity_id": remote, "source": pkg}, blocking=True, context=connection.context(msg)
            )
        else:
            await hass.services.async_call(
                "remote", "turn_on", {"entity_id": remote, "activity": pkg}, blocking=True, context=connection.context(msg)
            )
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "play_error", str(err))
        return
    asked = ft.start_session(connection.user.id, msg.get("key") or "", dev, pkg)
    connection.send_result(msg["id"], {"ok": True, "app": pkg, "ask": asked})


# ---------- Teilen ----------
@websocket_api.websocket_command({vol.Required("type"): "filmtracker/social", vol.Required("key"): str})
@websocket_api.async_response
async def ws_social(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    me = connection.user.id
    others = [s for s in ft.social(msg["key"], None, me) if not s["me"]]
    connection.send_result(msg["id"], {"people": others})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/recommend",
        vol.Required("to"): vol.All([str], vol.Length(min=1, max=20)),
        vol.Required("item"): dict,
        vol.Optional("note", default=""): vol.All(str, vol.Length(max=300)),
    }
)
@websocket_api.async_response
async def ws_recommend(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    try:
        item = _brief(_clean_item(msg["item"]))
    except (vol.Invalid, KeyError, TypeError, ValueError):
        connection.send_error(msg["id"], "invalid", "Ungültiger Titel")
        return
    me = connection.user.id
    sender = connection.user.name or "Jemand"
    key = f"{item['type']}:{item['tmdb']}"
    sent = 0
    for uid in msg["to"]:
        if uid == me or uid not in ft.names:
            continue
        u = ft.user(uid)
        u["inbox"] = [r for r in u["inbox"] if not (r["key"] == key and r["from"] == me)]
        u["inbox"].insert(
            0,
            {"key": key, "item": item, "from": me, "from_name": sender, "note": msg["note"], "at": dt_util.now().isoformat()},
        )
        u["inbox"] = u["inbox"][:100]
        note = f" – „{msg['note']}“" if msg["note"] else ""
        await ft.push(uid, f"👉 {sender} empfiehlt dir {item['title']}{note}", title="Filmtracker-Tipp")
        sent += 1
    ft.save()
    connection.send_result(msg["id"], {"sent": sent})


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/inbox/remove", vol.Required("key"): str})
@websocket_api.async_response
async def ws_inbox_remove(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    u = ft.user(connection.user.id)
    u["inbox"] = [r for r in u["inbox"] if r["key"] != msg["key"]]
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/shared/save",
        vol.Optional("id"): str,
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
        vol.Required("members"): vol.All([str], vol.Length(max=20)),
    }
)
@websocket_api.async_response
async def ws_shared_save(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    me = connection.user.id
    members = [m for m in dict.fromkeys(msg["members"]) if m in ft.names]
    sid = msg.get("id")
    if sid:
        sl = ft.data["shared"].get(sid)
        if not sl or me not in sl["members"]:
            connection.send_error(msg["id"], "not_found", "Liste nicht gefunden")
            return
        new = [m for m in members if m not in sl["members"]]
        sl["name"] = msg["name"]
        sl["members"] = members
    else:
        if me not in members:
            members.insert(0, me)
        sid = secrets.token_hex(4)
        sl = {"id": sid, "name": msg["name"], "owner": me, "members": members, "items": {}}
        ft.data["shared"][sid] = sl
        new = [m for m in members if m != me]
    if not sl["members"]:
        ft.data["shared"].pop(sid, None)
    sender = connection.user.name or "Jemand"
    for uid in new:
        if uid != me:
            await ft.push(uid, f"👥 {sender} hat dich zur Liste „{sl['name']}“ hinzugefügt")
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/shared/delete", vol.Required("id"): str})
@websocket_api.async_response
async def ws_shared_delete(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    sl = ft.data["shared"].get(msg["id"])
    me = connection.user.id
    if not sl or (sl.get("owner") != me and not connection.user.is_admin):
        connection.send_error(msg["id"], "unauthorized", "Nur der Ersteller kann die Liste löschen")
        return
    ft.data["shared"].pop(msg["id"], None)
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/shared/items",
        vol.Required("id"): str,
        vol.Required("items"): vol.All(list, vol.Length(max=500)),
    }
)
@websocket_api.async_response
async def ws_shared_items(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    sl = ft.data["shared"].get(msg["id"])
    me = connection.user.id
    if not sl or me not in sl["members"]:
        connection.send_error(msg["id"], "not_found", "Liste nicht gefunden")
        return
    for raw in msg["items"]:
        try:
            item = _brief(_clean_item(raw))
        except (vol.Invalid, KeyError, TypeError, ValueError):
            continue
        key = f"{item['type']}:{item['tmdb']}"
        old = sl["items"].get(key) or {}
        item["by"] = old.get("by", me)
        item["by_name"] = old.get("by_name", connection.user.name)
        item["added"] = old.get("added", dt_util.now().date().isoformat())
        item["seen"] = bool(raw.get("seen", old.get("seen", False)))
        sl["items"][key] = item
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {vol.Required("type"): "filmtracker/shared/remove", vol.Required("id"): str, vol.Required("key"): str}
)
@websocket_api.async_response
async def ws_shared_remove(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    sl = ft.data["shared"].get(msg["id"])
    if not sl or connection.user.id not in sl["members"]:
        connection.send_error(msg["id"], "not_found", "Liste nicht gefunden")
        return
    sl["items"].pop(msg["key"], None)
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


# ---------- Paket 2 ----------
def _poll_winner(sl: dict[str, Any]) -> str | None:
    poll = sl.get("poll") or {}
    counts: dict[str, int] = {k: 0 for k in poll.get("options", [])}
    for k in (poll.get("votes") or {}).values():
        if k in counts:
            counts[k] += 1
    if not counts:
        return None
    return max(poll["options"], key=lambda k: counts[k])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/poll",
        vol.Required("id"): str,
        vol.Required("action"): vol.In(["start", "vote", "end", "clear"]),
        vol.Optional("key"): str,
    }
)
@websocket_api.async_response
async def ws_poll(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    me = connection.user.id
    sender = connection.user.name or "Jemand"
    sl = ft.data["shared"].get(msg["id"])
    if not sl or me not in sl["members"]:
        connection.send_error(msg["id"], "not_found", "Liste nicht gefunden")
        return
    action = msg["action"]
    poll = sl.get("poll")
    if action == "start":
        cand = [(k, it) for k, it in sl["items"].items() if not it.get("seen")]
        if len(cand) < 2:
            connection.send_error(msg["id"], "too_few", "Für eine Abstimmung braucht die Liste mindestens 2 ungesehene Titel")
            return

        def score(entry):
            k, it = entry
            s = float(it.get("vote") or 5)
            for m in sl["members"]:
                d = ((ft.data["users"].get(m) or {}).get("items") or {}).get(k) or {}
                if d.get("list") in ("watchlist", "wish"):
                    s += 1.5
                if d.get("list") == "seen":
                    s -= 3
            return s + random.random()

        cand.sort(key=score, reverse=True)
        sl["poll"] = {"options": [k for k, _ in cand[:3]], "votes": {}, "by": me, "by_name": sender, "at": dt_util.now().isoformat(), "open": True, "winner": None}
        for m in sl["members"]:
            if m != me:
                await ft.push(m, f"🗳 {sender} hat eine Filmabend-Abstimmung in „{sl['name']}“ gestartet – stimm ab!")
    elif not poll:
        connection.send_error(msg["id"], "no_poll", "Keine Abstimmung aktiv")
        return
    elif action == "vote":
        if not poll.get("open") or msg.get("key") not in poll["options"]:
            connection.send_error(msg["id"], "invalid", "Abstimmung ist beendet oder Titel ungültig")
            return
        poll["votes"][me] = msg["key"]
        if all(m in poll["votes"] for m in sl["members"]):
            action = "end"
    if action == "end" and poll and poll.get("open"):
        poll["open"] = False
        poll["winner"] = _poll_winner(sl)
        title = (sl["items"].get(poll["winner"]) or {}).get("title", "?")
        for m in sl["members"]:
            await ft.push(m, f"🍿 Filmabend „{sl['name']}“: Gewonnen hat {title}!")
    if action == "clear":
        sl.pop("poll", None)
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command(
    {vol.Required("type"): "filmtracker/certs", vol.Required("keys"): vol.All([str], vol.Length(max=60))}
)
@websocket_api.async_response
async def ws_certs(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    keys = list(dict.fromkeys(msg["keys"]))
    sem = asyncio.Semaphore(6)

    async def one(k):
        async with sem:
            return k, await ft.cert(k)

    res = await asyncio.gather(*(one(k) for k in keys))
    connection.send_result(msg["id"], dict(res))


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/household"})
@websocket_api.async_response
async def ws_household(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    await ft.async_refresh_names()
    connection.send_result(msg["id"], ft.household(connection.user.id))


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/abocheck"})
@websocket_api.async_response
async def ws_abocheck(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    await ft.async_load_pnames()
    u = ft.user(connection.user.id)
    mine = set(ft.abos_for(u))
    todo = [d for d in u["items"].values() if d.get("list") in ACTIVE]
    counts: dict[int, list[str]] = {}
    sem = asyncio.Semaphore(6)

    async def one(d):
        async with sem:
            try:
                r = await ft.tmdb(f"{d['type']}/{d['tmdb']}/watch/providers")
            except Exception:  # noqa: BLE001
                return
            for p in (((r.get("results") or {}).get("DE") or {}).get("flatrate") or []):
                counts.setdefault(int(p["provider_id"]), []).append(d.get("title"))

    await asyncio.gather(*(one(d) for d in todo))
    rows = []
    for pid in set(counts) | mine:
        titles = counts.get(pid, [])
        if pid not in mine and len(titles) < 2:
            continue
        rows.append({"id": pid, "name": ft.pnames.get(pid, f"Anbieter {pid}"), "count": len(titles), "titles": titles[:6], "mine": pid in mine})
    rows.sort(key=lambda r: (not r["mine"], -r["count"]))
    connection.send_result(msg["id"], {"total": len(todo), "rows": rows})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/admin/user",
        vol.Required("uid"): str,
        vol.Optional("max_fsk"): vol.Any(None, vol.In([0, 6, 12, 16, 18])),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_admin_user(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    if msg["uid"] not in ft.names:
        connection.send_error(msg["id"], "not_found", "Person nicht gefunden")
        return
    u = ft.user(msg["uid"])
    if "max_fsk" in msg:
        u["max_fsk"] = msg["max_fsk"]
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))


# ---------- Trakt ----------
@websocket_api.websocket_command(
    {
        vol.Required("type"): "filmtracker/trakt/config",
        vol.Required("client_id"): vol.All(str, vol.Length(max=200)),
        vol.Required("client_secret"): vol.All(str, vol.Length(max=200)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_trakt_config(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    opts = ft.opts
    opts[CONF_TRAKT_ID] = msg["client_id"].strip()
    opts[CONF_TRAKT_SECRET] = msg["client_secret"].strip()
    hass.config_entries.async_update_entry(ft.entry, options=opts)
    connection.send_result(msg["id"], await ft.async_payload(connection))


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/trakt/start"})
@websocket_api.async_response
async def ws_trakt_start(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    try:
        res = await ft.async_trakt_start(connection.user.id)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "trakt_error", str(err))
        return
    connection.send_result(msg["id"], res)


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/trakt/sync"})
@websocket_api.async_response
async def ws_trakt_sync(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    try:
        res = await ft.async_trakt_sync(connection.user.id)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "trakt_error", str(err))
        return
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "trakt_error", f"Trakt-Fehler: {err}")
        return
    connection.send_result(msg["id"], res)


@websocket_api.websocket_command({vol.Required("type"): "filmtracker/trakt/disconnect"})
@websocket_api.async_response
async def ws_trakt_disconnect(hass, connection, msg):
    if not (ft := _ft(hass, connection, msg)):
        return
    ft.user(connection.user.id).pop("trakt", None)
    ft.save()
    connection.send_result(msg["id"], await ft.async_payload(connection))
