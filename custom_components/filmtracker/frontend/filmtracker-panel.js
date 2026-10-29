// Filmtracker Panel – Film- & Serien-Tracker pro Person
const IMG = "https://image.tmdb.org/t/p/";
const LISTS = { watchlist: "Watchlist", wish: "Wunschliste", running: "Läuft", seen: "Gesehen" };
const OLD_TODO = "todo.filmtracker";

const CSS = `
:host{--bg:var(--primary-background-color,#111318);--card:var(--card-background-color,#1c1f26);--card2:var(--secondary-background-color,#252933);--text:var(--primary-text-color,#e8eaed);--muted:var(--secondary-text-color,#9aa0a6);--accent:var(--primary-color,#03a9f4);--line:var(--divider-color,#2c313c);--good:#4caf50;--warn:#ffb300;display:block;height:100%;background:var(--bg);color:var(--text);font:14px/1.4 var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif)}
*{box-sizing:border-box}
button,input,select,textarea{font:inherit;color:inherit}
.wrap{height:100%;overflow-y:auto}
header{position:sticky;top:0;z-index:5;background:var(--app-header-background-color,var(--bg));color:var(--app-header-text-color,var(--text));border-bottom:1px solid var(--line);padding:4px 12px 8px}
.top{display:flex;align-items:center;gap:6px;min-height:48px}
.title{font-size:20px;font-weight:400;flex:1}
.who{font-size:12px;color:var(--muted)}
.tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;white-space:nowrap;cursor:pointer;color:var(--text)}
.tab.on{background:var(--accent);border-color:var(--accent);color:#fff}
.tab .n{opacity:.8;font-size:12px;margin-left:4px}
main{padding:12px;max-width:1200px;margin:0 auto}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.grow{flex:1;min-width:160px}
input[type=text],input[type=search],select,textarea{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%}
.btn{border:1px solid var(--line);background:var(--card2);border-radius:8px;padding:7px 12px;cursor:pointer}
.btn:hover{border-color:var(--accent)}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.sm{padding:4px 8px;font-size:12px}
.btn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.btn:disabled{opacity:.5;cursor:default}
h2{font-size:16px;margin:18px 0 8px}
.muted{color:var(--muted)}
.small{font-size:12px}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:2px 16px}
.item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}
.item img,.ph{width:64px;height:96px;object-fit:cover;border-radius:6px;background:var(--card2);flex:none}
.item .t{font-weight:600;font-size:15px}
.meta{color:var(--muted);font-size:12px;margin:2px 0}
.star{color:var(--warn)}
.reason{font-style:italic;font-size:13px;margin:4px 0}
.prov{color:var(--accent);font-size:12px;font-weight:500}
.prov.other{color:var(--muted);font-weight:400}
.chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;background:var(--card2);border:1px solid var(--line);margin-right:4px}
.chip.acc{background:var(--accent);border-color:var(--accent);color:#fff}
.bar{height:4px;background:var(--card2);border-radius:2px;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;background:var(--good)}
.strip{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.poster{width:110px;flex:none;cursor:pointer}
.poster img,.poster .ph{width:110px;height:165px;border-radius:6px;object-fit:cover}
.poster .t{font-size:12px;font-weight:600;margin-top:4px;line-height:1.2}
.empty{padding:30px;text-align:center;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:16px}
.sheet{background:var(--bg);border:1px solid var(--line);border-radius:14px;max-width:820px;width:100%;overflow:hidden}
.hero{position:relative;min-height:120px;background:var(--card2) center/cover}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent,var(--bg))}
.close{position:absolute;top:8px;right:8px;z-index:2;background:rgba(0,0,0,.5);border:0;color:#fff;border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer}
.dhead{display:flex;gap:14px;padding:0 16px;margin-top:-60px;position:relative;z-index:1}
.dhead img{width:110px;height:165px;border-radius:8px;object-fit:cover;flex:none;background:var(--card2)}
.dbody{padding:12px 16px 18px}
.cast{display:flex;gap:10px;overflow-x:auto}
.cast div{width:70px;flex:none;text-align:center;font-size:11px}
.cast img,.cast .ph{width:70px;height:90px;object-fit:cover;border-radius:6px}
.stars{position:relative;display:inline-block;color:var(--line);letter-spacing:1px;line-height:1;white-space:nowrap}
.stars>span{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:var(--warn)}
.rate{display:flex;align-items:center;gap:12px}
.rate .stars{font-size:38px;cursor:pointer;user-select:none;letter-spacing:4px}
details.season{border:1px solid var(--line);border-radius:8px;margin:6px 0;background:var(--card)}
details.season summary{padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;gap:8px}
.ep{display:flex;gap:8px;align-items:flex-start;padding:6px 10px;border-top:1px solid var(--line)}
.ep input{margin-top:3px;width:18px;height:18px;flex:none}
.ep.future{opacity:.5}
.provs{display:flex;gap:6px;flex-wrap:wrap}
.provs img{width:36px;height:36px;border-radius:8px}
.provs .mine{outline:2px solid var(--accent)}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--card2);border:1px solid var(--line);padding:10px 16px;border-radius:10px;z-index:20;max-width:90%}
.grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px}
.grid2 label{display:flex;gap:8px;align-items:center;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--card);cursor:pointer}
.grid2 img{width:28px;height:28px;border-radius:6px}
.spin{display:inline-block;width:16px;height:16px;border:2px solid var(--muted);border-top-color:transparent;border-radius:50%;animation:s 1s linear infinite;vertical-align:middle}
@keyframes s{to{transform:rotate(360deg)}}
a{color:var(--accent)}
@media (max-width:600px){.list{grid-template-columns:1fr}.dhead img{width:90px;height:135px}}
`;

let H = null, ROOT = null;
const S = { tab: "search", items: {}, u: null, prov: {}, providers: null, search: { q: "", res: [] }, tips: null, week: 0, filter: "all" };

// ---------- Helfer ----------
const $ = (s) => ROOT.querySelector(s);
const $$ = (s) => ROOT.querySelectorAll(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yr = (d) => (d ? String(d).slice(0, 4) : "");
const today = () => new Date().toLocaleDateString("sv-SE");
const kOf = (type, id) => type + ":" + id;
const errMsg = (e) => (e && (e.message || e.code)) || String(e);
const ws = (msg) => H.callWS(msg);
const abos = () => (S.u && S.u.abos) || [];
function toast(t, ms) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; ROOT.appendChild(d); setTimeout(() => d.remove(), ms || 2500); }
async function pool(arr, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) { const k = i++; try { out[k] = await fn(arr[k], k); } catch (e) { out[k] = null; } } })); return out; }

// ---------- Server ----------
async function tmdb(path, params) { const p = {}; for (const k in params || {}) p[k] = String(params[k]); return ws({ type: "filmtracker/tmdb", path, params: p }); }
async function loadData() { S.u = await ws({ type: "filmtracker/get" }); S.items = S.u.items || {}; }
async function saveItems(arr, nolog) { const now = new Date().toISOString(); for (const d of arr) d.updated = now; for (let i = 0; i < arr.length; i += 100) await ws({ type: "filmtracker/items/save", items: arr.slice(i, i + 100), nolog: !!nolog }); for (const d of arr) S.items[kOf(d.type, d.tmdb)] = d; }
const saveItem = (d) => saveItems([d]);
async function removeItem(k) { await ws({ type: "filmtracker/items/remove", key: k }); delete S.items[k]; }
async function saveUser(patch) { S.u = await ws(Object.assign({ type: "filmtracker/user/save" }, patch)); S.items = S.u.items || {}; }
async function saveSettings(patch) { S.u = await ws(Object.assign({ type: "filmtracker/settings/save" }, patch)); S.items = S.u.items || {}; }
async function askAI(instructions) { return ws({ type: "filmtracker/ai", instructions }); }
async function fskFilter(arr, keyOf) {
  const max = S.u && S.u.max_fsk; if (max == null || !arr.length) return arr;
  const keys = [...new Set(arr.map(keyOf))]; const certs = {};
  for (let i = 0; i < keys.length; i += 60) Object.assign(certs, await ws({ type: "filmtracker/certs", keys: keys.slice(i, i + 60) }));
  return arr.filter((x) => { const c = certs[keyOf(x)]; return c != null && c <= max; });
}
async function wsU(msg) { S.u = await ws(msg); S.items = S.u.items || {}; return S.u; }
const brief = (d) => ({ tmdb: d.tmdb, type: d.type, title: d.title, year: d.year, poster: d.poster, vote: d.vote, genres: d.genres || [] });
function stars(r) { const v = Math.max(0, Math.min(10, +r || 0)); return '<span class="stars" title="' + rateLbl(v) + '"><span style="width:' + v * 10 + '%">★★★★★</span>★★★★★</span>'; }
function rateLbl(r) { return r ? (r / 2).toLocaleString("de-DE") + " von 5" : "nicht bewertet"; }
const LBL = { watchlist: "Watchlist", wish: "Wunschliste", running: "schaut gerade", seen: "gesehen" };
function personLine(p) {
  const bits = [];
  if (p.list) bits.push(LBL[p.list] || p.list);
  if (p.progress != null) bits.push(p.progress + " %" + (p.next ? " · bei " + p.next : " · fertig"));
  if (p.rating) bits.push(stars(p.rating));
  return "<b>" + esc(p.me ? "Du" : p.name) + "</b>: " + (bits.join(" · ") || "–");
}

