/**
 * Store Locator — public Owl application (Odoo 19).
 *
 * Mounted through the Odoo 19 interactions framework:
 *   page template : <owl-component name="StoreLocator" props="..."/>
 *   registration  : registry.category("public_components")
 *
 * All data access goes through the public JSON API (/store-locator/stores);
 * no ORM logic ever runs in the browser.
 */
import { Component, useState, useRef, onMounted, onWillUnmount, onWillUpdateProps, onPatched } from "@odoo/owl";
import { registry } from "@web/core/registry";

import { LeafletEngine, GoogleEngine, loadGoogleMaps } from "./store_locator_map";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function debounce(func, wait) {
    let timeoutId = null;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), wait);
    };
}

/** Great-circle distance in kilometers (Haversine formula). */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Human readable distance: 500 m / 1.2 km / 12.4 km. */
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    if (km < 10) {
        return `${km.toFixed(1)} km`;
    }
    return `${Math.round(km)} km`;
}

const LOCATION_ERRORS = {
    1: "Location access was denied. Enable it in your browser settings to see distances.",
    2: "Your location is currently unavailable. Please try again later.",
    3: "Locating you took too long. Please try again.",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
let nextUid = 1;

export class FilterPanel extends Component {
    static template = "store_locator.FilterPanel";

    setup() {
        // Unique ids so several locator blocks can live on the same page.
        this.uid = nextUid++;
    }

    get radiusChoices() {
        const configured = parseInt(this.props.config.radius, 10) || 0;
        const choices = new Set([50, 25, 10, 5]);
        if (configured > 0) {
            choices.add(configured);
        }
        return [...choices].sort((a, b) => b - a);
    }

    onSearchInputDebounced() {
        this.props.onSearch();
    }
    onFilterChange() {
        this.props.onFilter();
    }
    onClear() {
        this.props.onClear();
    }
    onLocate() {
        this.props.onLocate();
    }
    onRadiusChange(ev) {
        const radius = parseInt(ev.target.value, 10) || 0;
        this.props.state.radius = radius;
        if (radius > 0 && !this.props.state.userLocation) {
            this.props.onLocate();
        }
    }

    /**
     * Handlers below are bound in `store_locator.FilterPanel` via string
     * form (t-on-change="onCountryChange" ...). All filtering logic lives
     * here instead of inline template expressions: Owl compiles template
     * expressions with the component as context (`ctx['name']`), so JS
     * globals such as `parseInt` are NOT reachable from templates — they
     * would throw "TypeError: v5 is not a function" at runtime.
     */
    onCategoryClick(category) {
        this.props.state.category =
            this.props.state.category === category.id ? 0 : category.id;
        this.onFilterChange();
    }
    onCountryChange(ev) {
        this.props.state.country = parseInt(ev.target.value, 10) || 0;
        this.props.state.state = 0;
        this.onFilterChange();
    }
    onStateChange(ev) {
        this.props.state.state = parseInt(ev.target.value, 10) || 0;
        this.onFilterChange();
    }
    onZipInput(ev) {
        this.props.state.zip = ev.target.value;
        this.onSearchInputDebounced(ev);
    }
    onFeaturedChange(ev) {
        this.props.state.featured = ev.target.checked;
        this.onFilterChange();
    }
}

export class StoreCard extends Component {
    static template = "store_locator.StoreCard";

    onClick() {
        this.props.onSelect(this.props.store.id);
    }
    onDirections(ev) {
        ev.stopPropagation();
        this.props.onDirections(this.props.store);
    }
    onKeydown(ev) {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.onClick();
        }
    }
}

export class StoreList extends Component {
    static template = "store_locator.StoreList";
    static components = { StoreCard };

    onLoadMore() {
        this.props.onLoadMore();
    }
}

export class StoreMap extends Component {
    static template = "store_locator.StoreMap";

    setup() {
        this.mapRef = useRef("map");
        this.engine = null;
        this.pending = null;

        onMounted(async () => {
            await this.startEngine();
        });
        onWillUpdateProps((nextProps) => {
            this.pending = nextProps;
        });
        onPatched(() => {
            if (this.engine && this.pending) {
                this.engine.setStores(this.pending.stores, this.pending.selectedStoreId);
                this.pending = null;
            }
        });
        onWillUnmount(() => {
            if (this.engine) {
                this.engine.destroy();
                this.engine = null;
            }
        });
    }

