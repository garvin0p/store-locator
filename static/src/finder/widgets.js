/**
 * Store Locator — Owl widgets of the composable locator blocks.
 * Each widget receives the shared `scope` and its own `options` (read from the
 * block data-* attributes set in the Website editor).
 */
import { Component, onMounted, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";

import { LeafletEngine, GoogleEngine, loadGoogleMaps, escapeHtml } from "@store_locator/js/store_locator_map";
import { renderCard, getCardTemplate } from "./card_renderer";
import { formatDistance } from "./scope";

let uid = 1;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export class SearchWidget extends Component {
    static template = "store_locator.SearchWidget";
    static props = ["scope", "options", "editMode?"];

    setup() {
        this.state = useState(this.props.scope.state);
    }

    get o() {
        return this.props.options;
    }

    get geolocation() {
        return this.state.config.geolocation !== false;
    }

    onInput(ev) {
        const value = ev.target.value;
        if (this.props.scope.hasResults) {
            this.props.scope.setFilter("search", value, { debounce: true });
        } else {
            this.state.search = value;
        }
    }

    onClearSearch() {
        this.props.scope.setFilter("search", "");
    }

    onSubmit(ev) {
        ev.preventDefault();
        if (this.props.editMode) {
            return;
        }
        const scope = this.props.scope;
        if (!scope.hasResults) {
            // Standalone search box (e.g. on the homepage): open the locator page.
            const url = new URL(this.o.targetUrl || "/store-locator", window.location.origin);
            if (this.state.search) {
                url.searchParams.set("q", this.state.search);
            }
            window.location.href = url.href;
            return;
        }
        scope.load(false);
    }

    onLocate() {
        this.props.scope.locate();
    }

    onSort(ev) {
        this.props.scope.setFilter("sortBy", ev.target.value);
    }
}

// ---------------------------------------------------------------------------
// Filter (one block per filter)
// ---------------------------------------------------------------------------
const MULTI_KEYS = { category: "categories", tags: "tags" };

export class FilterWidget extends Component {
    static template = "store_locator.FilterWidget";
    static props = ["scope", "options", "editMode?", "blockEl?"];

    setup() {
        this.state = useState(this.props.scope.state);
        this.uid = uid++;
        onMounted(() => {
            // Clicking the (editable) label of a switch toggles it.
            const label = this.props.blockEl?.querySelector(".sl-filter-label");
            if (label && this.isBoolean && !this.props.editMode) {
                this.onLabelClick = () => this.toggleBool();
                label.addEventListener("click", this.onLabelClick);
            }
        });
        onWillUnmount(() => {
            const label = this.props.blockEl?.querySelector(".sl-filter-label");
            if (label && this.onLabelClick) {
                label.removeEventListener("click", this.onLabelClick);
            }
        });
    }

    get o() {
        return this.props.options;
    }

    get type() {
        return this.o.type;
    }

    get isBoolean() {
        return ["featured", "open24"].includes(this.type);
    }

    get display() {
        return this.o.display;
    }

    get choices() {
        const meta = this.state.meta;
        switch (this.type) {
            case "category":
                return meta.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
            case "tags":
                return meta.tags.map((t) => ({ id: t.id, name: t.name }));
            case "country":
                return meta.countries.map((c) => ({ id: c.id, name: c.name }));
            case "state":
                return meta.states
                    .filter((st) => !this.state.country || st.countryId === this.state.country)
                    .map((st) => ({ id: st.id, name: st.name }));
            case "radius": {
                const configured = parseInt(this.state.config.radius, 10) || 0;
                const set = new Set([5, 10, 25, 50, 100]);
                if (configured > 0) {
                    set.add(configured);
                }
                return [...set].sort((a, b) => a - b).map((km) => ({ id: km, name: `${km} km` }));
            }
            case "sort":
                return [
                    { id: "default", name: "Recommended" },
                    { id: "name", name: "Name (A-Z)" },
                    ...(this.state.userLocation ? [{ id: "distance", name: "Nearest first" }] : []),
                ];
            default:
                return [];
        }
    }

    get stateKey() {
        return MULTI_KEYS[this.type] || { country: "country", state: "state", radius: "radius", sort: "sortBy" }[this.type];
    }

    isActive(choice) {
        const key = this.stateKey;
        const value = this.state[key];
        return Array.isArray(value) ? value.includes(choice.id) : value === choice.id;
    }

    /** select | options (radio / checkbox list) | chips */
    get mode() {
        const d = this.display;
        if (d === "select") {
            return "select";
        }
        if (d === "radio" || d === "checkbox") {
            return "options";
        }
        if (d === "chips") {
            return "chips";
        }
        // defaults per filter type
        return ["country", "state", "radius", "sort"].includes(this.type) ? "select" : "chips";
    }

    get isMulti() {
        return !!MULTI_KEYS[this.type] && ["chips", "checkbox"].includes(this.display);
    }

    onChoice(choice) {
        const key = this.stateKey;
        if (this.isMulti) {
            this.props.scope.toggleInList(key, choice.id);
        } else if (MULTI_KEYS[this.type]) {
            const current = this.state[key];
            const next = current.length === 1 && current[0] === choice.id ? [] : [choice.id];
            this.props.scope.setFilter(key, next);
        } else {
            const current = this.state[key];
            const empty = key === "sortBy" ? "default" : 0;
            this.props.scope.setFilter(key, current === choice.id ? empty : choice.id);
        }
    }

    onSelect(ev) {
        const raw = ev.target.value;
        const key = this.stateKey;
        if (MULTI_KEYS[this.type]) {
            const id = parseInt(raw, 10);
            this.props.scope.setFilter(key, id ? [id] : []);
        } else if (key === "sortBy") {
            this.props.scope.setFilter(key, raw || "default");
        } else {
            this.props.scope.setFilter(key, parseInt(raw, 10) || 0);
        }
    }

    get selectValue() {
        const value = this.state[this.stateKey];
        if (Array.isArray(value)) {
            return value.length ? String(value[0]) : "";
        }
        return value ? String(value) : "";
    }

    get boolValue() {
        return !!this.state[this.type];
    }

    toggleBool() {
        this.props.scope.setFilter(this.type, !this.state[this.type]);
    }

    onZip(ev) {
        this.props.scope.setFilter("zip", ev.target.value, { debounce: true });
    }

    onClear() {
        this.props.scope.clear();
    }

    get activeCount() {
        // Read through the component state so the widget re-renders.
        const s = this.state;
        return (
            (s.search ? 1 : 0) + s.categories.length + s.tags.length + (s.country ? 1 : 0) +
            (s.state ? 1 : 0) + (s.zip ? 1 : 0) + (s.featured ? 1 : 0) + (s.open24 ? 1 : 0) +
            (s.radius ? 1 : 0)
        );
    }

    get countLabel() {
        void this.state.version;
        void this.state.stores;
        const n = this.props.scope.visibleStores().length;
        const total = this.state.total;
        const noun = n === 1 ? this.o.singular || "store" : this.o.plural || "stores";
        return total && total !== n ? `${n} of ${total} ${noun}` : `${n} ${noun}`;
    }

    get allLabel() {
        return this.o.allLabel || "All";
    }

    get stateDisabled() {
        return this.type === "state" && !this.state.country && this.o.stateNeedsCountry !== false;
    }
}

// ---------------------------------------------------------------------------
// Store list (cards built from the editable card template)
// ---------------------------------------------------------------------------
export class ListWidget extends Component {
    static template = "store_locator.ListWidget";
    static props = ["scope", "options", "blockEl", "editMode?"];

    setup() {
        this.state = useState(this.props.scope.state);
        this.cardsRef = useRef("cards");
        useEffect(
            () => this.renderCards(),
            () => [
                this.state.version,
                this.state.stores,
                this.state.selectedId,
                this.state.userLocation,
                this.state.radius,
                this.state.sortBy,
            ]
        );
    }

    get o() {
        return this.props.options;
    }

    get stores() {
        // Subscribe to the values used by visibleStores()
        void this.state.version;
        void this.state.stores;
        void this.state.radius;
        void this.state.sortBy;
        void this.state.userLocation;
        return this.props.scope.visibleStores();
    }

    get countText() {
        const n = this.stores.length;
        const total = this.state.total;
        const noun = n === 1 ? "store" : "stores";
        return total && total !== n ? `${n} of ${total} ${noun}` : `${n} ${noun}`;
    }

    renderCards() {
        const container = this.cardsRef.el;
        if (!container) {
            return;
        }
        const template = getCardTemplate(this.props.blockEl);
        const scope = this.props.scope;
        const cards = this.stores.map((store) =>
            renderCard(template, store, {
                selected: store.id === this.state.selectedId,
                editMode: this.props.editMode,
                defaultClick: "select",
                onSelect: (s) => scope.select(s.id, "list"),
            })
        );
        container.replaceChildren(...cards);
        if (this.state.selectedId && this.state.selectSource === "map") {
            const card = container.querySelector(`[data-store-id="${this.state.selectedId}"]`);
            card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    onLoadMore() {
        this.props.scope.loadMore();
    }
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
export class MapWidget extends Component {
    static template = "store_locator.MapWidget";
    static props = ["scope", "options", "editMode?"];

    setup() {
        this.state = useState(this.props.scope.state);
        this.mapRef = useRef("map");
        this.engine = null;
        onMounted(() => this.start());
        useEffect(
            () => {
                if (this.engine) {
                    this.engine.setStores(this.props.scope.visibleStores(), this.state.selectedId);
                }
            },
            () => [this.state.version, this.state.stores, this.state.selectedId, this.state.radius, this.state.ready]
        );
        onWillUnmount(() => {
            this.engine?.destroy();
            this.engine = null;
        });
    }

    get o() {
        return this.props.options;
    }

    popupHtml(store) {
        const f = this.o.popupFields;
        if (!f.length) {
            return "";
        }
        const parts = [];
        if (f.includes("image") && store.imageUrl) {
            parts.push(`<img class="sl-pop-img" src="${escapeHtml(store.imageUrl)}" alt=""/>`);
        }
        parts.push('<div class="sl-pop-body">');
        if (f.includes("category") && store.category) {
            parts.push(`<div class="sl-pop-cat">${escapeHtml(store.category)}</div>`);
        }
        if (f.includes("name")) {
            parts.push(`<div class="sl-pop-name">${escapeHtml(store.name)}</div>`);
        }
        if (f.includes("address") && store.address) {
            parts.push(`<div class="sl-pop-line"><i class="fa fa-map-marker"></i> ${escapeHtml(store.address)}</div>`);
        }
        if (f.includes("phone") && store.phone) {
            parts.push(`<div class="sl-pop-line"><i class="fa fa-phone"></i> <a href="tel:${escapeHtml(store.phone)}">${escapeHtml(store.phone)}</a></div>`);
        }
        if (f.includes("hours")) {
            const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
            const line = store.is24Hours ? "Open 24/7" : (store.hours || []).find((h) => h.day === today)?.hours;
            if (line) {
                parts.push(`<div class="sl-pop-line"><i class="fa fa-clock-o"></i> Today: ${escapeHtml(line)}</div>`);
            }
        }
        if (f.includes("distance") && store.distance !== undefined) {
            parts.push(`<div class="sl-pop-dist">${escapeHtml(formatDistance(store.distance))} away</div>`);
        }
        const links = [];
        if (f.includes("detail") && store.detailUrl) {
            links.push(`<a class="sl-pop-btn" href="${escapeHtml(store.detailUrl)}">${escapeHtml(this.o.detailLabel || "View details")}</a>`);
        }
        if (f.includes("directions") && (store.lat || store.lng)) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
            links.push(`<a class="sl-pop-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(this.o.directionsLabel || "Directions")}</a>`);
        }
        if (links.length) {
            parts.push(`<div class="sl-pop-actions">${links.join("")}</div>`);
        }
        parts.push("</div>");
        return `<div class="sl-map-popup sl-pop">${parts.join("")}</div>`;
    }

    async start() {
        await this.props.scope.ready;
        const el = this.mapRef.el;
        if (!el) {
            return;
        }
        const config = this.state.config;
        const options = {
            onSelect: (id) => this.props.scope.select(id, "map"),
            markerStyle: this.o.markerStyle,
            markerSize: this.o.markerSize,
            tiles: this.o.tiles,
            scrollZoom: this.o.scrollZoom,
            popup: (store) => this.popupHtml(store),
            fitMaxZoom: this.o.fitMaxZoom,
        };
        if (config.provider === "google" && config.googleKey) {
            try {
                await loadGoogleMaps(config.googleKey);
                this.engine = new GoogleEngine(el, config, options);
            } catch {
                console.warn("store_locator: Google Maps unavailable, falling back to OpenStreetMap.");
            }
        }
        if (!this.engine) {
            if (typeof L === "undefined") {
                return;
            }
            this.engine = new LeafletEngine(el, config, options);
        }
        this.engine.setStores(this.props.scope.visibleStores(), this.state.selectedId);
    }
}