async function providersFor(type, id) {
  const k = kOf(type, id); if (S.prov[k]) return S.prov[k];
  const d = await tmdb(type + "/" + id + "/watch/providers"); const de = (d.results || {}).DE || {};
  return (S.prov[k] = { flat: de.flatrate || [], rent: de.rent || [], buy: de.buy || [], link: de.link });
}
function provLine(p) {
  if (!p) return "";
  const mine = abos(); const m = p.flat.filter((x) => mine.includes(x.provider_id));
  if (m.length) return '<div class="prov">▶ ' + esc(m.map((x) => x.provider_name).join(", ")) + "</div>";
  if (p.flat.length) return '<div class="prov other">' + esc(p.flat.slice(0, 3).map((x) => x.provider_name).join(", ")) + "</div>";
  return "";
}
function baseData(type, x) {
  return { tmdb: x.id, type, title: x.title || x.name, year: yr(x.release_date || x.first_air_date), poster: x.poster_path || null, vote: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null, genres: (x.genres || []).map((g) => g.name), list: null, rating: null, eps: [], seasons: null, added: today() };
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

// ---------- Tabs ----------
function renderTabs() {
  const c = {}; for (const k in LISTS) c[k] = 0; let rated = 0;
  for (const d of Object.values(S.items)) { if (c[d.list] != null) c[d.list]++; if (d.rating) rated++; }
  const inbox = (S.u && S.u.inbox) || []; const shared = (S.u && S.u.shared) || [];
  const tabs = [["search", "🔍 Suche"], ...(inbox.length ? [["inbox", "📬 Für dich", inbox.length]] : []), ["tips", "✨ Tipps"], ["shared", "👥 Gemeinsam", shared.length], ["watchlist", "Watchlist", c.watchlist], ["wish", "Wunschliste", c.wish], ["running", "▶ Läuft", c.running], ["seen", "✓ Gesehen", c.seen], ["rated", "★ Bewertet", rated], ["releases", "📅 Releases"], ["stats", "📊 Statistik"], ["settings", "⚙"]];
  $("#tabs").innerHTML = tabs.map(([k, l, n]) => '<button class="tab' + (S.tab === k ? " on" : "") + '" data-tab="' + k + '">' + l + (n != null ? '<span class="n">' + n + "</span>" : "") + "</button>").join("");
  $$("#tabs .tab").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); }));
}
function render() {
  renderTabs(); const t = S.tab;
  $(".who").textContent = S.u ? S.u.user_name : "";
  if (t === "search") return viewSearch();
  if (t === "tips") return viewTips();
  if (t === "inbox") return viewInbox();
  if (t === "shared") return viewShared();
  if (t === "releases") return viewReleases();
  if (t === "stats") { $("#main").innerHTML = '<div class="empty"><span class="spin"></span></div>'; return loadData().then(viewStats, viewStats); }
  if (t === "settings") return viewSettings();
  return viewList(t);
}

// ---------- Listen ----------
function itemRow(d, extra) {
  const p = d.poster ? '<img loading="lazy" src="' + IMG + "w185" + d.poster + '">' : '<div class="ph"></div>';
  const k = kOf(d.type, d.tmdb); const ex = S.items[k];
  const chips = []; if (ex && ex.list) chips.push('<span class="chip acc">' + LISTS[ex.list] + "</span>"); if (ex && ex.rating) chips.push('<span class="chip">Meine: ' + stars(ex.rating) + "</span>");
  return '<div class="item" data-k="' + k + '">' + p + '<div class="grow"><div class="t">' + esc(d.title) + '</div><div class="meta">' + (d.type === "tv" ? "Serie" : "Film") + (d.year ? " · " + d.year : "") + (d.vote ? ' · <span class="star">★ ' + d.vote + "</span>" : "") + "</div>" + (extra || "") + "<div>" + chips.join("") + '</div><div class="pl" data-pk="' + k + '">' + provLine(S.prov[k]) + "</div></div></div>";
}
function bindRows(root) {
  root.querySelectorAll(".item,.poster").forEach((el) => (el.onclick = () => { const [type, id] = el.dataset.k.split(":"); openDetail(type, +id); }));
  const need = [...root.querySelectorAll(".pl")].filter((x) => !x.innerHTML).map((x) => x.dataset.pk);
  pool([...new Set(need)], 4, async (k) => { const [type, id] = k.split(":"); const p = await providersFor(type, +id); root.querySelectorAll('.pl[data-pk="' + k + '"]').forEach((x) => (x.innerHTML = provLine(p))); });
}
function viewList(t) {
  let arr = Object.values(S.items).filter((d) => (t === "rated" ? d.rating : d.list === t));
  if (S.filter !== "all") arr = arr.filter((d) => d.type === S.filter);
  arr.sort(t === "rated" ? (a, b) => b.rating - a.rating : (a, b) => (b.added || "").localeCompare(a.added || ""));
  const f = ["all", "movie", "tv"].map((x) => '<button class="btn sm' + (S.filter === x ? " on" : "") + '" data-f="' + x + '">' + { all: "Alle", movie: "Filme", tv: "Serien" }[x] + "</button>").join(" ");
  let html = '<div class="row" style="margin-bottom:8px">' + f + '<span class="muted small" style="margin-left:auto">' + arr.length + " Titel</span></div>";
  if (!arr.length) html += '<div class="empty">Noch nichts hier. Über 🔍 Suche hinzufügen.</div>';
  html += '<div class="list">' + arr.map((d) => {
    let extra = ""; const pr = progress(d);
    if (d.type === "tv" && pr != null) { const n = nextEp(d); extra = '<div class="meta">' + (n ? "Nächste: S" + n.s + "E" + n.e : "Alles gesehen 🎉") + " · " + pr + '%</div><div class="bar"><i style="width:' + pr + '%"></i></div>'; }
    return itemRow(d, extra);
  }).join("") + "</div>";
  $("#main").innerHTML = html;
  $$("#main [data-f]").forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; render(); }));
  bindRows($("#main"));
}

// ---------- Suche ----------
function viewSearch() {
  $("#main").innerHTML = '<div class="row"><input type="search" class="grow" id="q" placeholder="Film oder Serie suchen…" value="' + esc(S.search.q) + '"><button class="btn pri" id="go">Suchen</button></div><div id="res"></div>';
  const showRes = () => { const res = S.search.res; $("#res").innerHTML = res.length ? '<div class="list">' + res.map((x) => itemRow(baseData(x.media_type, x), '<div class="small muted">' + esc((x.overview || "").slice(0, 140)) + (x.overview && x.overview.length > 140 ? "…" : "") + "</div>")).join("") + "</div>" : S.search.q ? '<div class="empty">Nichts gefunden.</div>' : ""; bindRows($("#res")); };
  const go = async () => {
    const q = $("#q").value.trim(); if (!q) return; S.search.q = q; $("#res").innerHTML = '<div class="empty"><span class="spin"></span></div>';
    try { const r = await tmdb("search/multi", { query: q, include_adult: "false", region: "DE" }); S.search.res = await fskFilter((r.results || []).filter((x) => x.media_type === "movie" || x.media_type === "tv"), (x) => kOf(x.media_type, x.id)); showRes(); }
    catch (e) { $("#res").innerHTML = '<div class="empty">Fehler: ' + esc(errMsg(e)) + "</div>"; }
  };
  $("#go").onclick = go; $("#q").onkeydown = (e) => { if (e.key === "Enter") go(); };
  showRes(); if (!S.search.q) setTimeout(() => $("#q") && $("#q").focus(), 50);
}

