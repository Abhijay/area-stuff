const TABS = [
  { status: "need", title: "Need", add: "Add something you need" },
  { status: "have", title: "Have", add: "Add something you have" },
];

const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const STYLE = `
  :host { display: block; padding: 16px; max-width: 900px; margin: 0 auto; color: var(--primary-text-color); box-sizing: border-box; }
  .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .toolbar h1 { font-size: 20px; font-weight: 400; margin: 0; flex: 1; }
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
  .card h2 + .row { border-top: 0; }
  .thumb { flex: none; width: 40px; height: 40px; border-radius: 6px; object-fit: contain; background: #fff; }
  .body { flex: 1; min-width: 0; cursor: pointer; }
  .name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
  .chip { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: var(--secondary-background-color); color: var(--secondary-text-color); margin-left: 6px; }
  .row select { max-width: 140px; }
  .edit { display: grid; grid-template-columns: 1fr 72px; gap: 8px; padding: 0 0 12px; }
  .edit .wide { grid-column: 1 / -1; }
  .edit .actions { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
  .empty { text-align: center; padding: 32px 0; }
  .error { color: var(--error-color); margin-bottom: 12px; }
  @media (max-width: 520px) { .row { flex-wrap: wrap; } .row select { max-width: none; flex: 1; } }
`;

class AreaStuffPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._status = "need";
    this._query = "";
    this._editing = null;
    this._confirming = null;
    this._data = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._start();
  }

  set narrow(value) { this._narrow = value; }

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
      this._data = await this._send({ type: "area_stuff/sections", status: this._query ? null : this._status, query: this._query });
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
    const chip = this._query ? `<span class="chip">${item.status === "need" ? "Need" : "Have"}</span>` : "";
    const thumb = item.image ? `<img class="thumb" src="${escape(item.image)}" alt="" loading="lazy">` : "";
    const primary = item.status === "need"
      ? `<button class="quiet" data-act="got" data-id="${item.id}">Got it</button>`
      : `<button class="quiet" data-act="need" data-id="${item.id}">Need</button>`;
    const remove = this._confirming === item.id
      ? `<button class="quiet danger" data-act="delete" data-id="${item.id}">Delete?</button>`
      : `<button class="quiet" data-act="confirm" data-id="${item.id}" title="Delete">✕</button>`;
    const row = `<div class="row">${thumb}
      <div class="body" data-act="edit" data-id="${item.id}"><div class="name">${escape(item.name)}${qty}${chip}</div>${item.note ? `<div class="muted">${escape(item.note)}</div>` : ""}</div>
      <select data-act="move" data-id="${item.id}" aria-label="Area">${this._areaOptions(item.area_id, "No area")}</select>
      ${primary}${remove}</div>`;
    if (this._editing !== item.id) return row;
    return row + `<div class="edit" data-form="${item.id}">
      <input name="name" value="${escape(item.name)}" aria-label="Name">
      <input name="quantity" type="number" min="1" value="${item.quantity}" aria-label="Quantity">
      <input class="wide" name="note" value="${escape(item.note)}" placeholder="Note, like which drawer" aria-label="Note">
      <input class="wide" name="link" value="${escape(item.link || "")}" placeholder="Link" aria-label="Link">
      <div class="actions">${item.link ? `<a href="${escape(item.link)}" target="_blank" rel="noopener"><button class="quiet">Open link</button></a>` : ""}<button class="quiet" data-act="cancel">Cancel</button><button data-act="save" data-id="${item.id}">Save</button></div>
    </div>`;
  }

  _render() {
    const data = this._data;
    const tab = TABS.find((t) => t.status === this._status);
    const focused = this.shadowRoot.activeElement;
    const keep = focused?.classList.contains("search") ? [focused.selectionStart, focused.selectionEnd] : null;
    const sections = data?.sections || [];
    const body = sections.length
      ? sections.map((s) => `<div class="card"><h2>${escape(s.name)}${s.floor ? `<span class="muted">${escape(s.floor)}</span>` : ""}</h2>${s.items.map((i) => this._row(i)).join("")}</div>`).join("")
      : `<div class="muted empty">${this._query ? "Nothing matches." : this._status === "need" ? "Nothing on the list." : "Nothing recorded yet."}</div>`;
    const tabs = TABS.map((t) => `<button class="${!this._query && t.status === this._status ? "active" : ""}" data-tab="${t.status}">${t.title}${data ? ` · ${data.counts[t.status]}` : ""}</button>`).join("");
    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <div class="toolbar"><h1>Stuff</h1></div>
      <input class="search" type="search" placeholder="Where's my…" value="${escape(this._query)}" aria-label="Search">
      <div class="tabs">${tabs}</div>
      ${this._error ? `<div class="error">${escape(this._error)}</div>` : ""}
      ${this._query ? "" : `<form class="add"><input name="name" placeholder="${escape(tab.add)}" aria-label="${escape(tab.add)}" autocomplete="off"><select name="area" aria-label="Area">${this._areaOptions(this._lastArea, "No area")}</select><button type="submit">Add</button></form>`}
      ${body}`;
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
    root.querySelector("form.add")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const name = form.name.value.trim();
      if (!name) return;
      this._lastArea = form.area.value || null;
      await this._run({ type: "area_stuff/add", name, status: this._status, area_id: this._lastArea });
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
      const value = (name) => form.querySelector(`[name=${name}]`).value;
      this._editing = null;
      return this._run({ type: "area_stuff/update", item_id: id, name: value("name"), quantity: Number(value("quantity")) || 1, note: value("note"), link: value("link") || null });
    }
  }
}

customElements.define("area-stuff-panel", AreaStuffPanel);
