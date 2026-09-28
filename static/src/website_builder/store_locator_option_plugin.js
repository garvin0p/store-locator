/**
 * Website Builder integration (Odoo 19 html_builder API).
 *
 * - Sidebar options of every Store Locator / Store Page block
 * - Custom actions (filter type, card parts, store button link, text field)
 * - Drop rules: blocks can be dropped in the locator zones, card parts can be
 *   reordered inside the card design, store buttons inside button groups
 * - Save cleanup: runtime content never ends up in the saved page
 */
import { BaseOptionComponent } from "@html_builder/core/utils";
import { BuilderAction } from "@html_builder/core/builder_action";
import { Plugin } from "@html_editor/plugin";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

// ---------------------------------------------------------------------------
// Option components (one per block)
// ---------------------------------------------------------------------------
function option(name, template, selector, extra = {}) {
    const C = class extends BaseOptionComponent {
        static template = template;
        static selector = selector;
    };
    Object.defineProperty(C, "name", { value: name });
    Object.assign(C, extra);
    return C;
}

// Classic (all-in-one) block of version 2.0
export const StoreLocatorOption = option("StoreLocatorOption", "store_locator.StoreLocatorOption", ".s_store_locator");
// Composable locator
export const StoreFinderOption = option("StoreFinderOption", "store_locator.StoreFinderOption", ".s_store_finder");
export const SearchOption = option("SearchOption", "store_locator.SearchOption", ".s_sl_search");
export const FilterOption = option("FilterOption", "store_locator.FilterOption", ".s_sl_filter");
export const FilterPanelOption = option("FilterPanelOption", "store_locator.FilterPanelOption", ".s_sl_filter_panel");
export const ListOption = option("ListOption", "store_locator.ListOption", ".s_sl_list");
export const MapOption = option("MapOption", "store_locator.MapOption", ".s_sl_map");
export const CardLinkOption = option("CardLinkOption", "store_locator.CardLinkOption", ".sl-tcard [data-sl-link]");
// Listings
export const StoreCardsOption = option("StoreCardsOption", "store_locator.StoreCardsOption", ".s_store_cards");
export const RelatedOption = option("RelatedOption", "store_locator.RelatedOption", ".s_sl_related");
// Store page blocks
export const TitleOption = option("TitleOption", "store_locator.TitleOption", ".s_sl_title");
export const TextOption = option("TextOption", "store_locator.TextOption", ".s_sl_text");
export const ImageOption = option("ImageOption", "store_locator.ImageOption", ".s_sl_image");
export const BadgesOption = option("BadgesOption", "store_locator.BadgesOption", ".s_sl_badges");
export const GalleryOption = option("GalleryOption", "store_locator.GalleryOption", ".s_sl_gallery");
export const HoursOption = option("HoursOption", "store_locator.HoursOption", ".s_sl_hours");
export const ContactOption = option("ContactOption", "store_locator.ContactOption", ".s_sl_contact");
export const AddressOption = option("AddressOption", "store_locator.AddressOption", ".s_sl_address");
export const ButtonsOption = option("ButtonsOption", "store_locator.ButtonsOption", ".s_sl_buttons");
export const ButtonLinkOption = option("ButtonLinkOption", "store_locator.ButtonLinkOption", ".s_sl_buttons > a[data-sl-href]");
export const LocationMapOption = option("LocationMapOption", "store_locator.LocationMapOption", ".s_sl_location_map");
export const BreadcrumbOption = option("BreadcrumbOption", "store_locator.BreadcrumbOption", ".s_sl_breadcrumb");
export const SectionOverlapOption = option(
    "SectionOverlapOption",
    "store_locator.SectionOverlapOption",
    ".o_store_locator_detail section"
);
// Any section / card / column of a store page
export const ConditionOption = option(
    "ConditionOption",
    "store_locator.ConditionOption",
    ".o_store_locator_detail section, .o_store_locator_detail .s_card, .o_store_locator_detail .row > div"
);

