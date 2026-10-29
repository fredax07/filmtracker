// Filmtracker Karte für HA-Dashboards – zeigt immer die Daten der angemeldeten Person
(() => {
  const IMG = "https://image.tmdb.org/t/p/w154";
  const MODES = {
    next: "Weiterschauen (nächste Folgen)",
    releases: "Neue Folgen diese Woche",
    inbox: "Empfehlungen für mich",
    watchlist: "Watchlist",
    wish: "Wunschliste",
    shared: "Gemeinsame Listen",
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kOf = (d) => d.type + ":" + d.tmdb;
  let CACHE = null, CACHE_AT = 0, PENDING = null;
  const REL = {};

  async function getData(hass, force) {
    if (!force && CACHE && Date.now() - CACHE_AT < 60000) return CACHE;
    if (PENDING) return PENDING;
    PENDING = hass.callWS({ type: "filmtracker/get" }).then((r) => { CACHE = r; CACHE_AT = Date.now(); PENDING = null; return r; }, (e) => { PENDING = null; throw e; });
    return PENDING;
  }
  function nextEp(d) {
    if (d.type !== "tv" || !d.seasons) return null;
    const seen = new Set(d.eps || []);
    for (const s of Object.keys(d.seasons).map(Number).filter((n) => n > 0).sort((a, b) => a - b))
      for (let e = 1; e <= d.seasons[s]; e++) if (!seen.has(s + "x" + e)) return { s, e };
    return null;
  }
  function progress(d) {
    if (d.type !== "tv" || !d.seasons) return null;
    let tot = 0; for (const s in d.seasons) if (+s > 0) tot += d.seasons[s];
    const seen = (d.eps || []).filter((x) => !x.startsWith("0x")).length;
    return tot ? Math.min(100, Math.round((seen / tot) * 100)) : null;
  }
  function weekBounds() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); const a = d.toLocaleDateString("sv-SE"); d.setDate(d.getDate() + 6); return [a, d.toLocaleDateString("sv-SE")]; }

  class FilmtrackerCard extends HTMLElement {
    static getConfigForm() {
      return {
        schema: [
          { name: "mode", required: true, selector: { select: { mode: "dropdown", options: Object.entries(MODES).map(([value, label]) => ({ value, label })) } } },
          { name: "title", selector: { text: {} } },
          { name: "limit", selector: { number: { min: 1, max: 30, mode: "box" } } },
          { name: "layout", selector: { select: { options: [{ value: "list", label: "Liste" }, { value: "posters", label: "Poster" }] } } },
        ],
        computeLabel: (s) => ({ mode: "Anzeige", title: "Titel (optional)", limit: "Anzahl", layout: "Darstellung" }[s.name]),
      };
    }
    static getStubConfig() { return { mode: "next", limit: 5, layout: "list" }; }
    setConfig(config) {
      if (!config.mode || !MODES[config.mode]) throw new Error("mode muss eines von: " + Object.keys(MODES).join(", ") + " sein");
      this._config = Object.assign({ limit: 5, layout: "list" }, config);
      if (this._hass) this._load(true);
    }
    set hass(h) {
      const first = !this._hass; this._hass = h;
      if (first) this._load(false);
      else if (Date.now() - (this._at || 0) > 5 * 60000) this._load(true);
    }
    getCardSize() { return this._config && this._config.layout === "posters" ? 4 : 1 + Math.min(this._config ? this._config.limit : 5, 6); }
    connectedCallback() { if (this._hass && Date.now() - (this._at || 0) > 60000) this._load(true); }

    _root() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<style>
          ha-card{overflow:hidden}
          .hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px;font-size:18px}
          .hd a{font-size:12px;color:var(--primary-color);cursor:pointer;text-decoration:none}
          .bd{padding:4px 16px 12px}
          .row{display:flex;gap:10px;align-items:center;padding:6px 0;cursor:pointer;border-bottom:1px solid var(--divider-color)}
          .row:last-child{border-bottom:0}
          .row img,.ph{width:36px;height:54px;border-radius:4px;object-fit:cover;background:var(--secondary-background-color);flex:none}
          .t{font-weight:500;line-height:1.2}
          .m{font-size:12px;color:var(--secondary-text-color)}
          .bar{height:3px;background:var(--secondary-background-color);border-radius:2px;margin-top:3px;overflow:hidden}
          .bar i{display:block;height:100%;background:var(--success-color,#4caf50)}
          .grow{flex:1;min-width:0}
          .grow .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .posters{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
          .p{width:86px;flex:none;cursor:pointer}
          .p img,.p .ph{width:86px;height:129px;border-radius:6px}
          .p .t{font-size:12px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .empty{color:var(--secondary-text-color);padding:8px 0}
          .grp{font-size:12px;color:var(--secondary-text-color);margin-top:8px;font-weight:500}
        </style><ha-card><div class="hd"><span id="title"></span><a id="open">Öffnen</a></div><div class="bd" id="bd"><div class="empty">Lade…</div></div></ha-card>`;
        this.shadowRoot.getElementById("open").onclick = () => this._nav(this._config.mode === "inbox" || this._config.mode === "shared" ? "?open=" + this._config.mode : "");
      }
      return this.shadowRoot;
    }
    _nav(q) {
      history.pushState(null, "", "/filmtracker" + (q || ""));
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
    async _load(force) {
      if (!this._config || !this._hass) return;
      this._at = Date.now();
      const r = this._root(); const c = this._config;
      r.getElementById("title").textContent = c.title || MODES[c.mode];
      let data;
      try { data = await getData(this._hass, force); } catch (e) { r.getElementById("bd").innerHTML = '<div class="empty">Filmtracker nicht erreichbar.</div>'; return; }
      let rows = [];
      const items = Object.values(data.items || {});
      if (c.mode === "next") {
        rows = items.filter((d) => d.list === "running").map((d) => ({ d, n: nextEp(d), pr: progress(d) })).filter((x) => x.n)
          .sort((a, b) => (b.d.updated || "").localeCompare(a.d.updated || ""))
          .map(({ d, n, pr }) => ({ d, sub: "Weiter mit S" + n.s + "E" + n.e, pr }));
      } else if (c.mode === "watchlist" || c.mode === "wish") {
        rows = items.filter((d) => d.list === c.mode).sort((a, b) => (b.added || "").localeCompare(a.added || "")).map((d) => ({ d, sub: (d.type === "tv" ? "Serie" : "Film") + (d.year ? " · " + d.year : "") }));
      } else if (c.mode === "inbox") {
        rows = (data.inbox || []).map((x) => ({ d: x.item, sub: "von " + x.from_name + (x.note ? ": „" + x.note + "“" : "") }));
      } else if (c.mode === "shared") {
        for (const l of data.shared || []) {
          const its = Object.values(l.items).filter((i) => !i.seen);
          if (its.length) { rows.push({ group: l.name }); its.forEach((d) => rows.push({ d, sub: "von " + (d.by === data.user_id ? "dir" : d.by_name || "?") })); }
        }
      } else if (c.mode === "releases") {
        const [a, b] = weekBounds(); const mine = items.filter((d) => d.type === "tv" && ["running", "watchlist", "wish"].includes(d.list));
        const found = [];
        await Promise.all(mine.slice(0, 40).map(async (d) => {
          const k = kOf(d);
          try {
            if (!REL[k] || Date.now() - REL[k].at > 3600000) REL[k] = { at: Date.now(), x: await this._hass.callWS({ type: "filmtracker/tmdb", path: "tv/" + d.tmdb, params: {} }) };
            for (const e of [REL[k].x.last_episode_to_air, REL[k].x.next_episode_to_air]) if (e && e.air_date >= a && e.air_date <= b) found.push({ d, e });
          } catch (err) {}
        }));
        rows = found.sort((x, y) => x.e.air_date.localeCompare(y.e.air_date)).map(({ d, e }) => ({ d, sub: "S" + e.season_number + "E" + e.episode_number + " · " + new Date(e.air_date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) }));
      }
      const lim = +c.limit || 5; let n = 0;
      rows = rows.filter((x) => x.group || n++ < lim);
      const bd = r.getElementById("bd");
      if (!rows.filter((x) => !x.group).length) { bd.innerHTML = '<div class="empty">' + ({ next: "Keine Serie am Laufen.", releases: "Diese Woche keine neuen Folgen.", inbox: "Keine Empfehlungen.", shared: "Gemeinsame Listen sind leer." }[c.mode] || "Liste ist leer.") + "</div>"; return; }
      const img = (d) => (d.poster ? '<img loading="lazy" src="' + IMG + d.poster + '">' : '<div class="ph"></div>');
      if (c.layout === "posters") {
        bd.innerHTML = '<div class="posters">' + rows.filter((x) => !x.group).map((x) => '<div class="p" data-k="' + kOf(x.d) + '">' + img(x.d) + '<div class="t">' + esc(x.d.title) + '</div><div class="m">' + esc(x.sub) + "</div></div>").join("") + "</div>";
      } else {
        bd.innerHTML = rows.map((x) => x.group ? '<div class="grp">' + esc(x.group) + "</div>" : '<div class="row" data-k="' + kOf(x.d) + '">' + img(x.d) + '<div class="grow"><div class="t">' + esc(x.d.title) + '</div><div class="m">' + esc(x.sub) + "</div>" + (x.pr != null ? '<div class="bar"><i style="width:' + x.pr + '%"></i></div>' : "") + "</div></div>").join("");
      }
      bd.querySelectorAll("[data-k]").forEach((el) => (el.onclick = () => this._nav("?open=" + el.dataset.k)));
    }
  }
  if (!customElements.get("filmtracker-card")) customElements.define("filmtracker-card", FilmtrackerCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === "filmtracker-card"))
    window.customCards.push({ type: "filmtracker-card", name: "Filmtracker", description: "Weiterschauen, neue Folgen, Empfehlungen, Watchlist oder gemeinsame Listen – jeweils für die angemeldete Person.", preview: false });
})();
