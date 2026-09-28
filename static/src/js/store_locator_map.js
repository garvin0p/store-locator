/**
 * Store Locator — map engines.
 *
 * Provides a small engine abstraction used by the StoreMap Owl component:
 *  - LeafletEngine  : OpenStreetMap tiles via Leaflet (default, no API key)
 *  - GoogleEngine   : Google Maps JS API (optional, requires a configured key)
 *
 * Both engines expose: setStores(stores, selectedId), destroy().
 * Markers are custom SVG pins; clicking a marker notifies the component.
 */

const PIN_SVG = (fill) => `
    <svg viewBox="0 0 30 40" width="30" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="${fill}" stroke="#ffffff" stroke-width="2"
              d="M15 1C8 1 2.5 6.5 2.5 13.5c0 9.2 11 22.5 11.5 23.2.5.6 1.5.6 2 0 .5-.7 11.5-14 11.5-23.2C27.5 6.5 22 1 15 1z"/>
        <circle cx="15" cy="13.5" r="5" fill="#ffffff"/>
    </svg>`;

const LEAFLET_FILL = '#2563eb';
const LEAFLET_FILL_SELECTED = '#e11d48';
const LEAFLET_FILL_FEATURED = '#f59e0b';

/**
 * Marker colors follow the block colors chosen in the Website editor
 * (CSS custom properties --sl-primary / --sl-accent / --sl-danger).
 */
function readPalette(el) {
    const style = window.getComputedStyle(el);
    const read = (name, fallback) => (style.getPropertyValue(name) || '').trim() || fallback;
    return {
        normal: read('--sl-marker', read('--sl-primary', LEAFLET_FILL)),
        featured: read('--sl-marker-featured', read('--sl-accent', LEAFLET_FILL_FEATURED)),
        selected: read('--sl-marker-selected', read('--sl-danger', LEAFLET_FILL_SELECTED)),
    };
}