    async startEngine() {
        const config = this.props.config;
        if (config.provider === "google" && config.googleKey) {
            try {
                await loadGoogleMaps(config.googleKey);
                this.engine = new GoogleEngine(this.mapRef.el, config, {
                    onSelect: (id) => this.props.onSelect(id, { fromMap: true }),
                });
            } catch {
                console.warn("store_locator: Google Maps unavailable, falling back to OpenStreetMap.");
            }
        }
        if (!this.engine) {
            if (typeof L === "undefined") {
                console.warn("store_locator: Leaflet is not loaded, the map cannot be displayed.");
                return;
            }
            this.engine = new LeafletEngine(this.mapRef.el, config, {
                onSelect: (id) => this.props.onSelect(id, { fromMap: true }),
            });
        }
        this.engine.setStores(this.props.stores, this.props.selectedStoreId);
        const pending = this.pending;
        this.pending = null;
        if (pending) {
            this.engine.setStores(pending.stores, pending.selectedStoreId);
        }
    }
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
/** Display options of the block (set from the Website editor). */
export const DEFAULT_OPTIONS = {
    layout: "list-map", // list-map | map-list | map-top | list | map
    showSearch: true,
    showGeolocation: true,
    showFilters: true,
    filtersOpen: true,
    showCategories: true,
    showRegion: true,
    showZip: true,
    showRadius: true,
    showFeaturedToggle: true,
    showImages: true,
    showTags: true,
    showDetails: true,
    featuredOnly: false,
    categoryIds: [],
    searchPlaceholder: "",
    editMode: false,
};

export class StoreLocator extends Component {
    static template = "store_locator.StoreLocator";
    static components = { FilterPanel, StoreList, StoreMap };

    setup() {
        const props = this.props || {};
        this.options = { ...DEFAULT_OPTIONS, ...(props.options || {}) };
        this.config = props.config || {};

        this.state = useState({
            stores: props.stores || [],
            page: props.page || 1,
            total: props.total || 0,
            hasMore: !!props.hasMore,
            loading: false,
            error: "",
            search: "",
            category: 0,
            country: 0,
            state: 0,
            zip: "",
            featured: false,
            sortBy: "default",
            radius: 0,
            userLocation: null,
            locating: false,
            locationError: "",
            selectedStoreId: null,
        });

        this.debouncedSearch = debounce(
            () => this.loadStores(false),
            350
        );
        this.rootRef = useRef("root");
    }

    get showMap() {
        return this.options.layout !== "list";
    }

    get showList() {
        return this.options.layout !== "map";
    }

    get showFilterPanel() {
        const o = this.options;
        return (
            o.showFilters &&
            ((o.showCategories && (this.props.categories || []).length > 1) ||
                o.showRegion ||
                o.showZip ||
                (o.showRadius && this.config.distance) ||
                (o.showFeaturedToggle && !o.featuredOnly))
        );
    }

    get showToolbar() {
        return this.options.showSearch || (this.options.showGeolocation && this.config.geolocation);
    }

    get appClass() {
        return `sl-app sl-layout-${this.options.layout}` +
            (this.options.showImages ? "" : " sl-no-images") +
            (this.options.editMode ? " sl-edit-mode" : "");
    }

    get searchPlaceholder() {
        return this.options.searchPlaceholder || "Search by name, city, street or ZIP...";
    }

    // ----- derived state ---------------------------------------------------
    get filteredStores() {
        let stores = [...this.state.stores];
        if (this.state.userLocation && this.config.distance) {
            for (const store of stores) {
                store.distance = haversineDistance(
                    this.state.userLocation.lat, this.state.userLocation.lng,
                    store.lat, store.lng,
                );
                store.distanceLabel = formatDistance(store.distance);
            }
            if (this.state.radius > 0) {
                stores = stores.filter((store) => store.distance <= this.state.radius);
            }
            if (this.state.sortBy === "distance") {
                stores.sort((a, b) => a.distance - b.distance);
            }
        }
        return stores;
    }

    get resultLabel() {
        const count = this.filteredStores.length;
        if (this.state.total && this.state.total !== count) {
            return `${count} of ${this.state.total} stores`;
        }
        return `${count} ${count === 1 ? "store" : "stores"}`;
    }

