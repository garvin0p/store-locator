/**
 * Store Locator — shared scope for the composable locator blocks.
 *
 * A "Store Locator" section (.s_store_finder) contains independent blocks
 * placed freely with the Website editor: Store Search, Store Filter (one per
 * filter), Store List, Store Map... All blocks of the same section share one
 * FinderScope: a reactive state (Owl `reactive`) + the data loading logic.
 * Blocks only read/write the state, so they can be moved, duplicated or
 * removed without breaking each other.
 */
import { reactive } from "@odoo/owl";

export const LOCATION_ERRORS = {
    1: "Location access was denied. Enable it in your browser settings to see distances.",
    2: "Your location is currently unavailable. Please try again later.",
    3: "Locating you took too long. Please try again.",
};

/** Great-circle distance in kilometers (Haversine formula). */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 500 m / 1.2 km / 12 km */
export function formatDistance(km) {
    if (km === undefined || km === null || Number.isNaN(km)) {
        return "";
    }
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    if (km < 10) {
        return `${km.toFixed(1)} km`;
    }
    return `${Math.round(km)} km`;
}

export function readIds(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return (Array.isArray(parsed) ? parsed : [parsed])
            .map((item) => parseInt(typeof item === "object" ? item.id : item, 10))
            .filter((id) => id > 0);
    } catch {
        return String(value)
            .split(",")
            .map((part) => parseInt(part, 10))
            .filter((id) => id > 0);
    }
}

export function readBool(dataset, key, fallback = false) {
    const value = dataset[key];
    if (value === undefined || value === "") {
        return fallback;
    }
    return value === "true" || value === "1";
}

function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

const SCOPE_KEYS = ["categoryIds", "tagIds", "featuredOnly", "perPage", "order"];

function scopeKey(root) {
    return JSON.stringify(SCOPE_KEYS.map((key) => root.dataset[key] || ""));
}

const scopes = new WeakMap();

/** The locator section an element belongs to (or its section as fallback). */
export function getScopeRoot(el) {
    return (
        el.closest(".s_store_finder") ||
        el.closest("section") ||
        el.ownerDocument.body
    );
}

/** Shared scope of the locator section containing `el` (created on demand). */
export function getScope(el) {
    const root = getScopeRoot(el);
    const key = scopeKey(root);
    let scope = scopes.get(root);
    if (!scope || scope.key !== key) {
        scope = new FinderScope(root, key);
        scopes.set(root, scope);
    }
    return scope;
}

export class FinderScope {
    constructor(root, key) {
        this.root = root;
        this.key = key;
        const d = root.dataset;
        this.restrict = {
            categoryIds: readIds(d.categoryIds),
            tagIds: readIds(d.tagIds),
            featuredOnly: readBool(d, "featuredOnly"),
            perPage: Math.min(Math.max(parseInt(d.perPage, 10) || 0, 0), 48),
            order: d.order || "",
        };
        const url = new URL(window.location.href);
        this.state = reactive({
            ready: false,
            config: {},
            meta: { categories: [], countries: [], states: [], tags: [] },
            stores: [],
            total: 0,
            page: 1,
            hasMore: false,
            loading: false,
            error: "",
            // visitor filters
            search: url.searchParams.get("q") || "",
            categories: readIds(url.searchParams.get("category")),
            tags: [],
            country: 0,
            state: 0,
            zip: "",
            featured: false,
            open24: false,
            radius: 0,
            sortBy: "default",
            // geolocation / selection
            userLocation: null,
            locating: false,
            locationError: "",
            selectedId: null,
            selectSource: "",
            version: 0,
        });
        this.debouncedReload = debounce(() => this.load(false), 350);
        this.ready = this.bootstrap();
    }

    /** Query string shared by every request (block restrictions). */
    baseParams() {
        const params = new URLSearchParams();
        const r = this.restrict;
        if (r.categoryIds.length) {
            params.set("category_ids", r.categoryIds.join(","));
        }
        if (r.tagIds.length) {
            params.set("tag_ids", r.tagIds.join(","));
        }
        if (r.featuredOnly) {
            params.set("featured", "1");
        }
        if (r.order) {
            params.set("order", r.order);
        }
        return params;
    }

    get perPage() {
        return this.restrict.perPage || this.state.config.perPage || 12;
    }