export function escapeHtml(text) {
    if (!text) {
        return '';
    }
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Lazily load the Google Maps JS API and resolve with `google.maps`.
 */
let googleMapsPromise = null;
export function loadGoogleMaps(apiKey) {
    if (window.google && window.google.maps) {
        return Promise.resolve(window.google.maps);
    }
    if (!googleMapsPromise) {
        googleMapsPromise = new Promise((resolve, reject) => {
            const callbackName = 'storeLocatorGoogleMapsReady';
            window[callbackName] = () => resolve(window.google.maps);
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&loading=async`;
            script.async = true;
            script.onerror = () => reject(new Error('Google Maps failed to load'));
            document.head.appendChild(script);
            setTimeout(() => reject(new Error('Google Maps timed out')), 10000);
        }).catch((error) => {
            googleMapsPromise = null;
            throw error;
        });
    }
    return googleMapsPromise;
}

// ---------------------------------------------------------------------------
// Leaflet / OpenStreetMap engine
// ---------------------------------------------------------------------------
export const TILE_LAYERS = {
    osm: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
    },
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        maxZoom: 20,
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        maxZoom: 20,
    },
    voyager: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        maxZoom: 20,
    },
};

const MARKER_SIZES = { small: 24, medium: 32, large: 42 };

/**
 * Marker HTML for the CSS-driven styles. Colors come from the CSS custom
 * properties of the map block (--sl-marker, --sl-marker-featured,
 * --sl-marker-selected), so they follow the Website editor options.
 */
function markerHtml(store, style, selected) {
    const cls = `sl-mk sl-mk-${style}` +
        (store.featured ? ' is-featured' : '') + (selected ? ' is-selected' : '');
    switch (style) {
        case 'circle':
            return `<span class="${cls}"><span class="sl-mk-core"></span></span>`;
        case 'dot':
            return `<span class="${cls}"><span class="sl-mk-pulse"></span><span class="sl-mk-core"></span></span>`;
        case 'label':
            return `<span class="${cls}"><span class="sl-mk-text">${escapeHtml(store.name)}</span></span>`;
        case 'icon':
            return `<span class="${cls}"><i class="${escapeHtml(store.categoryIcon || 'fa fa-map-marker')}"></i></span>`;
        case 'image':
            return store.imageUrl
                ? `<span class="${cls}"><img src="${escapeHtml(store.imageUrl)}" alt=""/></span>`
                : `<span class="${cls} sl-mk-noimg"><i class="${escapeHtml(store.categoryIcon || 'fa fa-building-o')}"></i></span>`;
        default:
            return '';
    }
}

export class LeafletEngine {
    /**
     * @param {HTMLElement} el
     * @param {Object} config   locator config (lat, lng, zoom)
     * @param {Object} options  { onSelect, markerStyle, markerSize, tiles,
     *                            scrollZoom, popup(store) -> html|'' , fitMaxZoom }
     */
    constructor(el, config, options = {}) {
        this.onSelect = options.onSelect || (() => {});
        this.options = options;
        this.markerStyle = options.markerStyle || 'pin';
        this.markerSize = MARKER_SIZES[options.markerSize] || MARKER_SIZES.medium;
        this.markers = {};
        this.selectedId = null;
        this.palette = readPalette(el);
        this.map = L.map(el, {
            scrollWheelZoom: !!options.scrollZoom,
            zoomControl: options.zoomControl !== false,
        });
        const tiles = TILE_LAYERS[options.tiles] || TILE_LAYERS.osm;
        L.tileLayer(tiles.url, {
            maxZoom: tiles.maxZoom,
            attribution: tiles.attribution,
        }).addTo(this.map);
        this.map.setView([config.lat || 0, config.lng || 0], config.zoom || 12);
        this.resizeObserver = new ResizeObserver(() => this.map.invalidateSize());
        this.resizeObserver.observe(el);
    }

    _icon(store, selected) {
        if (this.markerStyle !== 'pin') {
            const size = this.markerStyle === 'dot' ? Math.round(this.markerSize * 0.6) : this.markerSize;
            const isLabel = this.markerStyle === 'label';
            return L.divIcon({
                className: 'sl-map-marker sl-map-marker-css' + (selected ? ' sl-map-marker-selected' : ''),
                html: markerHtml(store, this.markerStyle, selected),
                iconSize: isLabel ? null : [size, size],
                iconAnchor: isLabel ? [0, 0] : [size / 2, size / 2],
                popupAnchor: [0, -size / 2],
            });
        }
        const fill = selected
            ? this.palette.selected
            : (store.featured ? this.palette.featured : this.palette.normal);
        const size = Math.round(this.markerSize * (selected ? 1.3 : 1));
        return L.divIcon({
            className: 'sl-map-marker' + (selected ? ' sl-map-marker-selected' : ''),
            html: `<div class="sl-marker-pin">${PIN_SVG(fill)}</div>`,
            iconSize: [size, size * 4 / 3],
            iconAnchor: [size / 2, size * 4 / 3],
            popupAnchor: [0, -size],
        });
    }

    _popupContent(store) {
        if (this.options.popup) {
            return this.options.popup(store);
        }
        return `<div class="sl-map-popup"><strong>${escapeHtml(store.name)}</strong>` +
            `<br/><span>${escapeHtml(store.address)}</span></div>`;
    }

    setStores(stores, selectedId) {
        const storeMap = new Map();
        for (const store of stores) {
            if ((store.lat || store.lng) && store.lat !== 0 && store.lng !== 0) {
                storeMap.set(store.id, store);
            }
        }
        for (const [id, marker] of Object.entries(this.markers)) {
            if (!storeMap.has(Number(id))) {
                marker.remove();
                delete this.markers[id];
            }
        }
        for (const [id, store] of storeMap.entries()) {
            const selected = id === selectedId;
            const existing = this.markers[id];
            const popup = this._popupContent(store);
            if (existing) {
                existing.setLatLng([store.lat, store.lng]);
                existing.setIcon(this._icon(store, selected));
                existing.setZIndexOffset(selected ? 1000 : 0);
                if (popup) {
                    existing.bindPopup(popup);
                } else {
                    existing.unbindPopup();
                }
            } else {
                const marker = L.marker([store.lat, store.lng], {
                    icon: this._icon(store, selected),
                    title: store.name,
                    alt: store.name,
                    zIndexOffset: selected ? 1000 : 0,
                });
                if (popup) {
                    marker.bindPopup(popup, { className: 'sl-leaflet-popup', maxWidth: 300, minWidth: 220 });
                }
                marker.on('click', () => this.onSelect(id));
                marker.addTo(this.map);
                this.markers[id] = marker;
            }
        }
        this.selectedId = selectedId;
        if (selectedId !== null && selectedId !== undefined && storeMap.has(selectedId)) {
            const store = storeMap.get(selectedId);
            this.map.flyTo([store.lat, store.lng], Math.max(this.map.getZoom(), 14), { duration: 0.5 });
            this.markers[selectedId].openPopup();
        } else {
            this.fitBounds([...storeMap.values()]);
        }
    }

    fitBounds(stores) {
        const points = stores.map((store) => [store.lat, store.lng]);
        if (!points.length) {
            return;
        }
        if (points.length === 1) {
            this.map.setView(points[0], this.options.singleZoom || 14);
            return;
        }
        this.map.fitBounds(L.latLngBounds(points).pad(0.15), { maxZoom: this.options.fitMaxZoom || 15 });
    }

    destroy() {
        this.resizeObserver.disconnect();
        this.map.remove();
    }
}

// ---------------------------------------------------------------------------
// Google Maps engine (optional)
// ---------------------------------------------------------------------------
export class GoogleEngine {
    constructor(el, config, { onSelect, popup }) {
        this.onSelect = onSelect;
        this.popup = popup;
        this.markers = {};
        this.selectedId = null;
        this.palette = readPalette(el);
        this.map = new google.maps.Map(el, {
            center: { lat: config.lat, lng: config.lng },
            zoom: config.zoom,
            scrollwheel: false,
            mapTypeControl: false,
            streetViewControl: false,
        });
        this.infoWindow = new google.maps.InfoWindow();
        this.resizeObserver = new ResizeObserver(() => {
            google.maps.event.trigger(this.map, 'resize');
        });
        this.resizeObserver.observe(el);
    }

    _icon(selected, featured = false) {
        const fill = selected
            ? this.palette.selected
            : (featured ? this.palette.featured : this.palette.normal);
        const size = selected ? 40 : 30;
        const svg = PIN_SVG(fill)
            .replaceAll('\n', '')
            .replaceAll('"', "'");
        return {
            url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(size, size * 4 / 3),
            anchor: new google.maps.Point(size / 2, size * 4 / 3),
        };
    }

    setStores(stores, selectedId) {
        const storeMap = new Map();
        for (const store of stores) {
            if (store.lat !== 0 || store.lng !== 0) {
                storeMap.set(store.id, store);
            }
        }
        for (const [id, marker] of Object.entries(this.markers)) {
            if (!storeMap.has(Number(id))) {
                marker.setMap(null);
                delete this.markers[id];
            }
        }
        const bounds = new google.maps.LatLngBounds();
        let selectedStore = null;
        for (const [id, store] of storeMap.entries()) {
            const position = { lat: store.lat, lng: store.lng };
            bounds.extend(position);
            if (id === selectedId) {
                selectedStore = store;
            }
            const selected = id === selectedId;
            const existing = this.markers[id];
            if (existing) {
                existing.setPosition(position);
                existing.setIcon(this._icon(selected, store.featured));
            } else {
                const marker = new google.maps.Marker({
                    position,
                    map: this.map,
                    title: store.name,
                    icon: this._icon(selected, store.featured),
                });
                marker.addListener('click', () => this.onSelect(id));
                this.markers[id] = marker;
            }
        }
        this.selectedId = selectedId;
        if (selectedStore) {
            this.map.panTo({ lat: selectedStore.lat, lng: selectedStore.lng });
            this.infoWindow.setContent(this.popup ? this.popup(selectedStore) :
                `<div class="sl-map-popup"><strong>${escapeHtml(selectedStore.name)}</strong>` +
                `<br/><span>${escapeHtml(selectedStore.address)}</span></div>`);
            this.infoWindow.open(this.map, this.markers[selectedId]);
        } else if (!bounds.isEmpty()) {
            if (storeMap.size === 1) {
                const only = [...storeMap.values()][0];
                this.map.setCenter({ lat: only.lat, lng: only.lng });
                this.map.setZoom(14);
            } else {
                this.map.fitBounds(bounds);
            }
        }
    }

    destroy() {
        this.resizeObserver.disconnect();
        for (const marker of Object.values(this.markers)) {
            marker.setMap(null);
        }
        this.markers = {};
    }
}