    get states() {
        return (this.props.states || []).filter(
            (state) => !this.state.country || state.countryId === this.state.country,
        );
    }

    // ----- API -------------------------------------------------------------
    _buildQuery(appendPage) {
        const params = new URLSearchParams();
        if (appendPage) {
            params.set("page", String(this.state.page));
        }
        params.set("limit", String(this.config.perPage || 12));
        if (this.options.categoryIds.length) {
            params.set("category_ids", this.options.categoryIds.join(","));
        }
        if (this.state.search) {
            params.set("search", this.state.search);
        }
        if (this.state.category) {
            params.set("category_id", String(this.state.category));
        }
        if (this.state.country) {
            params.set("country_id", String(this.state.country));
        }
        if (this.state.state) {
            params.set("state_id", String(this.state.state));
        }
        if (this.state.zip) {
            params.set("zip_code", this.state.zip);
        }
        if (this.state.featured || this.options.featuredOnly) {
            params.set("featured", "1");
        }
        return params;
    }

    async loadStores(append = false) {
        this.state.loading = true;
        this.state.error = "";
        try {
            const response = await fetch(`/store-locator/stores?${this._buildQuery(append)}`, {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            this.state.stores = append
                ? [...this.state.stores, ...(data.stores || [])]
                : data.stores || [];
            this.state.total = data.total || 0;
            this.state.page = data.page || 1;
            this.state.hasMore = !!data.hasMore;
            if (
                this.state.selectedStoreId &&
                !this.state.stores.some((store) => store.id === this.state.selectedStoreId)
            ) {
                this.state.selectedStoreId = null;
            }
        } catch {
            this.state.error =
                "Unable to load the stores. Please check your connection and try again.";
        } finally {
            this.state.loading = false;
        }
    }

    // ----- handlers (public API of the component) --------------------------
    /**
     * Handler bound in the root template to the main search input
     * (`t-on-input="onSearchInput"`). Triggers the debounced live search.
     */
    onSearchInput(ev) {
        this.state.search = ev.target.value;
        this.debouncedSearch();
    }

    /**
     * Handler bound to the "Sort by" select (`t-on-change="onSortChange"`).
     * Kept as a component method for the same reason as the FilterPanel
     * handlers: template inline expressions cannot reach JS globals, and
     * string-form bindings always resolve against the component.
     */
    onSortChange(ev) {
        this.state.sortBy = ev.target.value;
    }

    searchStores() {
        this.debouncedSearch();
    }

    filterStores() {
        this.state.page = 1;
        this.loadStores(false);
    }

    clearFilters() {
        Object.assign(this.state, {
            search: "",
            category: 0,
            country: 0,
            state: 0,
            zip: "",
            featured: false,
            radius: 0,
            page: 1,
        });
        this.loadStores(false);
    }

    async loadMore() {
        this.state.page += 1;
        await this.loadStores(true);
    }

    selectStore(storeId, { fromMap = false } = {}) {
        this.state.selectedStoreId = storeId;
        if (!fromMap) {
            return;
        }
        // Selection originated from a marker: scroll the card into view.
        const card = this.rootRef.el?.querySelector(`[data-store-id="${storeId}"]`);
        if (card && card.scrollIntoView) {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    focusStore(storeId) {
        this.selectStore(storeId);
    }

    openDirections(store) {
        if (this.options.editMode) {
            return;
        }
        const destination = store.lat || store.lng ? `${store.lat},${store.lng}` : store.address;
        window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
            "_blank",
            "noopener,noreferrer",
        );
    }

    getUserLocation() {
        if (!navigator.geolocation) {
            this.state.locationError = "Your browser does not support geolocation.";
            return;
        }
        this.state.locating = true;
        this.state.locationError = "";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.state.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                this.state.locating = false;
                if (this.state.sortBy === "distance" || this.state.radius > 0) {
                    this.state.sortBy = "distance";
                }
            },
            (error) => {
                this.state.locating = false;
                this.state.locationError =
                    LOCATION_ERRORS[error.code] || "Unable to retrieve your location.";
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        );
    }

    calculateDistance(store) {
        if (!this.state.userLocation) {
            return null;
        }
        return haversineDistance(
            this.state.userLocation.lat, this.state.userLocation.lng,
            store.lat, store.lng,
        );
    }
}

registry.category("public_components").add("StoreLocator", StoreLocator);