// ---------------------------------------------------------------------------
// Custom actions
// ---------------------------------------------------------------------------
const FILTER_LABELS = {
    category: _t("Categories"),
    tags: _t("Services"),
    country: _t("Country"),
    state: _t("State / Province"),
    zip: _t("ZIP code"),
    radius: _t("Distance from me"),
    featured: _t("Featured stores only"),
    open24: _t("Open 24/7 only"),
    sort: _t("Sort by"),
    clear: "",
    count: "",
};

/** Change the filter type; keep the label in sync unless the user renamed it. */
export class SlFilterTypeAction extends BuilderAction {
    static id = "slFilterType";
    isApplied({ editingElement, value }) {
        return (editingElement.dataset.filter || "category") === value;
    }
    getValue({ editingElement }) {
        return editingElement.dataset.filter || "category";
    }
    apply({ editingElement: el, value }) {
        const previous = el.dataset.filter || "category";
        el.dataset.filter = value;
        const displays = {
            category: "chips", tags: "chips", country: "select", state: "select",
            radius: "select", sort: "select", featured: "switch", open24: "switch",
        };
        if (displays[value]) {
            el.dataset.display = displays[value];
        } else {
            delete el.dataset.display;
        }
        const label = el.querySelector(".sl-filter-label");
        if (label) {
            const current = label.textContent.trim();
            const known = Object.values(FILTER_LABELS).map(String);
            if (!current || current === String(FILTER_LABELS[previous]) || known.includes(current) || current === "Filter") {
                label.textContent = String(FILTER_LABELS[value] || "Filter");
            }
        }
        el.classList.toggle("sl-filter-inline", ["featured", "open24"].includes(value));
        el.classList.toggle("sl-filter-nolabel", ["clear", "count"].includes(value));
    }
}

const CARD_PARTS = {
    image: {
        where: "top",
        html: '<div class="sl-tcard-media" data-sl-card="image"><img class="sl-tcard-img" src="/store_locator/static/src/img/store_placeholder.svg" alt=""/><span class="sl-tcard-ph"><i class="fa fa-building-o"></i></span><span class="sl-tcard-flag" data-sl-card="featured_flag"><i class="fa fa-star"></i></span></div>',
    },
    name: { html: '<h3 class="sl-tcard-name" data-sl-card="name">Store name</h3>' },
    category: { html: '<p class="sl-tcard-cat" data-sl-card="category"><i class="fa fa-tag"></i> <span data-sl-text="">Category</span></p>' },
    address: { html: '<p class="sl-tcard-addr" data-sl-card="address"><i class="fa fa-map-marker"></i> <span data-sl-text="">Street, ZIP City, Country</span></p>' },
    city: { html: '<p class="sl-tcard-addr" data-sl-card="city"><i class="fa fa-building-o"></i> <span data-sl-text="">City, State</span></p>' },
    distance: { html: '<p class="sl-tcard-dist" data-sl-card="distance"><i class="fa fa-road"></i> <span data-sl-text="">1.2 km</span> away</p>' },
    description: { html: '<p class="sl-tcard-desc" data-sl-card="description">Short description of the store.</p>' },
    tags: { html: '<div class="sl-tcard-tags" data-sl-card="tags"><span class="sl-tcard-tag" data-sl-tag="">Tag</span></div>' },
    phone: { html: '<p class="sl-tcard-line" data-sl-card="phone"><i class="fa fa-phone"></i> <span data-sl-text="">+1 555-0100</span></p>' },
    email: { html: '<p class="sl-tcard-line" data-sl-card="email"><i class="fa fa-envelope"></i> <span data-sl-text="">store@example.com</span></p>' },
    hours_today: { html: '<p class="sl-tcard-line" data-sl-card="hours_today"><i class="fa fa-clock-o"></i> Today: <span data-sl-text="">9:00 - 18:00</span></p>' },
    featured: { html: '<span class="sl-tcard-badge sl-tcard-badge-feat" data-sl-card="featured"><i class="fa fa-star"></i> <span data-sl-text="">Featured</span></span>' },
    open24: { html: '<span class="sl-tcard-badge sl-tcard-badge-open" data-sl-card="open24"><span data-sl-text="">Open 24/7</span></span>' },
    "link:detail": { where: "actions", html: '<a class="btn btn-primary btn-sm sl-tcard-btn" data-sl-link="detail" href="#">View Details <i class="fa fa-arrow-right"></i></a>' },
    "link:directions": { where: "actions", html: '<a class="sl-tcard-icon" data-sl-link="directions" href="#" title="Directions"><i class="fa fa-location-arrow"></i></a>' },
    "link:phone": { where: "actions", html: '<a class="sl-tcard-icon" data-sl-link="phone" href="#" title="Call"><i class="fa fa-phone"></i></a>' },
    "link:email": { where: "actions", html: '<a class="sl-tcard-icon" data-sl-link="email" href="#" title="Email"><i class="fa fa-envelope"></i></a>' },
    "link:website": { where: "actions", html: '<a class="sl-tcard-icon" data-sl-link="website" href="#" title="Website"><i class="fa fa-globe"></i></a>' },
    "link:map": { where: "actions", html: '<a class="sl-tcard-icon" data-sl-link="map" href="#" title="Show on map"><i class="fa fa-map-o"></i></a>' },
};