// ---------- Detail ----------
async function openDetail(type, id) {
  const m = $("#modal"); m.innerHTML = '<div class="modal"><div class="sheet"><div class="empty"><span class="spin"></span></div></div></div>';
  m.firstChild.onclick = (e) => { if (e.target === m.firstChild) closeDetail(); };
  let x; try { x = await tmdb(type + "/" + id, { append_to_response: "credits,external_ids,videos", include_video_language: "de,en" }); } catch (e) { m.innerHTML = ""; toast("Fehler: " + errMsg(e)); return; }
  const p = await providersFor(type, id).catch(() => null);
  const k = kOf(type, id); const cur = S.items[k] || null;
  const d = cur ? JSON.parse(JSON.stringify(cur)) : baseData(type, x);
  Object.assign(d, { title: x.title || x.name, poster: x.poster_path || d.poster, vote: x.vote_average ? Math.round(x.vote_average * 10) / 10 : d.vote, genres: (x.genres || []).map((g) => g.name), runtime: (type === "movie" ? x.runtime : (x.episode_run_time || [])[0] || (x.last_episode_to_air || {}).runtime) || d.runtime || null });
  if (type === "tv") { const se = {}; (x.seasons || []).forEach((s) => { if (s.episode_count) se[s.season_number] = s.episode_count; }); d.seasons = se; }
  const imdb = (x.external_ids || {}).imdb_id || x.imdb_id;
  const trailer = ((x.videos && x.videos.results) || []).find((v) => v.site === "YouTube" && v.type === "Trailer");
  const runtime = type === "movie" ? (x.runtime ? x.runtime + " Min." : "") : (x.number_of_seasons || "?") + " Staffeln · " + (x.status || "");
  const mine = abos();
  const provHtml = p && (p.flat.length || p.rent.length || p.buy.length) ? ["flat", "rent", "buy"].filter((t) => p[t].length).map((t) => '<div class="small muted" style="margin-top:6px">' + { flat: "Im Abo", rent: "Leihen", buy: "Kaufen" }[t] + '</div><div class="provs">' + p[t].map((v) => '<img title="' + esc(v.provider_name) + '" class="' + (t === "flat" && mine.includes(v.provider_id) ? "mine" : "") + '" src="' + IMG + "w92" + v.logo_path + '">').join("") + "</div>").join("") : '<div class="muted small">Aktuell bei keinem Anbieter in DE.</div>';
  const cast = ((x.credits || {}).cast || []).slice(0, 12).map((c) => "<div>" + (c.profile_path ? '<img loading="lazy" src="' + IMG + "w185" + c.profile_path + '">' : '<div class="ph" style="width:70px;height:90px"></div>') + "<div><b>" + esc(c.name) + '</b></div><div class="muted">' + esc(c.character || "") + "</div></div>").join("");
  const crew = type === "movie" ? ((x.credits || {}).crew || []).filter((c) => c.job === "Director").map((c) => c.name).join(", ") : (x.created_by || []).map((c) => c.name).join(", ");
  m.innerHTML = '<div class="modal"><div class="sheet"><div class="hero" style="background-image:url(' + (x.backdrop_path ? IMG + "w780" + x.backdrop_path : "") + ')"><button class="close" id="cl">✕</button></div>' +
    '<div class="dhead">' + (d.poster ? '<img src="' + IMG + "w342" + d.poster + '">' : '<div class="ph" style="width:110px;height:165px"></div>') + '<div style="align-self:flex-end"><div style="font-size:20px;font-weight:700">' + esc(d.title) + '</div><div class="meta">' + (type === "tv" ? "Serie" : "Film") + " · " + esc(yr(x.release_date || x.first_air_date)) + " · " + esc(runtime) + '</div><div class="meta"><span class="star">★ ' + (d.vote || "–") + "</span> TMDb" + (imdb ? ' · <a target="_blank" href="https://www.imdb.com/title/' + imdb + '/">IMDb ↗</a>' : "") + (trailer ? ' · <a target="_blank" href="https://www.youtube.com/watch?v=' + trailer.key + '">Trailer ↗</a>' : "") + '</div><div class="meta">' + esc(d.genres.join(", ")) + "</div></div></div>" +
    '<div class="dbody"><div class="row" id="lists">' + Object.keys(LISTS).map((l) => '<button class="btn' + (d.list === l ? " on" : "") + '" data-l="' + l + '">' + LISTS[l] + "</button>").join("") + (cur ? '<button class="btn" id="del" title="Entfernen">🗑</button>' : "") + "</div>" +
    '<h2>Meine Bewertung</h2><div class="rate" id="rate">' + stars(d.rating) + '<span id="ratelbl" class="muted">' + rateLbl(d.rating) + "</span></div>" +
    "<h2>Handlung</h2><div>" + esc(x.overview || "Keine Beschreibung vorhanden.") + "</div>" + (crew ? '<div class="meta" style="margin-top:6px">' + (type === "movie" ? "Regie: " : "Von: ") + esc(crew) + "</div>" : "") +
    '<h2>Teilen</h2><div class="row"><button class="btn" id="rec">👉 Empfehlen</button>' + (((S.u.shared || []).length) ? '<select id="toshared" style="width:auto"><option value="">➕ Zu gemeinsamer Liste…</option>' + S.u.shared.map((l) => '<option value="' + l.id + '"' + (l.items[k] ? " disabled" : "") + ">" + esc(l.name) + (l.items[k] ? " ✓" : "") + "</option>").join("") + "</select>" : '<button class="btn" id="newshared">👥 Gemeinsame Liste anlegen</button>') + '</div><div id="social" class="small" style="margin-top:8px"></div>' +
    "<h2>Wo schauen?</h2>" + provHtml + tvButtons(p) + (cast ? '<h2>Besetzung</h2><div class="cast">' + cast + "</div>" : "") +
    (type === "tv" ? '<h2>Folgen <span class="muted small" id="prg"></span></h2><div id="seasons">' + (x.seasons || []).filter((s) => s.episode_count).sort((a, b) => (a.season_number || 99) - (b.season_number || 99)).map((s) => '<details class="season" data-s="' + s.season_number + '"><summary><span>' + esc(s.name) + '</span><span class="muted small" data-cnt="' + s.season_number + '"></span></summary><div class="eps"></div></details>').join("") + "</div>" : "") +
    "</div></div></div>";
  m.firstChild.onclick = (e) => { if (e.target === m.firstChild) closeDetail(); };
  $("#cl").onclick = closeDetail;
  const persist = async (msg) => { try { await saveItem(d); toast(msg || "Gespeichert"); } catch (e) { toast("Fehler: " + errMsg(e)); } };
  $$("#modal [data-l]").forEach((b) => (b.onclick = async () => { d.list = b.dataset.l; if (d.list === "seen" && !d.watched) d.watched = today(); $$("#modal [data-l]").forEach((z) => z.classList.toggle("on", z === b)); await persist("→ " + LISTS[d.list]); }));
  const rs = $("#rate .stars");
  const rVal = (e) => { const b = rs.getBoundingClientRect(); return Math.min(10, Math.max(1, Math.ceil(((e.clientX - b.left) / b.width) * 10))); };
  rs.removeAttribute("title");
  const rShow = (r) => { rs.firstChild.style.width = (r || 0) * 10 + "%"; $("#ratelbl").textContent = rateLbl(r); };
  rs.onmousemove = (e) => rShow(rVal(e));
  rs.onmouseleave = () => rShow(d.rating);
  rs.onclick = async (e) => { const r = rVal(e); d.rating = d.rating === r ? null : r; rShow(d.rating); if (!d.list) d.list = "seen"; $$("#modal [data-l]").forEach((z) => z.classList.toggle("on", z.dataset.l === d.list)); await persist(d.rating ? "Bewertet: " + rateLbl(d.rating) : "Bewertung entfernt"); };
  const del = $("#del"); if (del) del.onclick = async () => { if (!confirm("„" + d.title + "“ aus allen Listen entfernen?")) return; await removeItem(k); toast("Entfernt"); closeDetail(); };
  if (type === "tv") bindSeasons(d, persist);
  $("#rec").onclick = () => recommendDialog(d);
  bindTv(d);
  const ts = $("#toshared"); if (ts) ts.onchange = async () => { const id = ts.value; if (!id) return; try { await wsU({ type: "filmtracker/shared/items", id, items: [brief(d)] }); toast("Zur Liste hinzugefügt"); ts.selectedOptions[0].disabled = true; ts.selectedOptions[0].textContent += " ✓"; ts.value = ""; renderTabs(); } catch (e) { toast("Fehler: " + errMsg(e)); } };
  const ns = $("#newshared"); if (ns) ns.onclick = () => { closeDetail(); S.tab = "shared"; render(); sharedDialog(null); };
  ws({ type: "filmtracker/social", key: k }).then((r) => { const el = $("#social"); if (!el) return; el.innerHTML = r.people.length ? '<div class="muted" style="margin-bottom:4px">Im Haushalt:</div>' + r.people.map((p) => "<div>" + personLine(p) + "</div>").join("") : '<span class="muted">Noch niemand sonst im Haushalt hat diesen Titel.</span>'; }).catch(() => {});
}

// ---------- Auf dem Fernseher öffnen ----------
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
function tvButtons(p) {
  const remotes = S.u.remotes || []; const apps = S.u.apps || {};
  if (!p || !remotes.length) return "";
  const hasAlexa = remotes.some((r) => r.kind === "alexa");
  const provs = p.flat.filter((v) => apps[String(v.provider_id)] || (hasAlexa && abos().includes(v.provider_id)));
  if (!provs.length) return "";
  const cur = lsGet("ft_remote") || remotes[0].id;
  return '<div class="row" style="margin-top:10px">' + (remotes.length > 1 ? '<select id="tvsel" style="width:auto">' + remotes.map((r) => '<option value="' + r.id + '"' + (r.id === cur ? " selected" : "") + ">" + (r.kind === "remote" ? "📺 " : "🔥 ") + esc(r.name) + (r.kind === "alexa" ? " (Alexa)" : "") + "</option>").join("") + "</select>" : "") + provs.map((v) => '<button class="btn" data-play="' + v.provider_id + '">▶ ' + esc(v.provider_name) + " auf TV öffnen</button>").join("") + "</div>";
}
function bindTv(d) {
  const sel = $("#tvsel"); if (sel) sel.onchange = () => lsSet("ft_remote", sel.value);
  $$("#modal [data-play]").forEach((b) => (b.onclick = async () => {
    const remotes = S.u.remotes || []; const remote = (sel && sel.value) || lsGet("ft_remote") || (remotes[0] && remotes[0].id);
    if (!remotes.find((r) => r.id === remote)) { toast("Kein Fernseher gefunden."); return; }
    b.disabled = true;
    try { const r = await ws({ type: "filmtracker/play", remote, provider: +b.dataset.play, title: d ? d.title : "", key: d ? kOf(d.type, d.tmdb) : "" }); toast((r.command ? "🔥 An Fire TV gesendet: „" + r.command + "“" : "📺 App wird auf dem Fernseher geöffnet") + (r.ask ? " – ich frag dich später, ob du fertig bist" : ""), 4000); } catch (e) { toast("Fehler: " + errMsg(e), 4000); }
    b.disabled = false;
  }));
}

