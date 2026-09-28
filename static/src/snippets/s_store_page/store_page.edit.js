/**
 * Store Page blocks — edit mode.
 *
 * Blocks already on the page are filled by the server. A block dropped from
 * the "Blocks" panel still holds placeholders: fetch the current store's
 * values once and fill it, so the preview is right away. The fill is runtime
 * only (undone before saving); the server fills the saved page again.
 */
import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

import { StoreGallery, StoreHours, StoreLocationMap } from "./store_page";

const UNFILLED =
    "[data-sl-value]:not([data-sl-filled]), [data-sl-href]:not([data-sl-filled]), " +
    "[data-sl-src]:not([data-sl-filled]), [data-sl-geo]:not([data-sl-filled])";

const payloadCache = new Map();

function present(payload, expression) {
    const keys = (expression || "").split("|").map((k) => k.trim()).filter(Boolean);
    return !keys.length || keys.some((key) => payload.present[key]);
}

export class StorePageEditFill extends Interaction {
    static selector = "[data-sl-store-id]";

    setup() {
        this.storeId = parseInt(this.el.dataset.slStoreId, 10);
        this.payload = null;
    }

    async willStart() {
        if (!this.storeId || !this.el.querySelector(UNFILLED)) {
            return;
        }
        if (!payloadCache.has(this.storeId)) {
            payloadCache.set(this.storeId, rpc("/store-locator/store-fields", { store_id: this.storeId }));
        }
        this.payload = await this.waitFor(payloadCache.get(this.storeId));
    }

    start() {
        const payload = this.payload;
        if (!payload || !payload.html) {
            return;
        }
        for (const el of this.el.querySelectorAll(UNFILLED)) {
            const restore = [];
            if (el.dataset.slValue && el.dataset.slValue in payload.html) {
                const previous = el.innerHTML;
                el.innerHTML = payload.html[el.dataset.slValue];
                restore.push(() => (el.innerHTML = previous));
            }
            if (el.dataset.slHref && el.dataset.slHref in payload.href) {
                const previous = el.getAttribute("href");
                el.setAttribute("href", payload.href[el.dataset.slHref] || "#");
                restore.push(() => el.setAttribute("href", previous || "#"));
            }
            if (el.dataset.slSrc !== undefined && el.tagName === "IMG") {
                const previous = el.getAttribute("src");
                const src = payload.src[el.dataset.slSrc];
                if (src) {
                    el.setAttribute("src", src);
                    restore.push(() => el.setAttribute("src", previous));
                }
            }
            if (el.dataset.slGeo !== undefined && payload.geo) {
                const keys = { slLat: "lat", slLng: "lng", slName: "name", slAddress: "address" };
                for (const [attr, key] of Object.entries(keys)) {
                    el.dataset[attr] = payload.geo[key] ?? "";
                }
                restore.push(() => {
                    for (const attr of Object.keys(keys)) {
                        delete el.dataset[attr];
                    }
                });
            }
            el.dataset.slFilled = "1";
            restore.push(() => delete el.dataset.slFilled);
            this.registerCleanup(() => restore.reverse().forEach((fn) => fn()));
        }
        for (const el of this.el.querySelectorAll("[data-sl-if]")) {
            const empty = !present(payload, el.dataset.slIf);
            if (empty !== el.classList.contains("sl-field-empty")) {
                el.classList.toggle("sl-field-empty", empty);
                this.registerCleanup(() => el.classList.toggle("sl-field-empty", !empty));
            }
        }
    }

    getConfigurationSnapshot() {
        // Restart when new blocks (with unfilled markers) are dropped.
        return JSON.stringify([
            this.el.querySelectorAll(UNFILLED).length,
            [...this.el.querySelectorAll("[data-sl-if]")].map((el) => el.dataset.slIf).join(","),
        ]);
    }

    isImpactedBy(el) {
        return this.el.contains(el);
    }
}

const GalleryEdit = (I) =>
    class extends I {
        isEditMode() {
            return true;
        }
    };

const edit = registry.category("public.interactions.edit");
edit.add("store_locator.sl_page_fill", { Interaction: StorePageEditFill });
edit.add("store_locator.sl_gallery", { Interaction: StoreGallery, mixin: GalleryEdit });
edit.add("store_locator.sl_hours", { Interaction: StoreHours });
edit.add("store_locator.sl_location_map", { Interaction: StoreLocationMap });