function partSelector(part) {
    return part.startsWith("link:")
        ? `[data-sl-link="${part.slice(5)}"]`
        : `[data-sl-card="${part}"]`;
}

/** Add / remove a part of the card design (the parts stay draggable). */
export class SlCardPartAction extends BuilderAction {
    static id = "slCardPart";
    isApplied({ editingElement, params: { mainParam: part } }) {
        const card = editingElement.querySelector(".sl-card-tpl .sl-tcard");
        return !!card?.querySelector(partSelector(part));
    }
    apply({ editingElement, params: { mainParam: part } }) {
        const card = editingElement.querySelector(".sl-card-tpl .sl-tcard");
        const spec = CARD_PARTS[part];
        if (!card || !spec) {
            return;
        }
        const tmp = document.createElement("div");
        tmp.innerHTML = spec.html;
        const el = tmp.firstElementChild;
        if (spec.where === "top") {
            card.prepend(el);
            return;
        }
        let body = card.querySelector(".sl-tcard-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "sl-tcard-body";
            card.append(body);
        }
        if (spec.where === "actions") {
            let actions = body.querySelector(".sl-tcard-actions");
            if (!actions) {
                actions = document.createElement("div");
                actions.className = "sl-tcard-actions";
                body.append(actions);
            }
            actions.append(el);
            return;
        }
        const actions = body.querySelector(".sl-tcard-actions");
        body.insertBefore(el, actions || null);
    }
    clean({ editingElement, params: { mainParam: part } }) {
        const card = editingElement.querySelector(".sl-card-tpl .sl-tcard");
        card?.querySelectorAll(partSelector(part)).forEach((el) => el.remove());
    }
}

const CONDITIONAL_LINKS = ["phone", "mobile", "email", "website"];

/** Store button: what it links to (and hide it when the store has no value). */
export class SlButtonLinkAction extends BuilderAction {
    static id = "slButtonLink";
    isApplied({ editingElement, value }) {
        return editingElement.dataset.slHref === value;
    }
    getValue({ editingElement }) {
        return editingElement.dataset.slHref;
    }
    apply({ editingElement: el, value }) {
        el.dataset.slHref = value;
        if (CONDITIONAL_LINKS.includes(value)) {
            el.dataset.slIf = value;
        } else {
            delete el.dataset.slIf;
        }
        delete el.dataset.slFilled;
    }
}

/** Store Text block: which store field it shows. */
export class SlTextFieldAction extends BuilderAction {
    static id = "slTextField";
    isApplied({ editingElement, value }) {
        return editingElement.querySelector("[data-sl-value]")?.dataset.slValue === value;
    }
    getValue({ editingElement }) {
        return editingElement.querySelector("[data-sl-value]")?.dataset.slValue;
    }
    apply({ editingElement: el, value }) {
        const target = el.querySelector("[data-sl-value]");
        if (!target) {
            return;
        }
        target.dataset.slValue = value;
        delete target.dataset.slFilled;
        target.textContent = PLACEHOLDERS[value] || value;
        el.dataset.slIf = value;
    }
}

