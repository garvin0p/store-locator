/**
 * Store Cards (s_store_cards) and Related Stores (s_sl_related).
 *
 * Options (data-* set in the Website editor):
 *   data-mode        featured | latest | all | manual | filter | related
 *   data-store-ids   manual selection (kept in that order)
 *   data-category-ids / data-tag-ids / data-featured-only   (filter mode)
 *   data-exclude-ids stores never shown
 *   data-relation    nearby | category | tags | city | state | country | any
 *   data-limit, data-order (default | name | latest | sequence)
 *   data-display     grid | slider      (columns: CSS --sl-cols)
 *   data-hide-empty  hide the whole block when nothing matches
 * Cards are built from the editable card template of the block.
 */
import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

import { readIds, readBool } from "@store_locator/finder/scope";
import { renderCard, getCardTemplate } from "@store_locator/finder/card_renderer";

export class StoreCardsSnippet extends Interaction {
    static selector = ".s_store_cards, .s_sl_related";

    dynamicContent = {
        _root: {
            "t-att-class": () => ({
                "sl-mounted": this.mounted,
                "sl-cards-empty": this.mounted && !this.stores?.length,
            }),
        },
        ".sl-cards-prev": { "t-on-click": () => this.scroll(-1) },
        ".sl-cards-next": { "t-on-click": () => this.scroll(1) },
    };

    setup() {
        this.mounted = false;
        this.stores = null;
        const d = this.el.dataset;
        const isRelated = this.el.classList.contains("s_sl_related");
        // Blocks saved with version 2.0 had no mode: featured-only = featured.
        this.mode = d.mode || (isRelated ? "related" : readBool(d, "featuredOnly", true) ? "featured" : "all");
        this.limit = Math.min(Math.max(parseInt(d.limit, 10) || (isRelated ? 3 : 3), 1), 24);
    }

    params() {
        const d = this.el.dataset;
        const params = new URLSearchParams({ limit: String(this.limit) });
        const exclude = readIds(d.excludeIds);
        switch (this.mode) {
            case "featured":
                params.set("featured", "1");
                break;
            case "latest":
                params.set("order", "latest");
                break;
            case "manual": {
                const ids = readIds(d.storeIds);
                if (!ids.length) {
                    return null;
                }
                params.set("store_ids", ids.join(","));
                break;
            }
            case "filter": {
                const categories = readIds(d.categoryIds);
                const tags = readIds(d.tagIds);
                if (categories.length) {
                    params.set("category_ids", categories.join(","));
                }
                if (tags.length) {
                    params.set("tag_ids", tags.join(","));
                }
                if (readBool(d, "featuredOnly")) {
                    params.set("featured", "1");
                }
                break;
            }
            case "related": {
                const holder = this.el.closest("[data-sl-store-id]");
                const storeId = holder && parseInt(holder.dataset.slStoreId, 10);
                if (!storeId) {
                    return null;
                }
                params.set("related_to", String(storeId));
                params.set("relation", d.relation || "nearby");
                break;
            }
        }
        if (d.order && this.mode !== "manual" && this.mode !== "latest") {
            params.set("order", d.order);
        }
        if (exclude.length) {
            params.set("exclude_ids", exclude.join(","));
        }
        return params;
    }

    async willStart() {
        const params = this.params();
        if (!params) {
            this.stores = [];
            return;
        }
        try {
            const response = await this.waitFor(
                fetch(`/store-locator/stores?${params}`, { headers: { Accept: "application/json" } })
            );
            const data = await this.waitFor(response.json());
            this.stores = response.ok && !data.error ? data.stores || [] : [];
        } catch (error) {
            console.error("Store Cards:", error);
            this.stores = [];
        }
    }

    start() {
        const target = this.el.querySelector(".sl-cards-rt") || this.el.querySelector(".s_store_cards_grid");
        if (!target) {
            return;
        }
        const legacySkeleton = target.querySelector(".sl-cards-skeleton");
        if (legacySkeleton) {
            legacySkeleton.classList.add("d-none");
            this.registerCleanup(() => legacySkeleton.classList.remove("d-none"));
        }
        const template = getCardTemplate(this.el);
        const grid = document.createElement("div");
        grid.className = "sl-cards-grid";
        for (const store of this.stores || []) {
            grid.appendChild(
                renderCard(template, store, { editMode: this.isEditMode(), defaultClick: "detail" })
            );
        }
        if (!this.stores?.length && this.isEditMode()) {
            const note = document.createElement("p");
            note.className = "sl-cards-note";
            note.textContent =
                this.mode === "related"
                    ? "No related store for this store: the block is hidden for visitors."
                    : "No store matches the block options yet.";
            grid.appendChild(note);
        }
        this.insert(grid, target);
        this.gridEl = grid;
        this.mounted = true;
        this.updateContent();
    }

    scroll(direction) {
        if (!this.gridEl) {
            return;
        }
        const card = this.gridEl.firstElementChild;
        const step = card ? card.getBoundingClientRect().width + 16 : 300;
        this.gridEl.scrollBy({ left: direction * step, behavior: "smooth" });
    }

    isEditMode() {
        return false;
    }
}

registry.category("public.interactions").add("store_locator.store_cards", StoreCardsSnippet);
