const TABS = [
  { status: "need", title: "Shopping List", add: "Add something you need" },
  { status: "have", title: "Inventory", add: "Add something you have" },
];

const DETAILS = [
  { key: "manufacturer", label: "Manufacturer" },
  { key: "model_number", label: "Model number" },
  { key: "serial_number", label: "Serial number" },
  { key: "purchase_from", label: "Purchased from" },
  { key: "purchase_date", label: "Purchase date", type: "date" },
  { key: "purchase_price", label: "Price", type: "number" },
  { key: "warranty_expires", label: "Warranty expires", type: "date" },
];
const FLAGS = [
  { key: "lifetime_warranty", label: "Lifetime warranty" },
  { key: "insured", label: "Insured" },
];

const UNSORTED = { need: "Anywhere", have: "To sort" };

const money = (value) => (value == null ? "" : value.toLocaleString(undefined, { style: "currency", currency: "USD" }));
const shortDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

function warranty(item) {
  if (item.lifetime_warranty) return "Lifetime warranty";
  if (!item.warranty_expires) return "";
  const expired = item.warranty_expires < new Date().toISOString().slice(0, 10);
  return `${expired ? "Warranty ended" : "Warranty until"} ${shortDate(item.warranty_expires)}`;
}

const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const STYLE = `
  :host { display: grid; grid-template-columns: 240px minmax(0, 1fr); height: 100vh; color: var(--primary-text-color); background: var(--primary-background-color); }
  nav { overflow-y: auto; border-right: 1px solid var(--divider-color); background: var(--card-background-color); padding: 8px 0 16px; box-sizing: border-box; }
  nav .brand { display: flex; align-items: center; gap: 4px; font-size: 20px; padding: 8px 16px 12px; }
  nav .brand ha-menu-button { margin: -8px 0 -8px -12px; }
  nav h3 { margin: 16px 16px 4px; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
  nav a { display: flex; align-items: center; gap: 8px; margin: 1px 8px; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 14px; color: inherit; text-decoration: none; }
  nav a:hover { background: var(--secondary-background-color); }
  nav a.active { background: rgba(var(--rgb-primary-color), 0.15); color: var(--primary-color); font-weight: 500; }
  nav a .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  nav a .count { font-size: 12px; color: var(--secondary-text-color); }
  nav a.zero .label { color: var(--secondary-text-color); }
  main { overflow-y: auto; padding: 16px 24px; box-sizing: border-box; }
  .content { max-width: 800px; margin: 0 auto; }
  .toolbar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .toolbar h1 { font-size: 22px; font-weight: 400; margin: 0; flex: 1; }
  input, select { font: inherit; color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px 10px; min-width: 0; }
  .search { width: 100%; box-sizing: border-box; margin-bottom: 12px; font-size: 16px; }
  .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .tabs button { flex: 1; background: var(--secondary-background-color); color: var(--primary-text-color); }
  .tabs button.active { background: var(--primary-color); color: var(--text-primary-color); }
  button { background: var(--primary-color); color: var(--text-primary-color); border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; white-space: nowrap; }
  button.quiet { background: transparent; color: var(--secondary-text-color); padding: 6px 8px; }
  button.quiet.danger { color: var(--error-color); }
  .add { display: flex; gap: 8px; margin-bottom: 16px; }
  .add input { flex: 1; }
  .card { background: var(--card-background-color); border-radius: var(--ha-card-border-radius, 12px); box-shadow: var(--ha-card-box-shadow, none); border: 1px solid var(--divider-color); padding: 4px 16px; margin-bottom: 12px; }
  .card h2 { margin: 12px 0 4px; font-size: 15px; font-weight: 500; display: flex; align-items: baseline; gap: 8px; }
  .card h2 .muted { font-weight: 400; }
  .muted { color: var(--secondary-text-color); font-size: 13px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--divider-color); }
  .card > .row:first-child, .card h2 + .row { border-top: 0; }
  .thumb { flex: none; width: 40px; height: 40px; border-radius: 6px; object-fit: contain; background: #fff; }
  .body { flex: 1; min-width: 0; cursor: pointer; }
  .name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
  .chip { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: var(--secondary-background-color); color: var(--secondary-text-color); margin-left: 6px; }
  .row select { max-width: 140px; }
  .edit { display: grid; grid-template-columns: 1fr 72px; gap: 8px; padding: 0 0 12px; }
  .edit .wide { grid-column: 1 / -1; }
  .edit fieldset { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; border: 1px solid var(--divider-color); border-radius: 8px; margin: 0; padding: 8px 12px 12px; }
  .edit legend { padding: 0 4px; font-size: 13px; color: var(--secondary-text-color); }
  .edit label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
  .edit label.check { flex-direction: row; align-items: center; gap: 8px; font-size: 14px; color: var(--primary-text-color); }
  .tag { font-size: 11px; padding: 1px 6px; border-radius: 8px; border: 1px solid var(--divider-color); color: var(--secondary-text-color); margin-right: 4px; }
  .edit .actions { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
  .empty { text-align: center; padding: 32px 0; }
  .error { color: var(--error-color); margin-bottom: 12px; }
  :host([narrow]) { display: block; height: auto; }
  :host([narrow]) nav { display: flex; align-items: center; gap: 4px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--divider-color); padding: 4px 8px; position: sticky; top: 0; z-index: 1; }
  :host([narrow]) nav .brand { padding: 0 8px 0 0; font-size: 0; }
  :host([narrow]) nav h3 { display: none; }
  :host([narrow]) nav a { flex: none; margin: 0; padding: 6px 10px; }
  :host([narrow]) main { overflow: visible; padding: 12px 16px; }
  @media (max-width: 520px) { .row { flex-wrap: wrap; } .row select { max-width: none; flex: 1; } }
`;

class AreaStuffPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._status = "need";
    this._query = "";
    this._area = "all";
    this._editing = null;
    this._confirming = null;
    this._data = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._start();
  }

  set narrow(value) {
    this._narrow = value;
    this.toggleAttribute("narrow", Boolean(value));
    if (this._data) this._render();
  }

  disconnectedCallback() {
    this._unsubscribe?.then((off) => off());
    this._unsubscribe = null;
    this._started = false;
  }

  connectedCallback() {
    if (this._hass && !this._started) this._start();
  }

  _start() {
    this._started = true;
    this._unsubscribe = this._hass.connection.subscribeMessage(() => this._load(), { type: "area_stuff/subscribe" });
    this._load();
  }

  _send(message) {
    return this._hass.connection.sendMessagePromise(message);
  }

  async _load() {
    try {
      this._data = await this._send({ type: "area_stuff/sections", status: this._query ? null : this._status, query: this._query, area: this._query ? "all" : this._area });
      this._error = null;
    } catch (err) {
      this._error = err.message || String(err);
    }
    this._render();
  }

  async _run(message) {
    try {
      await this._send(message);
      this._error = null;
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
    }
  }

  _areaOptions(selected, empty) {
    const areas = this._data?.areas || [];
    return `<option value="">${escape(empty)}</option>` + areas.map((a) => `<option value="${escape(a.id)}" ${a.id === selected ? "selected" : ""}>${escape(a.name)}</option>`).join("");
  }

  _row(item) {
    const qty = item.quantity > 1 ? ` <span class="muted">×${item.quantity}</span>` : "";
    const chip = this._query ? `<span class="chip">${item.status === "need" ? "Shopping List" : "Inventory"}</span>` : "";
    const thumb = item.image ? `<img class="thumb" src="${escape(item.image)}" alt="" loading="lazy">` : "";
    const primary = item.status === "need"
      ? `<button class="quiet" data-act="got" data-id="${item.id}">Got it</button>`
      : `<button class="quiet" data-act="need" data-id="${item.id}">Need</button>`;
    const remove = this._confirming === item.id
      ? `<button class="quiet danger" data-act="delete" data-id="${item.id}">Delete?</button>`
      : `<button class="quiet" data-act="confirm" data-id="${item.id}" title="Delete">✕</button>`;
    const meta = item.status === "have"
      ? [[item.manufacturer, item.model_number].filter(Boolean).join(" "), money(item.purchase_price), item.purchase_from, warranty(item), item.insured ? "Insured" : ""].filter(Boolean).map(escape).join(" · ")
      : "";
    const tags = item.tags.length ? `<div>${item.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join("")}</div>` : "";
    const row = `<div class="row">${thumb}
      <div class="body" data-act="edit" data-id="${item.id}"><div class="name">${escape(item.name)}${qty}${chip}</div>${item.note ? `<div class="muted">${escape(item.note)}</div>` : ""}${meta ? `<div class="muted">${meta}</div>` : ""}${tags}</div>
      <select data-act="move" data-id="${item.id}" aria-label="Area">${this._areaOptions(item.area_id, "No area")}</select>
      ${primary}${remove}</div>`;
    if (this._editing !== item.id) return row;
    return row + `<div class="edit" data-form="${item.id}">
      <input name="name" value="${escape(item.name)}" aria-label="Name">
      <input name="quantity" type="number" min="1" value="${item.quantity}" aria-label="Quantity">
      <input class="wide" name="note" value="${escape(item.note)}" placeholder="Note, like which drawer" aria-label="Note">
      <input class="wide" name="link" value="${escape(item.link || "")}" placeholder="Link" aria-label="Link">
      <input class="wide" name="tags" value="${escape(item.tags.join(", "))}" placeholder="Tags, separated by commas" aria-label="Tags">
      ${item.status === "have" ? this._details(item) : ""}
      <div class="actions">${item.link ? `<a href="${escape(item.link)}" target="_blank" rel="noopener"><button class="quiet">Open link</button></a>` : ""}<button class="quiet" data-act="cancel">Cancel</button><button data-act="save" data-id="${item.id}">Save</button></div>
    </div>`;
  }

  _areaTitle() {
    if (this._query) return "Search";
    if (this._area === "all") return "All stuff";
    if (this._area === "none") return UNSORTED[this._status];
    return this._data?.areas.find((a) => a.id === this._area)?.name ?? "";
  }

  _navLink(area, label, counts) {
    const count = counts?.[this._status] || 0;
    const active = !this._query && this._area === area;
    return `<a class="${active ? "active" : ""} ${count ? "" : "zero"}" data-area="${escape(area)}"><span class="label">${escape(label)}</span>${count ? `<span class="count">${count}</span>` : ""}</a>`;
  }

  _nav() {
    const nav = this._data?.nav;
    if (!nav) return "";
    const floors = nav.floors.map((f) => (f.name ? `<h3>${escape(f.name)}</h3>` : nav.floors.length > 1 ? "<h3>Other areas</h3>" : "")
      + f.areas.map((a) => this._navLink(a.id, a.name, a)).join("")).join("");
    return this._navLink("all", "All stuff", nav.all) + this._navLink("none", UNSORTED[this._status], nav.none) + floors;
  }

  _details(item) {
    const inputs = DETAILS.map((d) => `<label>${d.label}<input name="${d.key}" type="${d.type || "text"}" ${d.type === "number" ? 'min="0" step="0.01"' : ""} value="${escape(item[d.key] ?? "")}"></label>`).join("");
    const flags = FLAGS.map((f) => `<label class="check"><input name="${f.key}" type="checkbox" ${item[f.key] ? "checked" : ""}>${f.label}</label>`).join("");
    return `<fieldset><legend>Details</legend>${inputs}${flags}</fieldset>`;
  }

  _render() {
    const data = this._data;
    const tab = TABS.find((t) => t.status === this._status);
    const focused = this.shadowRoot.activeElement;
    const keep = focused?.classList.contains("search") ? [focused.selectionStart, focused.selectionEnd] : null;
    const sections = data?.sections || [];
    const single = !this._query && this._area !== "all";
    const card = (s) => `<div class="card">${single ? "" : `<h2>${escape(s.name)}${s.floor ? `<span class="muted">${escape(s.floor)}</span>` : ""}</h2>`}${s.items.map((i) => this._row(i)).join("")}</div>`;
    const body = sections.length
      ? sections.map(card).join("")
      : `<div class="muted empty">${this._query ? "Nothing matches." : this._status === "need" ? "Nothing on the list." : "Nothing recorded yet."}</div>`;
    const tabs = TABS.map((t) => `<button class="${!this._query && t.status === this._status ? "active" : ""}" data-tab="${t.status}">${t.title}${data ? ` · ${data.counts[t.status]}` : ""}</button>`).join("");
    const addArea = single ? (this._area === "none" ? null : this._area) : this._lastArea;
    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <nav><div class="brand">Stuff</div>${this._nav()}</nav>
      <main><div class="content">
        <div class="toolbar"><h1>${escape(this._areaTitle())}</h1></div>
        <input class="search" type="search" placeholder="Where's my…" value="${escape(this._query)}" aria-label="Search">
        <div class="tabs">${tabs}</div>
        ${this._error ? `<div class="error">${escape(this._error)}</div>` : ""}
        ${this._query ? "" : `<form class="add"><input name="name" placeholder="${escape(tab.add)}" aria-label="${escape(tab.add)}" autocomplete="off"><select name="area" aria-label="Area">${this._areaOptions(addArea, "No area")}</select><button type="submit">Add</button></form>`}
        ${body}
      </div></main>`;
    // Custom panels get no app header, so phones need HA's own sidebar toggle.
    if (this._narrow) {
      const menu = document.createElement("ha-menu-button");
      menu.hass = this._hass;
      menu.narrow = true;
      this.shadowRoot.querySelector(".brand").prepend(menu);
    }
    if (keep) {
      const search = this.shadowRoot.querySelector(".search");
      search.focus();
      search.setSelectionRange(...keep);
    }
    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    root.querySelector(".search").addEventListener("input", (e) => {
      this._query = e.target.value.trim();
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => this._load(), 150);
    });
    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      this._status = b.dataset.tab;
      this._query = "";
      this._editing = null;
      this._load();
    }));
    root.querySelectorAll("[data-area]").forEach((a) => a.addEventListener("click", () => {
      this._area = a.dataset.area;
      this._query = "";
      this._editing = null;
      this._load();
    }));
    root.querySelector("form.add")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const name = form.name.value.trim();
      if (!name) return;
      const areaId = form.area.value || null;
      if (this._area === "all") this._lastArea = areaId;
      await this._run({ type: "area_stuff/add", name, status: this._status, area_id: areaId });
      root.querySelector("form.add input[name=name]")?.focus();
    });
    root.querySelectorAll("select[data-act=move]").forEach((s) => s.addEventListener("change", () => this._run({ type: "area_stuff/update", item_id: s.dataset.id, area_id: s.value || null })));
    root.querySelectorAll("[data-act]:not(select)").forEach((el) => el.addEventListener("click", () => this._act(el.dataset.act, el.dataset.id)));
  }

  _act(act, id) {
    if (act === "got") return this._run({ type: "area_stuff/update", item_id: id, status: "have" });
    if (act === "need") return this._run({ type: "area_stuff/update", item_id: id, status: "need" });
    if (act === "delete") { this._confirming = null; return this._run({ type: "area_stuff/remove", item_ids: [id] }); }
    if (act === "confirm") { this._confirming = id; return this._render(); }
    if (act === "edit") { this._editing = this._editing === id ? null : id; this._confirming = null; return this._render(); }
    if (act === "cancel") { this._editing = null; return this._render(); }
    if (act === "save") {
      const form = this.shadowRoot.querySelector(`[data-form="${id}"]`);
      const field = (name) => form.querySelector(`[name=${name}]`);
      const value = (name) => field(name).value;
      const changes = { name: value("name"), quantity: Number(value("quantity")) || 1, note: value("note"), link: value("link") || null, tags: value("tags").split(",") };
      if (field("manufacturer")) {
        for (const d of DETAILS) changes[d.key] = d.type === "number" ? (value(d.key) === "" ? null : Number(value(d.key))) : value(d.key) || null;
        for (const f of FLAGS) changes[f.key] = field(f.key).checked;
      }
      this._editing = null;
      return this._run({ type: "area_stuff/update", item_id: id, ...changes });
    }
  }
}

customElements.define("area-stuff-panel", AreaStuffPanel);