// ---------------------------------------------------------------------------
// Save cleanup
// ---------------------------------------------------------------------------
const PLACEHOLDERS = {
    name: "Store Name",
    short_description: "Short description of the store.",
    address_line: "Street, ZIP City, Country",
    city: "City",
    phone: "+1 555-0100",
    mobile: "+1 555-0101",
    email: "store@example.com",
    website: "www.example.com",
    category: "Category",
};

function cleanForSave(root) {
    // Runtime classes / attributes of the interactions
    for (const el of root.querySelectorAll(".sl-mounted, .sl-cards-empty, .sl-fp-closed")) {
        el.classList.remove("sl-mounted", "sl-cards-empty", "sl-fp-closed");
    }
    for (const el of root.querySelectorAll(".s_store_locator, .s_store_cards")) {
        el.style.removeProperty("--sl-default-primary");
        el.style.removeProperty("--sl-default-accent");
    }
    // Runtime containers are rebuilt on every page load
    for (const el of root.querySelectorAll(".sl-cards-rt > .sl-cards-grid:not(.sl-cards-skeleton)")) {
        el.remove();
    }
    // Store data filled on store pages: saved as neutral placeholders (the
    // layout is shared by every store), refilled on each page view.
    for (const el of root.querySelectorAll("[data-sl-value][data-sl-filled]")) {
        const key = el.dataset.slValue;
        if (PLACEHOLDERS[key]) {
            el.textContent = PLACEHOLDERS[key];
        }
    }
    for (const el of root.querySelectorAll("[data-sl-filled]")) {
        delete el.dataset.slFilled;
    }
    for (const el of root.querySelectorAll("[data-sl-geo]")) {
        for (const key of ["slLat", "slLng", "slName", "slAddress", "slFeatured"]) {
            delete el.dataset[key];
        }
    }
    for (const el of root.querySelectorAll("img[data-sl-src]")) {
        el.setAttribute("src", "/store_locator/static/src/img/store_placeholder.svg");
        el.classList.remove("sl-img-placeholder");
    }
    for (const el of root.querySelectorAll(".sl-field-empty")) {
        el.classList.remove("sl-field-empty");
    }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
class StoreLocatorOptionPlugin extends Plugin {
    static id = "storeLocatorOption";
    /** @type {import("plugins").WebsiteResources} */
    resources = {
        builder_options: [
            StoreLocatorOption,
            StoreFinderOption,
            SearchOption,
            FilterOption,
            FilterPanelOption,
            ListOption,
            MapOption,
            CardLinkOption,
            StoreCardsOption,
            RelatedOption,
            TitleOption,
            TextOption,
            ImageOption,
            BadgesOption,
            GalleryOption,
            HoursOption,
            ContactOption,
            AddressOption,
            ButtonsOption,
            ButtonLinkOption,
            LocationMapOption,
            BreadcrumbOption,
            SectionOverlapOption,
            ConditionOption,
        ],
        builder_actions: {
            SlFilterTypeAction,
            SlCardPartAction,
            SlButtonLinkAction,
            SlTextFieldAction,
        },
        // Store blocks behave like inner content (drag handle, clone, remove)
        so_content_addition_selector: [".sl-block"],
        dropzone_selector: [
            {
                selector: ".sl-block",
                dropIn: ".sl-dropzone, .card-body",
                excludeAncestor: ".sl-card-tpl",
            },
            {
                // Card design: reorder parts inside the card
                selector: ".sl-tcard [data-sl-card], .sl-tcard [data-sl-link]",
                dropNear: ".sl-tcard [data-sl-card], .sl-tcard [data-sl-link]",
                dropIn: ".sl-tcard-body, .sl-tcard-actions",
                dropLockWithin: ".sl-tcard",
            },
            {
                selector: ".s_sl_buttons > a[data-sl-href]",
                dropNear: ".s_sl_buttons > a[data-sl-href]",
                dropIn: ".s_sl_buttons",
            },
        ],
        clean_for_save_handlers: ({ root }) => cleanForSave(root),
    };
}

registry.category("website-plugins").add(StoreLocatorOptionPlugin.id, StoreLocatorOptionPlugin);
