/**
 * Store Page blocks — runtime behavior.
 *
 *  .s_sl_gallery       slider (main image + thumbnails), grid, lightbox, autoplay
 *  .s_sl_hours         highlight today's row
 *  .s_sl_location_map  Leaflet map of the store with the chosen marker style
 *
 * Store data is filled server-side (controllers/store_fields.py).
 */
import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

import { LeafletEngine } from "@store_locator/js/store_locator_map";
import { readBool } from "@store_locator/finder/scope";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
export class StoreGallery extends Interaction {
    static selector = ".s_sl_gallery";

    dynamicContent = {
        ".sl-gal-prev": { "t-on-click.stop": () => this.show(this.index - 1) },
        ".sl-gal-next": { "t-on-click.stop": () => this.show(this.index + 1) },
        ".sl-gal-thumb": { "t-on-click": (ev) => this.show(parseInt(ev.currentTarget.dataset.index, 10)) },
        ".sl-gal-slide": { "t-on-click": (ev) => this.onSlideClick(ev) },
        _document: { "t-on-keydown": (ev) => this.onKey(ev) },
    };

    setup() {
        const d = this.el.dataset;
        this.hideMain = readBool(d, "hideMain");
        this.lightbox = !readBool(d, "noLightbox");
        this.autoplay = Math.max(parseInt(d.autoplay, 10) || 0, 0);
        this.index = 0;
        this.overlay = null;
    }

    get slides() {
        return [...this.el.querySelectorAll(".sl-gal-slide:not(.sl-gal-hidden)")];
    }

    get thumbs() {
        return [...this.el.querySelectorAll(".sl-gal-thumb:not(.sl-gal-hidden)")];
    }

    start() {
        if (this.hideMain) {
            const gallery = this.el.querySelector(".sl-gal");
            if (gallery && gallery.querySelectorAll(".sl-gal-slide:not(.sl-gal-main)").length) {
                for (const el of this.el.querySelectorAll(".sl-gal-main")) {
                    el.classList.add("sl-gal-hidden");
                    this.registerCleanup(() => el.classList.remove("sl-gal-hidden"));
                }
            }
        }
        this.el.classList.toggle("sl-gal-single", this.slides.length <= 1);
        this.registerCleanup(() => this.el.classList.remove("sl-gal-single"));
        this.show(0);
        if (this.autoplay && this.slides.length > 1 && !this.isEditMode()) {
            const timer = setInterval(() => {
                if (!this.overlay?.classList.contains("sl-lightbox-open")) {
                    this.show(this.index + 1);
                }
            }, this.autoplay * 1000);
            this.registerCleanup(() => clearInterval(timer));
        }
    }

