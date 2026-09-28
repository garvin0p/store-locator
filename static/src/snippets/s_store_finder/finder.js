/**
 * Composable Store Locator — interactions of the locator blocks.
 *
 *   .s_sl_search  -> SearchWidget      .s_sl_filter -> FilterWidget
 *   .s_sl_list    -> ListWidget        .s_sl_map    -> MapWidget
 *
 * Every block reads its own options (data-* set by the Website editor) and
 * shares the FinderScope of its Store Locator section. The Owl widget is
 * mounted inside the block's runtime container (.sl-rt), next to the static,
 * editable parts of the block (labels, card template...).
 */
import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

import { getScope, getScopeRoot, readBool } from "@store_locator/finder/scope";
import { SearchWidget, FilterWidget, ListWidget, MapWidget } from "@store_locator/finder/widgets";

function text(dataset, key, fallback = "") {
    const value = dataset[key];
    return value === undefined || value === "" ? fallback : value;
}

export const OPTION_READERS = {
    search(el) {
        const d = el.dataset;
        return {
            placeholder: text(d, "placeholder", "Search by name, city, street or ZIP..."),
            showIcon: !readBool(d, "hideIcon"),
            showLocate: !readBool(d, "hideLocate"),
            locateLabel: text(d, "locateLabel", "Use my location"),
            showSort: !readBool(d, "hideSort"),
            showButton: readBool(d, "showButton"),
            buttonLabel: text(d, "buttonLabel", "Search"),
            targetUrl: text(d, "targetUrl", "/store-locator"),
        };
    },
    filter(el) {
        const d = el.dataset;
        return {
            type: text(d, "filter", "category"),
            display: text(d, "display", ""),
            allLabel: text(d, "allLabel", ""),
            placeholder: text(d, "placeholder", ""),
            buttonLabel: text(d, "buttonLabel", ""),
        };
    },
    list(el) {
        const d = el.dataset;
        return {
            layout: text(d, "layout", "list"),
            scroll: !readBool(d, "noScroll"),
            showHeader: !readBool(d, "hideHeader"),
            loadMoreLabel: text(d, "loadMoreLabel", "Load more stores"),
            emptyTitle: text(d, "emptyTitle", "No stores found"),
            emptyText: text(d, "emptyText", "Try a different search, widen your filters, or clear them to see every store."),
        };
    },
    map(el) {
        const d = el.dataset;
        const fields = ["image", "category", "name", "address", "phone", "hours", "distance", "detail", "directions"];
        return {
            markerStyle: text(d, "markerStyle", "pin"),
            markerSize: text(d, "markerSize", "medium"),
            tiles: text(d, "tiles", "osm"),
            scrollZoom: readBool(d, "scrollZoom"),
            fitMaxZoom: parseInt(d.fitMaxZoom, 10) || 15,
            popupFields: fields.filter((f) => readBool(d, "popup" + f[0].toUpperCase() + f.slice(1))),
            detailLabel: text(d, "detailLabel", "View details"),
            directionsLabel: text(d, "directionsLabel", "Directions"),
        };
    },
};

export class StoreFinderBlock extends Interaction {
    static kind = "";
    static Widget = null;

    dynamicContent = {
        _root: {
            "t-att-class": () => ({ "sl-mounted": this.mounted }),
        },
    };

    setup() {
        this.mounted = false;
        this.scope = getScope(this.el);
        this.target = this.el.querySelector(":scope > .sl-rt, :scope .sl-rt");
    }

    async willStart() {
        await this.waitFor(this.scope.ready);
    }

    widgetProps() {
        const kind = this.constructor.kind;
        return {
            scope: this.scope,
            options: OPTION_READERS[kind](this.el),
            editMode: this.isEditMode(),
            blockEl: this.el,
        };
    }

    start() {
        if (!this.target) {
            return;
        }
        const props = this.widgetProps();
        if (this.constructor.kind === "search" || this.constructor.kind === "map") {
            delete props.blockEl;
        }
        this.mountComponent(this.target, this.constructor.Widget, props);
        this.mounted = true;
        this.updateContent();
    }

    isEditMode() {
        return false;
    }
}

export class StoreSearchBlock extends StoreFinderBlock {
    static selector = ".s_sl_search";
    static kind = "search";
    static Widget = SearchWidget;
}

export class StoreFilterBlock extends StoreFinderBlock {
    static selector = ".s_sl_filter";
    static kind = "filter";
    static Widget = FilterWidget;
}

export class StoreListBlock extends StoreFinderBlock {
    static selector = ".s_sl_list";
    static kind = "list";
    static Widget = ListWidget;
}

export class StoreMapBlock extends StoreFinderBlock {
    static selector = ".s_sl_map";
    static kind = "map";
    static Widget = MapWidget;
}

/** Filter Panel: collapsible header (runtime state only). */
export class StoreFilterPanel extends Interaction {
    static selector = ".s_sl_filter_panel.sl-fpanel-collapsible";
    dynamicContent = {
        ".sl-fpanel-head": {
            "t-on-click": () => (this.closed = !this.closed),
            "t-att-aria-expanded": () => String(!this.closed),
        },
        _root: { "t-att-class": () => ({ "sl-fp-closed": this.closed }) },
    };

    setup() {
        const mobile = window.matchMedia("(max-width: 991.98px)").matches;
        this.closed =
            this.el.classList.contains("sl-fpanel-start-collapsed") ||
            (mobile && this.el.classList.contains("sl-fpanel-mobile-collapsed"));
    }
}

const interactions = registry.category("public.interactions");
interactions.add("store_locator.sl_filter_panel", StoreFilterPanel);
interactions.add("store_locator.sl_search", StoreSearchBlock);
interactions.add("store_locator.sl_filter", StoreFilterBlock);
interactions.add("store_locator.sl_list", StoreListBlock);
interactions.add("store_locator.sl_map", StoreMapBlock);

// ---------------------------------------------------------------------------
// Edit mode: live preview, no navigation, restart on relevant changes
// ---------------------------------------------------------------------------
export const StoreFinderBlockEdit = (I) =>
    class extends I {
        start() {
            super.start();
            this.addListener(
                this.el,
                "click",
                (ev) => {
                    if (ev.target.closest(".sl-rt a[href]")) {
                        ev.preventDefault();
                    }
                },
                { capture: true }
            );
        }

        isEditMode() {
            return true;
        }

        getConfigurationSnapshot() {
            const root = getScopeRoot(this.el);
            const template = this.el.querySelector(".sl-card-tpl");
            return JSON.stringify([
                super.getConfigurationSnapshot(),
                { ...root.dataset },
                template ? template.innerHTML : "",
            ]);
        }

        isImpactedBy(el) {
            // Edits inside the block (card template, labels) or on the section
            // (block restrictions) refresh the preview.
            return this.el.contains(el) || el.contains(this.el);
        }
    };