    async bootstrap() {
        const params = this.baseParams();
        if (this.restrict.perPage) {
            params.set("limit", String(this.restrict.perPage));
        }
        try {
            const response = await fetch(`/store-locator/bootstrap?${params}`, {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            const s = this.state;
            s.config = data.config || {};
            s.meta = {
                categories: data.categories || [],
                countries: data.countries || [],
                states: data.states || [],
                tags: data.tags || [],
                hasOpen24: !!data.hasOpen24,
                hasFeatured: !!data.hasFeatured,
            };
            s.stores = data.stores || [];
            s.total = data.total || 0;
            s.page = data.page || 1;
            s.hasMore = !!data.hasMore;
            s.ready = true;
            if (s.search || s.categories.length) {
                await this.load(false);
            }
        } catch (error) {
            console.error("Store Locator:", error);
            this.state.error = "Unable to load the stores. Please check your connection and try again.";
            this.state.ready = true;
        }
    }

    queryParams(append) {
        const s = this.state;
        const params = this.baseParams();
        params.set("limit", String(this.perPage));
        if (append) {
            params.set("page", String(s.page));
        }
        if (s.search) {
            params.set("search", s.search);
        }
        if (s.categories.length) {
            params.set("category_filter", s.categories.join(","));
        }
        if (s.tags.length) {
            params.set("tag_filter", s.tags.join(","));
        }
        if (s.country) {
            params.set("country_id", String(s.country));
        }
        if (s.state) {
            params.set("state_id", String(s.state));
        }
        if (s.zip) {
            params.set("zip_code", s.zip);
        }
        if (s.featured) {
            params.set("featured", "1");
        }
        if (s.open24) {
            params.set("open24", "1");
        }
        return params;
    }

    async load(append = false) {
        const s = this.state;
        s.loading = true;
        s.error = "";
        try {
            const response = await fetch(`/store-locator/stores?${this.queryParams(append)}`, {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            s.stores = append ? [...s.stores, ...(data.stores || [])] : data.stores || [];
            s.total = data.total || 0;
            s.page = data.page || 1;
            s.hasMore = !!data.hasMore;
            if (s.selectedId && !s.stores.some((store) => store.id === s.selectedId)) {
                s.selectedId = null;
            }
        } catch {
            s.error = "Unable to load the stores. Please check your connection and try again.";
        } finally {
            s.loading = false;
            s.version++;
        }
    }

    /** Update one visitor filter and reload (debounced for typing). */
    setFilter(key, value, { debounce: slow = false } = {}) {
        this.state[key] = value;
        if (key === "country") {
            this.state.state = 0;
        }
        if (key === "radius" || key === "sortBy") {
            if (key === "radius" && value > 0 && !this.state.userLocation) {
                this.locate();
            }
            this.state.version++;
            return;
        }
        this.state.page = 1;
        if (slow) {
            this.debouncedReload();
        } else {
            this.load(false);
        }
    }

    toggleInList(key, id) {
        const list = [...this.state[key]];
        const index = list.indexOf(id);
        if (index >= 0) {
            list.splice(index, 1);
        } else {
            list.push(id);
        }
        this.setFilter(key, list);
    }

    clear() {
        Object.assign(this.state, {
            search: "",
            categories: [],
            tags: [],
            country: 0,
            state: 0,
            zip: "",
            featured: false,
            open24: false,
            radius: 0,
            page: 1,
        });
        this.load(false);
    }

    loadMore() {
        this.state.page += 1;
        return this.load(true);
    }

    select(id, source = "") {
        this.state.selectSource = source;
        this.state.selectedId = id;
    }

    locate() {
        const s = this.state;
        if (!navigator.geolocation) {
            s.locationError = "Your browser does not support geolocation.";
            return;
        }
        s.locating = true;
        s.locationError = "";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                s.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                s.locating = false;
                s.sortBy = "distance";
                s.version++;
            },
            (error) => {
                s.locating = false;
                s.locationError = LOCATION_ERRORS[error.code] || "Unable to retrieve your location.";
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
    }

    /** Stores after the client-side distance filter / sort. */
    visibleStores() {
        const s = this.state;
        let stores = s.stores.map((store) => ({ ...store }));
        if (s.userLocation && s.config.distance !== false) {
            for (const store of stores) {
                if (store.lat || store.lng) {
                    store.distance = haversineDistance(
                        s.userLocation.lat,
                        s.userLocation.lng,
                        store.lat,
                        store.lng
                    );
                    store.distanceLabel = formatDistance(store.distance);
                }
            }
            if (s.radius > 0) {
                stores = stores.filter(
                    (store) => store.distance !== undefined && store.distance <= s.radius
                );
            }
            if (s.sortBy === "distance") {
                stores.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
            }
        }
        if (s.sortBy === "name") {
            stores.sort((a, b) => a.name.localeCompare(b.name));
        }
        return stores;
    }

    get activeFilterCount() {
        const s = this.state;
        return (
            (s.search ? 1 : 0) +
            s.categories.length +
            s.tags.length +
            (s.country ? 1 : 0) +
            (s.state ? 1 : 0) +
            (s.zip ? 1 : 0) +
            (s.featured ? 1 : 0) +
            (s.open24 ? 1 : 0) +
            (s.radius ? 1 : 0)
        );
    }

    /** True when the section contains a list or a map (else search redirects). */
    get hasResults() {
        return !!this.root.querySelector(".s_sl_list, .s_sl_map, .s_store_locator_app");
    }
}