// ---------- Statistik ----------
function viewStats() {
  const log = S.u.log || []; const items = S.items;
  const years = [...new Set(log.map((x) => String(x.d).slice(0, 4)))].sort().reverse();
  const nowY = String(new Date().getFullYear()); if (!years.includes(nowY)) years.unshift(nowY);
  if (!S.statYear) S.statYear = nowY;
  const all = S.statYear === "all";
  const L = all ? log : log.filter((x) => String(x.d).startsWith(S.statYear));
  const eps = L.filter((x) => x.e).length, movies = L.length - eps, mins = L.reduce((a, x) => a + (+x.m || 0), 0);
  const allItems = Object.values(items);
  const rated = allItems.filter((d) => d.rating);
  const avg = rated.length ? (rated.reduce((a, d) => a + d.rating, 0) / rated.length / 2).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " ★" : "–";
  const genre = {}; const perShow = {};
  for (const x of L) { const d = items[x.k]; if (!d) continue; for (const g of d.genres || []) genre[g] = (genre[g] || 0) + 1; if (x.e) perShow[x.k] = (perShow[x.k] || 0) + 1; }
  const topG = Object.entries(genre).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topS = Object.entries(perShow).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const months = Array(12).fill(0); if (!all) for (const x of L) months[+String(x.d).slice(5, 7) - 1]++;
  const mMax = Math.max(1, ...months);
  const best = (all ? rated : rated.filter((d) => (d.watched || d.updated || d.added || "").startsWith(S.statYear))).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const totalEps = allItems.reduce((a, d) => a + (d.eps || []).length, 0), totalMovies = allItems.filter((d) => d.type === "movie" && d.list === "seen").length;
  const tile = (n, l) => '<div class="card" style="flex:1;min-width:120px;text-align:center;margin:0"><div style="font-size:26px;font-weight:700">' + n + '</div><div class="small muted">' + l + "</div></div>";
  const bar = (l, n, max) => '<div class="row" style="gap:6px;margin:3px 0;flex-wrap:nowrap"><span class="small" style="width:110px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l) + '</span><div class="bar" style="flex:1;height:10px;margin:0"><i style="width:' + Math.round((n / max) * 100) + '%;background:var(--accent)"></i></div><span class="small muted" style="width:30px;text-align:right">' + n + "</span></div>";
  let html = '<div class="row" style="margin-bottom:10px">' + years.map((y) => '<button class="btn sm' + (S.statYear === y ? " on" : "") + '" data-y="' + y + '">' + y + "</button>").join("") + '<button class="btn sm' + (all ? " on" : "") + '" data-y="all">Gesamt</button></div>';
  html += "<h2>" + (all ? "Alles bisher" : "🎉 Dein Jahr " + S.statYear) + '</h2><div class="row" style="gap:10px">' + tile(movies, "Filme") + tile(eps, "Folgen") + tile(Math.round(mins / 60), "Stunden") + tile(avg, "Ø Bewertung") + "</div>";
  if (!L.length) html += '<div class="small muted" style="margin-top:8px">Gezählt wird ab jetzt alles, was du als gesehen markierst. Importierte Titel zählen nicht mit.</div>';
  if (!all) html += '<h2>Pro Monat</h2><div class="row" style="align-items:flex-end;gap:4px;height:120px;flex-wrap:nowrap">' + months.map((n, i) => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%"><div class="small muted">' + (n || "") + '</div><div style="width:100%;background:var(--accent);border-radius:3px 3px 0 0;height:' + Math.round((n / mMax) * 90) + '%;min-height:' + (n ? 2 : 0) + 'px"></div><div class="small muted">' + "JFMAMJJASOND"[i] + "</div></div>").join("") + "</div>";
  if (topG.length) html += "<h2>Lieblingsgenres</h2>" + topG.map(([g, n]) => bar(g, n, topG[0][1])).join("");
  if (topS.length) html += "<h2>Meistgeschaute Serien</h2>" + topS.map(([k, n]) => bar((items[k] || {}).title || k, n, topS[0][1])).join("");
  if (best.length) html += '<h2>Am besten bewertet</h2><div class="list">' + best.map((d) => itemRow(d, "")).join("") + "</div>";
  html += '<div class="card small muted" style="margin-top:14px">Insgesamt in deinen Listen: ' + totalMovies + " gesehene Filme · " + totalEps + " abgehakte Folgen · " + rated.length + " Bewertungen</div>";
  html += '<h2>💰 Abo-Check</h2><div class="card" id="abo"><div class="small muted">Wie viele Titel von deinen Listen laufen bei welchem Anbieter? So siehst du, welches Abo sich lohnt.</div><button class="btn sm" id="abogo" style="margin-top:8px">Jetzt prüfen</button></div>';
  html += '<h2>🏠 Haushalt ' + esc(all ? nowY : S.statYear) + '</h2><div id="hh"><div class="empty"><span class="spin"></span></div></div>';
  $("#main").innerHTML = html;
  $("#abogo").onclick = async () => {
    $("#abo").innerHTML = '<span class="spin"></span> prüfe deine Listen…';
    try {
      const r = await ws({ type: "filmtracker/abocheck" }); const max = Math.max(1, ...r.rows.map((x) => x.count));
      $("#abo").innerHTML = '<div class="small muted" style="margin-bottom:6px">' + r.total + " Titel auf Watchlist, Wunschliste und Läuft</div>" + r.rows.map((x) => '<div style="margin:6px 0"><div class="row" style="flex-wrap:nowrap"><b class="grow" style="min-width:0">' + esc(x.name) + (x.mine ? ' <span class="chip acc">dein Abo</span>' : "") + '</b><span class="small">' + x.count + " Titel</span></div>" + '<div class="bar" style="height:8px"><i style="width:' + Math.round((x.count / max) * 100) + "%;background:" + (x.mine ? "var(--accent)" : "var(--muted)") + '"></i></div><div class="small muted">' + (x.mine && x.count <= 1 ? "⚠ lohnt sich für dich gerade kaum · " : !x.mine && x.count >= 5 ? "💡 könnte sich lohnen · " : "") + esc(x.titles.join(", ")) + "</div></div>").join("");
    } catch (e) { $("#abo").textContent = "Fehler: " + errMsg(e); }
  };
  ws({ type: "filmtracker/household" }).then((h) => {
    const el = $("#hh"); if (!el) return;
    let t = h.people.length ? '<div class="list">' + h.people.map((p) => '<div class="card" style="margin:0 0 8px"><b>' + esc(p.me ? "Du" : p.name) + '</b><div class="small muted">' + p.movies + " Filme · " + p.eps + " Folgen · " + p.hours + " Std." + (p.genre ? " · mag " + esc(p.genre) : "") + (p.avg ? " · Ø " + stars(p.avg) : "") + "</div></div>").join("") + "</div>" : "";
    if (h.top.length) t += '<h2>❤ Haushalts-Lieblinge</h2><div class="list">' + h.top.map((a) => itemRow({ tmdb: a.tmdb, type: a.type, title: a.title, poster: a.poster }, '<div class="small">' + esc(a.who.join(", ")) + (a.avg ? " · Ø " + stars(a.avg) : "") + "</div>")).join("") + "</div>";
    el.innerHTML = t || '<div class="small muted">Noch keine Daten aus dem Haushalt.</div>'; bindRows(el);
  }).catch(() => { const el = $("#hh"); if (el) el.innerHTML = ""; });
  $$("#main [data-y]").forEach((b) => (b.onclick = () => { S.statYear = b.dataset.y; viewStats(); }));
  bindRows($("#main"));
}

// ---------- Export ----------
function exportCSV() {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const rows = [["Titel", "Typ", "Jahr", "Liste", "Meine Bewertung", "TMDb-Bewertung", "Gesehene Folgen", "Fortschritt %", "Genres", "Hinzugefügt", "TMDb-ID"]];
  for (const d of Object.values(S.items)) rows.push([d.title, d.type === "tv" ? "Serie" : "Film", d.year, LISTS[d.list] || "", d.rating || "", d.vote || "", (d.eps || []).length || "", progress(d) == null ? "" : progress(d), (d.genres || []).join(", "), d.added || "", d.tmdb]);
  const csv = "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "filmtracker-" + (S.u.user_name || "export") + "-" + today() + ".csv";
  ROOT.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- Teilen ----------
function dialog(html) {
  const wrap = document.createElement("div"); wrap.className = "modal"; wrap.style.zIndex = 15; wrap.style.alignItems = "center";
  wrap.innerHTML = '<div class="sheet" style="max-width:420px;padding:16px">' + html + "</div>";
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  ROOT.appendChild(wrap); return wrap;
}
function recommendDialog(d) {
  const people = S.u.people || [];
  if (!people.length) { toast("Keine anderen Personen in HA gefunden."); return; }
  const w = dialog('<h2 style="margin-top:0">👉 „' + esc(d.title) + '“ empfehlen</h2><div class="grid2">' + people.map((p) => '<label><input type="checkbox" value="' + p.id + '">' + esc(p.name) + "</label>").join("") + '</div><input type="text" id="recnote" maxlength="300" placeholder="Optional: Warum? (z. B. „Musst du sehen, wie Dark!“)" style="margin-top:8px"><div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn" data-x>Abbrechen</button><button class="btn pri" data-ok>Senden</button></div>');
  w.querySelector("[data-x]").onclick = () => w.remove();
  w.querySelector("[data-ok]").onclick = async () => {
    const to = [...w.querySelectorAll("input[type=checkbox]:checked")].map((x) => x.value); if (!to.length) { toast("Wähle mindestens eine Person."); return; }
    try { const r = await ws({ type: "filmtracker/recommend", to, item: brief(d), note: w.querySelector("#recnote").value.trim() }); toast("✓ An " + r.sent + " Person(en) geschickt"); w.remove(); } catch (e) { toast("Fehler: " + errMsg(e)); }
  };
}
function sharedDialog(list) {
  const people = S.u.people || [];
  const mem = new Set(list ? list.members.map((m) => m.id) : []);
  const w = dialog('<h2 style="margin-top:0">' + (list ? "Liste bearbeiten" : "👥 Neue gemeinsame Liste") + '</h2><input type="text" id="slname" maxlength="60" placeholder="Name, z. B. „Filmabend“" value="' + esc(list ? list.name : "") + '"><div class="small muted" style="margin:8px 0 4px">Wer ist dabei?</div><div class="grid2">' + people.map((p) => '<label><input type="checkbox" value="' + p.id + '"' + (mem.has(p.id) ? " checked" : "") + ">" + esc(p.name) + "</label>").join("") + '</div><div class="row" style="margin-top:10px;justify-content:flex-end">' + (list ? '<button class="btn" data-leave style="margin-right:auto">Verlassen</button>' : "") + '<button class="btn" data-x>Abbrechen</button><button class="btn pri" data-ok>Speichern</button></div>');
  w.querySelector("[data-x]").onclick = () => w.remove();
  const lv = w.querySelector("[data-leave]"); if (lv) lv.onclick = async () => { if (!confirm("Liste „" + list.name + "“ verlassen?")) return; await wsU({ type: "filmtracker/shared/save", id: list.id, name: list.name, members: list.members.map((m) => m.id).filter((m) => m !== S.u.user_id) }); S.sharedSel = null; w.remove(); render(); };
  w.querySelector("[data-ok]").onclick = async () => {
    const name = w.querySelector("#slname").value.trim(); if (!name) { toast("Gib der Liste einen Namen."); return; }
    const members = [...w.querySelectorAll("input[type=checkbox]:checked")].map((x) => x.value);
    if (list) members.push(S.u.user_id);
    try { await wsU(Object.assign({ type: "filmtracker/shared/save", name, members }, list ? { id: list.id } : {})); if (!list) S.sharedSel = (S.u.shared.find((l) => l.name === name) || {}).id; w.remove(); render(); toast("Gespeichert"); } catch (e) { toast("Fehler: " + errMsg(e)); }
  };
}
function viewInbox() {
  const inbox = S.u.inbox || [];
  if (!inbox.length) { $("#main").innerHTML = '<div class="empty">Keine Empfehlungen.</div>'; return; }
  $("#main").innerHTML = '<div class="list">' + inbox.map((r) => itemRow(r.item, '<div class="reason">👉 <b>' + esc(r.from_name) + "</b>" + (r.note ? ": „" + esc(r.note) + "“" : " empfiehlt dir das") + '</div><div class="meta">' + new Date(r.at).toLocaleDateString("de-DE") + '</div><div class="row" style="margin-top:4px"><button class="btn sm pri" data-add="' + r.key + '">+ Watchlist</button><button class="btn sm" data-del="' + r.key + '">Entfernen</button></div>')).join("") + "</div>";
  $$("#main [data-add]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const r = inbox.find((x) => x.key === b.dataset.add); const d = S.items[r.key] ? JSON.parse(JSON.stringify(S.items[r.key])) : Object.assign({ list: null, rating: null, eps: [], seasons: null, added: today() }, r.item); if (!d.list) d.list = "watchlist"; await saveItem(d); await wsU({ type: "filmtracker/inbox/remove", key: r.key }); toast("→ Watchlist"); render(); }));
  $$("#main [data-del]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await wsU({ type: "filmtracker/inbox/remove", key: b.dataset.del }); if (!(S.u.inbox || []).length) S.tab = "search"; render(); }));
  bindRows($("#main"));
}
function pollCard(l) {
  const p = l.poll; const me = S.u.user_id;
  if (!p) return '<div class="card" style="padding:10px 14px"><div class="row"><div class="grow"><b>🗳 Filmabend</b><div class="small muted">Wählt aus den 3 besten ungesehenen Titeln, alle stimmen ab.</div></div><button class="btn pri sm" data-poll="start">Abstimmung starten</button></div></div>';
  const counts = {}; p.options.forEach((k) => (counts[k] = 0)); Object.values(p.votes || {}).forEach((k) => { if (k in counts) counts[k]++; });
  const voted = Object.keys(p.votes || {}).length; const mine = (p.votes || {})[me];
  const opt = (k) => { const it = l.items[k] || {}; const win = !p.open && p.winner === k; return '<div class="row" style="padding:6px 0;border-top:1px solid var(--line);flex-wrap:nowrap">' + (it.poster ? '<img src="' + IMG + "w92" + it.poster + '" style="width:36px;height:54px;border-radius:4px;object-fit:cover">' : "") + '<div class="grow"><b>' + (win ? "🏆 " : "") + esc(it.title || k) + '</b><div class="small muted">' + counts[k] + " Stimme(n)" + (mine === k ? " · deine Wahl" : "") + "</div></div>" + (p.open ? '<button class="btn sm' + (mine === k ? " on" : "") + '" data-poll="vote" data-key="' + k + '">Dafür</button>' : "") + "</div>"; };
  return '<div class="card" style="padding:10px 14px"><div class="row"><div class="grow"><b>🗳 ' + (p.open ? "Abstimmung läuft" : "Ergebnis") + '</b><div class="small muted">gestartet von ' + esc(p.by === me ? "dir" : p.by_name) + " · " + voted + "/" + l.members.length + " abgestimmt</div></div>" + (p.open ? '<button class="btn sm" data-poll="end">Beenden</button>' : '<button class="btn sm" data-poll="start">Neu</button><button class="btn sm" data-poll="clear">✕</button>') + "</div>" + p.options.map(opt).join("") + "</div>";
}
function viewShared() {
  const lists = S.u.shared || [];
  if (!S.sharedSel || !lists.find((l) => l.id === S.sharedSel)) S.sharedSel = lists[0] && lists[0].id;
  const cur = lists.find((l) => l.id === S.sharedSel);
  let html = '<div class="row" style="margin-bottom:10px">' + lists.map((l) => '<button class="btn sm' + (l.id === S.sharedSel ? " on" : "") + '" data-sl="' + l.id + '">' + esc(l.name) + " (" + Object.keys(l.items).length + ")</button>").join("") + '<button class="btn sm" id="slnew">＋ Neue Liste</button></div>';
  if (!cur) { $("#main").innerHTML = html + '<div class="card"><b>Gemeinsame Listen</b><p class="small muted">Leg eine Liste an, z. B. „Filmabend“ oder „Mit der Familie schauen“. Alle Mitglieder sehen und bearbeiten sie und sehen, wer was schon gesehen und wie bewertet hat.</p></div>'; bind(); return; }
  const items = Object.entries(cur.items).sort((a, b) => (a[1].seen - b[1].seen) || (b[1].added || "").localeCompare(a[1].added || ""));
  html += '<div class="card" style="padding:10px 14px"><div class="row"><div class="grow"><b>' + esc(cur.name) + '</b><div class="small muted">' + cur.members.map((m) => esc(m.id === S.u.user_id ? "Du" : m.name)).join(", ") + '</div></div><button class="btn sm" id="sledit">✎ Bearbeiten</button>' + (cur.owner === S.u.user_id || S.u.is_admin ? '<button class="btn sm" id="sldel">🗑</button>' : "") + '</div><div class="small muted" style="margin-top:6px">Titel hinzufügen: Titel öffnen → „Zu gemeinsamer Liste…“</div></div>';
  html += pollCard(cur);
  html += items.length ? '<div class="list">' + items.map(([k, it]) => itemRow(it, '<div class="meta">von ' + esc(it.by === S.u.user_id ? "dir" : it.by_name || "?") + (it.seen ? " · ✓ zusammen gesehen" : "") + "</div>" + (cur.status[k] || []).map((p) => '<div class="small">' + personLine(p) + "</div>").join("") + '<div class="row" style="margin-top:4px"><button class="btn sm' + (it.seen ? " on" : "") + '" data-seen="' + k + '">✓ Gesehen</button><button class="btn sm" data-rm="' + k + '">Entfernen</button></div>')).join("") + "</div>" : '<div class="empty">Noch leer. Öffne einen Titel und füge ihn über „Zu gemeinsamer Liste…“ hinzu.</div>';
  $("#main").innerHTML = html; bind();
  function bind() {
    $$("#main [data-sl]").forEach((b) => (b.onclick = () => { S.sharedSel = b.dataset.sl; viewShared(); }));
    $("#slnew").onclick = () => sharedDialog(null);
    if (!cur) return;
    $("#sledit").onclick = () => sharedDialog(cur);
    $$("#main [data-poll]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; try { await wsU({ type: "filmtracker/poll", id: cur.id, action: b.dataset.poll, ...(b.dataset.key ? { key: b.dataset.key } : {}) }); } catch (err) { toast("Fehler: " + errMsg(err), 4000); } viewShared(); }));
    const dl = $("#sldel"); if (dl) dl.onclick = async () => { if (!confirm("Liste „" + cur.name + "“ für alle löschen?")) return; await wsU({ type: "filmtracker/shared/delete", id: cur.id }); S.sharedSel = null; render(); };
    $$("#main [data-seen]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const it = cur.items[b.dataset.seen]; await wsU({ type: "filmtracker/shared/items", id: cur.id, items: [Object.assign({}, it, { seen: !it.seen })] }); viewShared(); }));
    $$("#main [data-rm]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await wsU({ type: "filmtracker/shared/remove", id: cur.id, key: b.dataset.rm }); render(); }));
    bindRows($("#main"));
  }
}
function bindSeasons(d, persist) {
  const upd = () => {
    const pr = progress(d); $("#prg").textContent = pr != null ? pr + " % gesehen" : "";
    for (const s in d.seasons) { const el = $('[data-cnt="' + s + '"]'); if (el) { const n = (d.eps || []).filter((x) => x.startsWith(s + "x")).length; el.textContent = n + "/" + d.seasons[s]; } }
  };
  upd();
  $$("details.season").forEach((det) => (det.ontoggle = async () => {
    if (!det.open || det.dataset.loaded) return; det.dataset.loaded = 1; const s = +det.dataset.s; const box = det.querySelector(".eps"); box.innerHTML = '<div class="ep"><span class="spin"></span></div>';
    try {
      const r = await tmdb("tv/" + d.tmdb + "/season/" + s); const eps = r.episodes || [];
      box.innerHTML = '<div class="ep"><button class="btn sm" data-all="1">Ganze Staffel gesehen</button><button class="btn sm" data-all="0">Keine</button></div>' + eps.map((e) => { const id = s + "x" + e.episode_number; const fut = e.air_date && e.air_date > today(); return '<label class="ep' + (fut ? " future" : "") + '"><input type="checkbox" data-ep="' + id + '"' + ((d.eps || []).includes(id) ? " checked" : "") + "><div><b>" + e.episode_number + ". " + esc(e.name) + '</b><div class="meta">' + (e.air_date ? new Date(e.air_date).toLocaleDateString("de-DE") : "Termin offen") + (e.runtime ? " · " + e.runtime + " Min." : "") + "</div></div></label>"; }).join("");
      const save = async () => { upd(); if (!d.list) { d.list = "running"; $$("#modal [data-l]").forEach((z) => z.classList.toggle("on", z.dataset.l === "running")); } await persist(); };
      box.querySelectorAll("[data-ep]").forEach((c) => (c.onchange = async () => { const set = new Set(d.eps || []); c.checked ? set.add(c.dataset.ep) : set.delete(c.dataset.ep); d.eps = [...set]; await save(); }));
      box.querySelectorAll("[data-all]").forEach((b) => (b.onclick = async (ev) => { ev.preventDefault(); const on = b.dataset.all === "1"; const set = new Set(d.eps || []); eps.forEach((e) => { const id = s + "x" + e.episode_number; if (on && !(e.air_date && e.air_date > today())) set.add(id); if (!on) set.delete(id); }); d.eps = [...set]; box.querySelectorAll("[data-ep]").forEach((c) => (c.checked = set.has(c.dataset.ep))); await save(); }));
    } catch (e) { box.innerHTML = '<div class="ep">Fehler: ' + esc(errMsg(e)) + "</div>"; }
  }));
}
function closeDetail() { $("#modal").innerHTML = ""; if (!["search", "tips", "releases", "settings"].includes(S.tab)) render(); else renderTabs(); }
async function refreshShared() { try { await loadData(); } catch (e) {} }

// ---------- KI-Tipps ----------
const tipsKey = () => "ft_tips_" + (S.u ? S.u.user_id : "");
function tasteProfile() {
  const all = Object.values(S.items); const t = (d) => d.title + (d.year ? " (" + d.year + ")" : "") + (d.type === "tv" ? " [Serie]" : " [Film]");
  return {
    rated: all.filter((d) => d.rating).sort((a, b) => b.rating - a.rating).slice(0, 60).map((d) => t(d) + ": " + d.rating + "/10"),
    seen: all.filter((d) => !d.rating && (d.list === "seen" || d.list === "running")).slice(0, 60).map(t),
    want: all.filter((d) => d.list === "watchlist" || d.list === "wish").slice(0, 60).map(t),
  };
}
function viewTips() {
  const ents = S.u.ai_entities || []; const st = S.u.settings || {};
  $("#main").innerHTML = '<div class="card"><div class="row"><input type="text" class="grow" id="mood" placeholder="Optional: Worauf hast du Lust? (z. B. „düster, Sci-Fi, kurze Serie“)"><button class="btn pri" id="gen">✨ Neue Tipps</button></div><div class="small muted" style="margin-top:6px">KI: ' + esc(st.ki_primary || ents[0] || "keine") + (st.ki_fallback ? " · Fallback: " + esc(st.ki_fallback) : "") + '</div></div><div id="tipres"></div>';
  if (!ents.length) { $("#tipres").innerHTML = '<div class="card"><b>Keine KI eingebunden.</b><p>Füge in HA unter Einstellungen → Geräte & Dienste z. B. Ollama, Google Gemini oder OpenAI mit einer „KI-Aufgabe“ hinzu.</p></div>'; $("#gen").disabled = true; return; }
  if (!S.tips) { try { const c = JSON.parse(localStorage.getItem(tipsKey()) || "null"); if (c) S.tips = c; } catch (e) {} }
  if (S.tips) showTips();
  $("#gen").onclick = async () => {
    const tp = tasteProfile(); const dis = S.u.dismissed || [];
    if (tp.rated.length + tp.seen.length < 3) toast("Bewerte erst ein paar Titel, dann werden die Tipps besser.", 4000);
    const mood = $("#mood").value.trim();
    const prompt = "Du bist ein Film- und Serienexperte. Empfiehl mir 12 Filme und Serien (gemischt), die zu meinem Geschmack passen.\n\nMeine Bewertungen (1–10):\n" + (tp.rated.join("\n") || "-") + "\n\nGesehen (ohne Bewertung):\n" + (tp.seen.join("\n") || "-") + "\n\nSteht schon auf meiner Liste:\n" + (tp.want.join("\n") || "-") + (mood ? "\n\nAktueller Wunsch: " + mood : "") +
      '\n\nRegeln: Empfiehl NICHTS, was oben schon vorkommt. Gewichte hoch bewertete Titel stark, niedrig bewertete als Abneigung. Bevorzuge Titel, die in Deutschland verfügbar sind. Nur real existierende Titel. Antworte AUSSCHLIESSLICH mit einem JSON-Array ohne weiteren Text, Format: [{"titel":"Originaltitel oder deutscher Titel","jahr":2020,"typ":"film" oder "serie","grund":"ein Satz auf Deutsch, warum es passt, mit Bezug auf konkrete Titel von mir"}]';
    $("#tipres").innerHTML = '<div class="empty"><span class="spin"></span> KI denkt nach… (lokale Modelle brauchen etwas)</div>'; $("#gen").disabled = true;
    let res;
    try { res = await askAI(prompt); } catch (e) { $("#tipres").innerHTML = '<div class="card">KI nicht erreichbar.<br><span class="small muted">' + esc(errMsg(e)) + "</span></div>"; $("#gen").disabled = false; return; }
    const txt = res.text || ""; let arr = [];
    try { const a = txt.indexOf("["), b = txt.lastIndexOf("]"); arr = JSON.parse(txt.slice(a, b + 1)); } catch (e) { $("#tipres").innerHTML = '<div class="card">KI-Antwort nicht lesbar.<pre class="small" style="white-space:pre-wrap">' + esc(txt.slice(0, 800)) + "</pre></div>"; $("#gen").disabled = false; return; }
    const resolved = await pool(arr, 4, async (t) => {
      const type = /serie|tv|show/i.test(t.typ || "") ? "tv" : "movie";
      const q = { query: t.titel }; if (t.jahr) q[type === "tv" ? "first_air_date_year" : "year"] = t.jahr;
      let r = await tmdb("search/" + type, q); let x = (r.results || [])[0];
      if (!x) { r = await tmdb("search/" + type, { query: t.titel }); x = (r.results || [])[0]; }
      if (!x) return null; const k = kOf(type, x.id); if (S.items[k] || dis.includes(k)) return null;
      return Object.assign(baseData(type, x), { reason: t.grund });
    });
    const seenK = new Set();
    const okTips = await fskFilter(resolved.filter(Boolean), (d) => kOf(d.type, d.tmdb)); resolved.length = 0; resolved.push(...okTips);
    S.tips = { at: new Date().toLocaleString("de-DE"), model: res.model, items: resolved.filter((d) => d && !seenK.has(kOf(d.type, d.tmdb)) && seenK.add(kOf(d.type, d.tmdb))) };
    try { localStorage.setItem(tipsKey(), JSON.stringify(S.tips)); } catch (e) {}
    $("#gen").disabled = false; showTips();
  };
}
function showTips() {
  const T = S.tips; const dis = S.u.dismissed || [];
  const items = T.items.filter((d) => { const k = kOf(d.type, d.tmdb); return !S.items[k] && !dis.includes(k); });
  $("#tipres").innerHTML = '<div class="small muted" style="margin-bottom:6px">' + items.length + " Tipps · " + esc(T.at) + (T.model ? " · " + esc(T.model) : "") + '</div><div class="list">' + items.map((d) => itemRow(d, '<div class="reason">💡 ' + esc(d.reason || "") + '</div><button class="btn sm" data-dis="' + kOf(d.type, d.tmdb) + '">Nicht interessiert</button>')).join("") + "</div>";
  $$("#tipres [data-dis]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await saveUser({ dismissed: [...(S.u.dismissed || []), b.dataset.dis] }); showTips(); }));
  bindRows($("#tipres"));
}

// ---------- Releases ----------
function weekRange(off) { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day + off * 7); const a = new Date(d); const b = new Date(d); b.setDate(b.getDate() + 6); const f = (x) => x.toLocaleDateString("sv-SE"); return [f(a), f(b), a, b]; }
async function viewReleases() {
  const [a, b, A, B] = weekRange(S.week); const fmt = (x) => x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  $("#main").innerHTML = '<div class="row"><h2 style="margin:0">📅 Releases der Woche</h2><span style="margin-left:auto"></span><button class="btn sm" id="pw">‹</button><span>' + fmt(A) + " – " + fmt(B) + '</span><button class="btn sm" id="nw">›</button></div><div id="rel"><div class="empty"><span class="spin"></span></div></div>';
  $("#pw").onclick = () => { S.week--; viewReleases(); }; $("#nw").onclick = () => { S.week++; viewReleases(); };
  const prov = abos().join("|");
  try {
    const [mov, tv, kino] = await Promise.all([
      prov ? tmdb("discover/movie", { watch_region: "DE", with_watch_providers: prov, with_watch_monetization_types: "flatrate", region: "DE", with_release_type: "4|6", "release_date.gte": a, "release_date.lte": b, sort_by: "popularity.desc" }) : { results: [] },
      prov ? tmdb("discover/tv", { watch_region: "DE", with_watch_providers: prov, with_watch_monetization_types: "flatrate", "air_date.gte": a, "air_date.lte": b, sort_by: "popularity.desc" }) : { results: [] },
      tmdb("discover/movie", { region: "DE", with_release_type: "3|2", "release_date.gte": a, "release_date.lte": b, sort_by: "popularity.desc" }),
    ]);
    mov.results = await fskFilter(mov.results || [], (x) => kOf("movie", x.id)); tv.results = await fskFilter(tv.results || [], (x) => kOf("tv", x.id)); kino.results = await fskFilter(kino.results || [], (x) => kOf("movie", x.id));
    const mine = Object.values(S.items).filter((d) => d.type === "tv" && ["running", "watchlist", "wish"].includes(d.list));
    const eps = (await pool(mine, 4, async (d) => { const x = await tmdb("tv/" + d.tmdb); const out = []; for (const e of [x.last_episode_to_air, x.next_episode_to_air]) if (e && e.air_date >= a && e.air_date <= b) out.push({ d, e }); return out; })).filter(Boolean).flat();
    const strip = (arr, type) => arr.length ? '<div class="strip">' + arr.slice(0, 20).map((x) => { const d = baseData(type, x); return '<div class="poster" data-k="' + kOf(type, x.id) + '">' + (d.poster ? '<img loading="lazy" src="' + IMG + "w185" + d.poster + '">' : '<div class="ph"></div>') + '<div class="t">' + esc(d.title) + '</div><div class="meta">' + esc((x.release_date || "").slice(5).split("-").reverse().join(".")) + (d.vote ? ' <span class="star">★' + d.vote + "</span>" : "") + "</div></div>"; }).join("") + "</div>" : '<div class="muted small">Nichts gefunden.</div>';
    $("#rel").innerHTML =
      "<h2>Neue Folgen deiner Serien</h2>" + (eps.length ? '<div class="list">' + eps.map(({ d, e }) => itemRow(d, '<div class="meta">S' + e.season_number + "E" + e.episode_number + " „" + esc(e.name) + "“ · " + new Date(e.air_date).toLocaleDateString("de-DE") + "</div>")).join("") + "</div>" : '<div class="muted small">Keine neuen Folgen diese Woche.</div>') +
      "<h2>Neue Filme in deinen Abos</h2>" + strip(mov.results || [], "movie") +
      "<h2>Serien mit neuen Folgen in deinen Abos</h2>" + strip(tv.results || [], "tv") +
      "<h2>Neu im Kino</h2>" + strip(kino.results || [], "movie");
    bindRows($("#rel"));
  } catch (e) { $("#rel").innerHTML = '<div class="empty">Fehler: ' + esc(errMsg(e)) + "</div>"; }
}

// ---------- Einstellungen ----------
async function viewSettings() {
  const u = S.u; const st = u.settings || {}; const ents = u.ai_entities || [];
  const opt = (cur) => '<option value="">– keine –</option>' + ents.map((e) => "<option" + (e === cur ? " selected" : "") + ' value="' + e + '">' + esc((u.ai_names || {})[e] || e) + "</option>").join("");
  const notifyOpts = '<option value="">Automatisch' + (u.notify_guess ? " (" + esc(u.notify_guess) + ")" : " (kein Handy gefunden)") + "</option>" + (u.notify_services || []).map((s) => "<option" + (s === u.notify ? " selected" : "") + ' value="' + s + '">' + esc(s) + "</option>").join("");
  const hasOld = !!H.states[OLD_TODO];
  $("#main").innerHTML =
    '<div class="card"><b>' + esc(u.user_name) + '</b><div class="small muted">Deine Listen, Bewertungen, Folgen und Tipps gehören dir. Bearbeiten kannst nur du.</div><label class="row" style="margin-top:8px"><input type="checkbox" id="share"' + (u.share ? " checked" : "") + '> Andere im Haushalt dürfen sehen, was ich schaue und wie ich bewerte</label></div>' +
    '<div class="card"><h2 style="margin-top:0">Push-Benachrichtigung</h2><label class="row"><input type="checkbox" id="push"' + (u.push ? " checked" : "") + '> Täglich um ' + esc((st.check_time || "").slice(0, 5)) + ' Uhr melden, wenn etwas Neues da ist</label><label class="row" style="margin-top:6px"><input type="checkbox" id="autoask"' + (u.autoask ? " checked" : "") + '> Nach „Auf TV öffnen“ fragen, ob ich fertig bin, und dann automatisch abhaken</label><div style="margin-top:8px">An Gerät<select id="notify">' + notifyOpts + '</select></div><div class="row" style="margin-top:8px"><button class="btn" id="checknow">Jetzt prüfen</button><span id="checkres" class="small muted"></span></div></div>' +
    '<div class="card"><h2 style="margin-top:0">Meine Abos</h2><div class="small muted" style="margin-bottom:6px">' + (u.own_abos ? 'Eigene Auswahl · <a href="#" id="resetabos">auf Standard zurücksetzen</a>' : "Standard-Abos des Haushalts") + '</div><div id="abos" class="grid2"><span class="spin"></span></div></div>' +
    (u.is_admin ? '<div class="card"><h2 style="margin-top:0">KI (für alle)</h2><div>Primär<select id="ki1">' + opt(st.ki_primary) + '</select></div><div style="margin-top:8px">Fallback (wenn Primär überlastet / Fehler)<select id="ki2">' + opt(st.ki_fallback) + '</select></div><div class="row" style="margin-top:8px"><button class="btn" id="testki">KI testen</button><span id="kires" class="small muted"></span></div>' + (u.own_abos ? "" : '<div class="small muted" style="margin-top:8px">Deine Abo-Auswahl oben gilt als Standard für alle, die keine eigene haben.</div>') + "</div>" : '<div class="card small muted">KI: ' + esc(st.ki_primary || "–") + (st.ki_fallback ? " · Fallback: " + esc(st.ki_fallback) : "") + " (einstellbar durch Admin)</div>") +
    (u.is_admin && (u.remotes || []).length ? '<div class="card"><h2 style="margin-top:0">📺 TV-Apps</h2><div class="small muted" style="margin-bottom:6px">Welche Android-TV-App beim „Auf TV öffnen“ startet (Paketname).</div>' + abos().map((id) => { const pv = (S.providers || []).find((p) => p.provider_id === id); return '<div class="row" style="margin:4px 0;flex-wrap:nowrap"><span class="small" style="width:140px;flex:none">' + esc(pv ? pv.provider_name : "Anbieter " + id) + '</span><input type="text" data-app="' + id + '" value="' + esc((u.apps || {})[String(id)] || "") + '" placeholder="z. B. com.anbieter.app"></div>'; }).join("") + '<button class="btn sm" id="saveapps" style="margin-top:6px">Speichern</button></div>' : "") +
    (u.is_admin ? '<div class="card"><h2 style="margin-top:0">🔞 Altersfreigabe (FSK)</h2><div class="small muted" style="margin-bottom:6px">Pro Person: Suche, Tipps und Releases zeigen nur Titel bis zu dieser Freigabe. Titel ohne bekannte Freigabe werden dann ausgeblendet.</div>' + [{ id: u.user_id, name: u.user_name + " (du)" }].concat(u.people || []).map((p) => { const v = (u.people_fsk || {})[p.id]; return '<div class="row" style="margin:4px 0;flex-wrap:nowrap"><span class="small" style="width:140px;flex:none">' + esc(p.name) + '</span><select data-fsk="' + p.id + '" style="width:auto"><option value="">keine Grenze</option>' + [0, 6, 12, 16, 18].map((n) => '<option value="' + n + '"' + (v === n ? " selected" : "") + ">bis FSK " + n + "</option>").join("") + "</select></div>"; }).join("") + "</div>" : (u.max_fsk != null ? '<div class="card small muted">🔞 Für dich gilt: Titel bis FSK ' + u.max_fsk + ".</div>" : "")) +
    traktCard(u) +
    '<div class="card"><h2 style="margin-top:0">Export</h2><div class="small muted">Alle deine Titel als CSV (öffnet in Excel).</div><button class="btn" id="export" style="margin-top:8px">⬇ CSV herunterladen</button></div>' +
    (hasOld ? '<div class="card"><h2 style="margin-top:0">Alte Daten übernehmen</h2><div class="small muted">Übernimmt die Titel aus der alten To-do-Liste „Filmtracker“ in <b>deine</b> Listen.</div><div class="row" style="margin-top:8px"><button class="btn pri" id="migrate">Übernehmen</button><span id="migres" class="small muted"></span></div></div>' : "") +
    '<div class="card"><h2 style="margin-top:0">Import (TV Time / Liste)</h2><div class="small muted">CSV aus dem TV-Time-Export (z. B. <i>followed_tv_show.csv</i>, <i>seen_episode.csv</i>) oder ein Titel pro Zeile.</div><div class="row" style="margin-top:8px"><input type="file" id="file" accept=".csv,.txt"><select id="imlist" style="width:auto">' + Object.keys(LISTS).map((l) => '<option value="' + l + '">→ ' + LISTS[l] + "</option>").join("") + '</select></div><textarea id="imtxt" rows="5" style="margin-top:8px" placeholder="oder hier einfügen…"></textarea><div class="row" style="margin-top:8px"><button class="btn pri" id="imgo">Importieren</button><span id="imres" class="small muted"></span></div></div>';

  $("#push").onchange = async (e) => { await saveUser({ push: e.target.checked }); toast("Gespeichert"); };
  $("#autoask").onchange = async (e) => { await saveUser({ autoask: e.target.checked }); toast("Gespeichert"); };
  bindTrakt();
  $("#share").onchange = async (e) => { await saveUser({ share: e.target.checked }); toast("Gespeichert"); };
  $("#notify").onchange = async (e) => { await saveUser({ notify: e.target.value || null }); toast("Gespeichert"); };
  $("#checknow").onclick = async () => { $("#checkres").innerHTML = '<span class="spin"></span>'; try { const r = await ws({ type: "filmtracker/check" }); $("#checkres").textContent = r.messages ? "✓ " + r.messages + " Meldung(en) geschickt" : "✓ Nichts Neues (beim ersten Mal wird nur der Stand gemerkt)"; } catch (e) { $("#checkres").textContent = "✗ " + errMsg(e); } };
  const ra = $("#resetabos"); if (ra) ra.onclick = async (e) => { e.preventDefault(); await saveUser({ abos: null }); S.prov = {}; viewSettings(); };
  if (u.is_admin) {
    $("#ki1").onchange = async (e) => { await saveSettings({ ki_primary: e.target.value || null }); toast("Gespeichert"); };
    $("#ki2").onchange = async (e) => { await saveSettings({ ki_fallback: e.target.value || null }); toast("Gespeichert"); };
    $("#testki").onclick = async () => { $("#kires").innerHTML = '<span class="spin"></span> (kann beim ersten Mal dauern)'; try { const r = await askAI("Antworte nur mit: OK, ich bin bereit."); $("#kires").textContent = "✓ " + r.model + ": " + r.text.slice(0, 80); } catch (err) { $("#kires").textContent = "✗ " + errMsg(err); } };
  }
  const mg = $("#migrate"); if (mg) mg.onclick = migrate;
  $("#imgo").onclick = doImport;
  $("#export").onclick = exportCSV;
  $$("[data-fsk]").forEach((sel) => (sel.onchange = async () => { try { await wsU({ type: "filmtracker/admin/user", uid: sel.dataset.fsk, max_fsk: sel.value === "" ? null : +sel.value }); toast("Gespeichert"); } catch (e) { toast("Fehler: " + errMsg(e)); } }));
  const sa = $("#saveapps"); if (sa) sa.onclick = async () => { const apps = {}; $$("[data-app]").forEach((i) => (apps[i.dataset.app] = i.value.trim())); try { await saveSettings({ apps }); toast("TV-Apps gespeichert"); } catch (e) { toast("Fehler: " + errMsg(e)); } };
  try {
    if (!S.providers) { const r = await tmdb("watch/providers/movie", { watch_region: "DE" }); S.providers = (r.results || []).sort((a, b) => ((a.display_priorities || {}).DE || 99) - ((b.display_priorities || {}).DE || 99)).slice(0, 45); }
    const mine = abos();
    $("#abos").innerHTML = S.providers.map((p) => '<label><input type="checkbox" value="' + p.provider_id + '"' + (mine.includes(p.provider_id) ? " checked" : "") + '><img src="' + IMG + "w92" + p.logo_path + '">' + esc(p.provider_name) + "</label>").join("");
    $$("#abos input").forEach((c) => (c.onchange = async () => {
      const ids = [...$$("#abos input:checked")].map((x) => +x.value);
      if (u.is_admin && !S.u.own_abos) await saveSettings({ abos: ids }); else await saveUser({ abos: ids });
      S.prov = {}; toast("Abos gespeichert");
    }));
  } catch (e) { $("#abos").textContent = "Fehler: " + errMsg(e); }
}

function traktCard(u) {
  const t = u.trakt || {};
  let h = '<div class="card"><h2 style="margin-top:0">🔗 Trakt</h2>';
  if (!t.configured) {
    h += '<div class="small muted">Trakt ist noch nicht eingerichtet.' + (u.is_admin ? ' Trag Client-ID und Client-Secret in den <a href="/config/integrations/integration/filmtracker" target="_top">Einstellungen der Integration</a> ein (⚙ → Konfigurieren).' : " Das macht der Admin in den Einstellungen der Integration.") + "</div>";
  } else if (!t.connected) {
    h += '<div class="small muted">Verbinde dein Trakt-Konto: Verlauf, Bewertungen und Watchlist werden dann in beide Richtungen abgeglichen (alle 6 Stunden).</div><button class="btn pri" id="tconnect" style="margin-top:8px">Mit Trakt verbinden</button><div id="tcode" style="margin-top:8px"></div>';
  } else {
    h += '<div class="small muted">✓ Verbunden' + (t.last_sync ? " · zuletzt abgeglichen " + new Date(t.last_sync).toLocaleString("de-DE") : "") + '</div><div class="row" style="margin-top:8px"><button class="btn" id="tsync">Jetzt abgleichen</button><button class="btn sm" id="tdis">Trennen</button><span id="tres" class="small muted"></span></div>';
  }
  return h + "</div>";
}
function bindTrakt() {
  const tc = $("#tconnect"); if (tc) tc.onclick = async () => {
    tc.disabled = true;
    try {
      const r = await ws({ type: "filmtracker/trakt/start" });
      $("#tcode").innerHTML = 'Öffne <a href="' + esc(r.url) + '" target="_blank">' + esc(r.url) + '</a> und gib diesen Code ein:<div style="font-size:26px;font-weight:700;letter-spacing:3px;margin:6px 0">' + esc(r.code) + '</div><span class="small muted"><span class="spin"></span> warte auf Bestätigung…</span>';
      for (let i = 0; i < 120; i++) { await new Promise((res) => setTimeout(res, 5000)); if (S.tab !== "settings") return; await loadData(); if (S.u.trakt && S.u.trakt.connected) { toast("✓ Mit Trakt verbunden – Abgleich läuft"); viewSettings(); return; } }
    } catch (e) { toast("Fehler: " + errMsg(e), 4000); tc.disabled = false; }
  };
  const sy = $("#tsync"); if (sy) sy.onclick = async () => { $("#tres").innerHTML = '<span class="spin"></span>'; try { const r = await ws({ type: "filmtracker/trakt/sync" }); await loadData(); $("#tres").textContent = "✓ " + r.neu + " neue Titel, " + r.folgen + " Folgen, " + r.bewertungen + " Bewertungen geholt · " + r.hochgeladen + " hochgeladen"; renderTabs(); } catch (e) { $("#tres").textContent = "✗ " + errMsg(e); } };
  const td = $("#tdis"); if (td) td.onclick = async () => { if (!confirm("Trakt-Verbindung trennen?")) return; await wsU({ type: "filmtracker/trakt/disconnect" }); viewSettings(); };
}

async function migrate() {
  const out = $("#migres"); out.innerHTML = '<span class="spin"></span>';
  try {
    const r = await ws({ type: "todo/item/list", entity_id: OLD_TODO }); const arr = []; let dis = [];
    for (const it of r.items || []) { let d; try { d = JSON.parse(it.description || "{}"); } catch (e) { continue; } if (it.summary === "__filmtracker_meta__") { dis = d.dismissed || []; continue; } if (d.tmdb && d.type) { delete d.avail; arr.push(d); } }
    await saveItems(arr, true);
    if (dis.length) await saveUser({ dismissed: [...new Set([...(S.u.dismissed || []), ...dis])] });
    out.textContent = "✓ " + arr.length + " Titel übernommen"; renderTabs();
  } catch (e) { out.textContent = "✗ " + errMsg(e); }
}

// ---------- Import ----------
function parseCSV(t) { const rows = []; let r = [], f = "", q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === "," || c === ";") { r.push(f); f = ""; } else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; } else if (c !== "\r") f += c; } if (f || r.length) { r.push(f); rows.push(r); } return rows.filter((r) => r.some((x) => x.trim())); }
async function doImport() {
  const file = $("#file").files[0]; let txt = $("#imtxt").value; if (file) txt = await file.text(); if (!txt.trim()) return;
  const list = $("#imlist").value; const out = $("#imres"); const rows = parseCSV(txt);
  const head = rows[0].map((h) => h.trim().toLowerCase()); const isCSV = rows.length > 1 && head.some((h) => /name|title|titel/.test(h));
  const col = (re) => head.findIndex((h) => re.test(h));
  const cName = isCSV ? col(/show_name|series_name|^title$|titel|movie_name|^name$|name/) : -1, cTvdb = isCSV ? col(/tvdb|tv_show_id|series_id/) : -1, cS = isCSV ? col(/season/) : -1, cE = isCSV ? col(/episode_number|^episode$|episode_num/) : -1;
  const isMovieFile = file && /movie|film/i.test(file.name);
  const groups = new Map();
  for (const r of isCSV ? rows.slice(1) : rows) {
    const name = (isCSV ? r[cName] || "" : r.join(" ")).trim(); if (!name) continue;
    const g = groups.get(name) || { name, tvdb: cTvdb >= 0 ? r[cTvdb] : null, eps: new Set() };
    if (cS >= 0 && cE >= 0 && r[cS] && r[cE]) g.eps.add(parseInt(r[cS]) + "x" + parseInt(r[cE]));
    groups.set(name, g);
  }
  const arr = [...groups.values()]; const fail = []; let done = 0;
  out.textContent = "0/" + arr.length + " …";
  const res = await pool(arr, 3, async (g) => {
    let type = isMovieFile ? "movie" : g.eps.size || g.tvdb ? "tv" : null, x = null;
    if (g.tvdb && /^\d+$/.test(g.tvdb) && !isMovieFile) { const f = await tmdb("find/" + g.tvdb, { external_source: "tvdb_id" }); x = (f.tv_results || [])[0]; if (x) type = "tv"; }
    if (!x) { const r = await tmdb(type ? "search/" + type : "search/multi", { query: g.name }); x = (r.results || []).find((z) => type || z.media_type === "movie" || z.media_type === "tv"); if (x && !type) type = x.media_type; }
    out.textContent = ++done + "/" + arr.length + " …";
    if (!x) { fail.push(g.name); return null; }
    const k = kOf(type, x.id); const d = S.items[k] ? JSON.parse(JSON.stringify(S.items[k])) : baseData(type, x);
    if (!d.list) d.list = g.eps.size ? "running" : list;
    if (g.eps.size) {
      d.eps = [...new Set([...(d.eps || []), ...g.eps])];
      try { const det = await tmdb("tv/" + x.id); const se = {}; (det.seasons || []).forEach((s) => { if (s.episode_count) se[s.season_number] = s.episode_count; }); d.seasons = se; if (!nextEp(d) && det.status && /Ended|Canceled/.test(det.status)) d.list = "seen"; } catch (e) {}
    }
    return d;
  });
  const ok = res.filter(Boolean);
  try { await saveItems(ok, true); } catch (e) { out.textContent = "✗ " + errMsg(e); return; }
  out.textContent = "✓ " + ok.length + " importiert" + (fail.length ? ", nicht gefunden: " + fail.slice(0, 10).join(", ") + (fail.length > 10 ? " …" : "") : "");
  renderTabs();
}

// ---------- Panel ----------
class FilmtrackerPanel extends HTMLElement {
  set hass(h) {
    H = h;
    if (this._menu) this._menu.hass = h;
    if (!this._started) { this._started = true; this._start(); }
    else if (this._ready) this._deepLink();
  }
  _deepLink() {
    const o = new URLSearchParams(location.search).get("open");
    if (!o || o === this._opened) return;
    this._opened = o; const [type, id] = o.split(":");
    if ((type === "tv" || type === "movie") && +id) openDetail(type, +id);
    if (o === "inbox" || o === "shared") { S.tab = o; render(); }
  }
  connectedCallback() { if (this._ready) { refreshShared().then(() => { if (!$("#modal").innerHTML) render(); }); this._opened = null; this._deepLink(); } }
  set narrow(n) { this._narrow = n; if (this._menu) this._menu.narrow = n; }
  set panel(p) { this._panel = p; }
  async _start() {
    ROOT = this.attachShadow({ mode: "open" });
    ROOT.innerHTML = "<style>" + CSS + '</style><div class="wrap"><header><div class="top"><span id="menu"></span><div class="title">Filme &amp; Serien</div><div class="who"></div></div><div class="tabs" id="tabs"></div></header><main id="main"><div class="empty"><span class="spin"></span> Lade…</div></main></div><div id="modal"></div>';
    this._menu = document.createElement("ha-menu-button");
    this._menu.hass = H; this._menu.narrow = this._narrow;
    $("#menu").appendChild(this._menu);
    try { await loadData(); } catch (e) { $("#main").innerHTML = '<div class="empty">Filmtracker-Integration nicht erreichbar: ' + esc(errMsg(e)) + "</div>"; return; }
    if ((S.u.inbox || []).length) S.tab = "inbox";
    render();
    this._ready = true; this._deepLink();
  }
}
if (!customElements.get("filmtracker-panel")) customElements.define("filmtracker-panel", FilmtrackerPanel);
