/**
 * Store Locator block (s_store_locator) — Odoo 19 interaction.
 *
 * Reads the block options written by the Website editor on the section
 * (data-* attributes), fetches the bootstrap payload once and mounts the
 * StoreLocator Owl application inside `.s_store_locator_app`.
 *
 * In edit mode the same interaction runs (see store_locator.edit.js) so
 * every option change is previewed live: the builder restarts interactions
 * whenever a data-* attribute of the section changes.
 */
import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

import { StoreLocator } from "@store_locator/js/store_locator";

function readBool(dataset, key, fallback) {
    const value = dataset[key];
    if (value === undefined || value === "") {
        return fallback;
    }
    return value === "true" || value === "1";
}

function readIds(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return (Array.isArray(parsed) ? parsed : [])
            .map((item) => parseInt(typeof item === "object" ? item.id : item, 10))
            .filter((id) => id > 0);
    } catch {
        return String(value)
            .split(",")
            .map((part) => parseInt(part, 10))
            .filter((id) => id > 0);
    }
}

/** Translate the section data-* attributes into StoreLocator options. */
export function readLocatorOptions(el) {
    const d = el.dataset;
    const layouts = ["list-map", "map-list", "map-top", "list", "map"];
    return {
        layout: layouts.includes(d.layout) ? d.layout : "list-map",
        // "hide*" flags: the builder checkbox is ticked when the part is shown.
        showSearch: !readBool(d, "hideSearch", false),
        showGeolocation: !readBool(d, "hideGeolocation", false),
        showFilters: !readBool(d, "hideFilters", false),
        filtersOpen: !readBool(d, "filtersCollapsed", false),
        showCategories: !readBool(d, "hideCategories", false),
        showRegion: !readBool(d, "hideRegion", false),
        showZip: !readBool(d, "hideZip", false),
        showRadius: !readBool(d, "hideRadius", false),
        showFeaturedToggle: !readBool(d, "hideFeaturedToggle", false),
        showImages: !readBool(d, "hideImages", false),
        showTags: !readBool(d, "hideTags", false),
        showDetails: !readBool(d, "hideDetails", false),
        featuredOnly: readBool(d, "featuredOnly", false),
        categoryIds: readIds(d.categoryIds),
        searchPlaceholder: d.searchPlaceholder || "",
    };
}

export class StoreLocatorSnippet extends Interaction {
    static selector = ".s_store_locator";
    dynamicContent = {
        _root: {
            "t-att-class": () => ({
                "sl-mounted": this.mounted,
            }),
        },
    };

    setup() {
        this.mounted = false;
        this.options = readLocatorOptions(this.el);
        this.perPage = parseInt(this.el.dataset.perPage, 10) || 0;
        this.payload = null;
    }

    async willStart() {
        const params = new URLSearchParams();
        if (this.options.categoryIds.length) {
            params.set("category_ids", this.options.categoryIds.join(","));
        }
        if (this.options.featuredOnly) {
            params.set("featured", "1");
        }
        if (this.perPage > 0) {
            params.set("limit", String(Math.min(this.perPage, 48)));
        }
        try {
            const response = await this.waitFor(
                fetch(`/store-locator/bootstrap?${params}`, {
                    headers: { Accept: "application/json" },
                })
            );
            const data = await this.waitFor(response.json());
            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            this.payload = data;
        } catch (error) {
            console.error("Store Locator:", error);
            this.payload = null;
        }
    }

    start() {
        const target = this.el.querySelector(".s_store_locator_app");
        if (!target || !this.payload) {
            return;
        }
        const config = { ...this.payload.config };
        if (this.perPage > 0) {
            config.perPage = Math.min(this.perPage, 48);
        }
        this.applyDefaultColors(config);
        this.mountComponent(target, StoreLocator, {
            config,
            options: { ...this.options, editMode: this.isEditMode() },
            stores: this.payload.stores,
            total: this.payload.total,
            page: this.payload.page,
            hasMore: this.payload.hasMore,
            categories: this.payload.categories,
            countries: this.payload.countries,
            states: this.payload.states,
        });
        this.mounted = true;
        this.updateContent();
    }

    /**
     * Colors picked in the Website editor are stored inline on the section
     * (--sl-primary / --sl-accent). Otherwise use the global settings.
     */
    applyDefaultColors(config) {
        const style = this.el.style;
        if (!style.getPropertyValue("--sl-primary") && config.primaryColor) {
            this.el.style.setProperty("--sl-default-primary", config.primaryColor);
        }
        if (!style.getPropertyValue("--sl-accent") && config.accentColor) {
            this.el.style.setProperty("--sl-default-accent", config.accentColor);
        }
        this.registerCleanup(() => {
            this.el.style.removeProperty("--sl-default-primary");
            this.el.style.removeProperty("--sl-default-accent");
        });
    }

    isEditMode() {
        return false;
    }
}

registry.category("public.interactions").add("store_locator.snippet", StoreLocatorSnippet);