    show(index) {
        const slides = this.slides;
        if (!slides.length) {
            return;
        }
        this.index = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle("is-active", i === this.index));
        this.thumbs.forEach((thumb, i) => {
            thumb.classList.toggle("is-active", i === this.index);
            if (i === this.index) {
                thumb.scrollIntoView?.({ block: "nearest", inline: "nearest" });
            }
        });
        const counter = this.el.querySelector(".sl-gal-current");
        if (counter) {
            counter.textContent = String(this.index + 1);
        }
        const total = this.el.querySelector(".sl-gal-counter");
        if (total && counter) {
            total.lastChild.textContent = ` / ${slides.length}`;
        }
        if (this.overlay?.classList.contains("sl-lightbox-open")) {
            this.renderLightbox();
        }
    }

    onSlideClick(ev) {
        const slide = ev.currentTarget;
        const layout = this.el.dataset.layout || "slider";
        if (layout === "grid") {
            this.index = this.slides.indexOf(slide);
        }
        if (this.lightbox && !this.isEditMode()) {
            this.openLightbox();
        }
    }

    buildLightbox() {
        const overlay = document.createElement("div");
        overlay.className = "sl-lightbox";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.innerHTML =
            '<img class="sl-lightbox-img" alt=""/>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-prev" aria-label="Previous photo"><span class="fa fa-chevron-left"></span></button>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-next" aria-label="Next photo"><span class="fa fa-chevron-right"></span></button>' +
            '<button type="button" class="sl-lightbox-btn sl-lightbox-close" aria-label="Close"><span class="fa fa-times"></span></button>' +
            '<span class="sl-lightbox-counter"></span>' +
            '<div class="sl-lightbox-strip"></div>';
        const style = getComputedStyle(this.el);
        for (const v of ["--sl-primary", "--sl-accent"]) {
            const value = style.getPropertyValue(v);
            if (value) {
                overlay.style.setProperty(v, value);
            }
        }
        overlay.addEventListener("click", (ev) => {
            if (ev.target === overlay) {
                this.closeLightbox();
            }
        });
        overlay.querySelector(".sl-lightbox-close").addEventListener("click", () => this.closeLightbox());
        overlay.querySelector(".sl-lightbox-prev").addEventListener("click", () => this.show(this.index - 1));
        overlay.querySelector(".sl-lightbox-next").addEventListener("click", () => this.show(this.index + 1));
        document.body.appendChild(overlay);
        this.registerCleanup(() => overlay.remove());
        this.overlay = overlay;
    }

    renderLightbox() {
        const slides = this.slides;
        const img = slides[this.index]?.querySelector("img");
        const box = this.overlay;
        box.querySelector(".sl-lightbox-img").src = img?.currentSrc || img?.src || "";
        box.querySelector(".sl-lightbox-img").alt = img?.alt || "";
        box.querySelector(".sl-lightbox-counter").textContent = `${this.index + 1} / ${slides.length}`;
        const strip = box.querySelector(".sl-lightbox-strip");
        strip.replaceChildren(
            ...slides.map((slide, i) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "sl-lightbox-thumb" + (i === this.index ? " is-active" : "");
                const thumb = document.createElement("img");
                thumb.src = slide.querySelector("img")?.src || "";
                thumb.alt = "";
                btn.appendChild(thumb);
                btn.addEventListener("click", () => this.show(i));
                return btn;
            })
        );
        box.classList.toggle("sl-lightbox-single", slides.length <= 1);
    }

    openLightbox() {
        if (!this.overlay) {
            this.buildLightbox();
        }
        this.renderLightbox();
        this.overlay.classList.add("sl-lightbox-open");
        document.body.style.overflow = "hidden";
        this.overlay.querySelector(".sl-lightbox-close").focus();
    }

    closeLightbox() {
        this.overlay?.classList.remove("sl-lightbox-open");
        document.body.style.overflow = "";
    }

    onKey(ev) {
        if (!this.overlay?.classList.contains("sl-lightbox-open")) {
            return;
        }
        if (ev.key === "Escape") {
            this.closeLightbox();
        } else if (ev.key === "ArrowLeft") {
            this.show(this.index - 1);
        } else if (ev.key === "ArrowRight") {
            this.show(this.index + 1);
        }
    }

    isEditMode() {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Opening hours: highlight today
// ---------------------------------------------------------------------------
export class StoreHours extends Interaction {
    static selector = ".s_sl_hours";

    start() {
        if (readBool(this.el.dataset, "noHighlight")) {
            return;
        }
        const today = WEEKDAYS[new Date().getDay()];
        for (const row of this.el.querySelectorAll(".sl-hours-row[data-day]")) {
            if (row.dataset.day === today) {
                row.classList.add("is-today");
                this.registerCleanup(() => row.classList.remove("is-today"));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Location map
// ---------------------------------------------------------------------------
export class StoreLocationMap extends Interaction {
    static selector = ".s_sl_location_map";

    start() {
        const geoEl = this.el.matches("[data-sl-geo]") ? this.el : this.el.querySelector("[data-sl-geo]");
        const canvas = this.el.querySelector(".sl-lmap-canvas");
        const lat = parseFloat(geoEl?.dataset.slLat);
        const lng = parseFloat(geoEl?.dataset.slLng);
        if (!canvas || typeof L === "undefined" || (!lat && !lng) || Number.isNaN(lat)) {
            return;
        }
        const d = this.el.dataset;
        const inner = document.createElement("div");
        inner.className = "sl-lmap-inner";
        canvas.appendChild(inner);
        this.registerCleanup(() => inner.remove());
        const zoom = parseInt(d.zoom, 10) || 15;
        const engine = new LeafletEngine(inner, { lat, lng, zoom }, {
            markerStyle: d.markerStyle || "pin",
            markerSize: d.markerSize || "large",
            tiles: d.tiles || "osm",
            scrollZoom: readBool(d, "scrollZoom"),
            singleZoom: zoom,
            popup: readBool(d, "noPopup")
                ? () => ""
                : (store) => `<div class="sl-map-popup"><strong>${escape(store.name)}</strong><br/><span>${escape(store.address)}</span></div>`,
            onSelect: () => {},
        });
        engine.setStores(
            [{
                id: 1,
                lat,
                lng,
                name: geoEl.dataset.slName || "",
                address: geoEl.dataset.slAddress || "",
                featured: !!geoEl.dataset.slFeatured,
            }],
            null
        );
        this.registerCleanup(() => engine.destroy());
    }
}

function escape(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
}

const interactions = registry.category("public.interactions");
interactions.add("store_locator.sl_gallery", StoreGallery);
interactions.add("store_locator.sl_hours", StoreHours);
interactions.add("store_locator.sl_location_map", StoreLocationMap);
