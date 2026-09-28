/**
 * Store Locator — card template renderer.
 *
 * Store cards are designed in the Website editor: the "card template" is
 * normal editable HTML inside the block (.sl-card-tpl > .sl-tcard). Its parts
 * are marked with:
 *   data-sl-card="name|image|category|address|city|distance|tags|description|
 *                 phone|email|website|hours_today|featured|open24|featured_flag"
 *   data-sl-link="detail|directions|phone|email|website|map"
 * Inside a part, an optional [data-sl-text] child receives the text (so icons
 * and labels around it are kept). Parts without a value are removed from the
 * rendered card. Links keep the text/style chosen by the user; only the href
 * (or the click behavior) is set.
 */
import { formatDistance } from "./scope";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_CARD_TEMPLATE = `
<article class="sl-tcard sl-tcard-v">
    <div class="sl-tcard-media" data-sl-card="image">
        <img class="sl-tcard-img" alt="" loading="lazy"/>
        <span class="sl-tcard-ph"><i class="fa fa-building-o"></i></span>
        <span class="sl-tcard-flag" data-sl-card="featured_flag"><i class="fa fa-star"></i></span>
    </div>
    <div class="sl-tcard-body">
        <p class="sl-tcard-cat" data-sl-card="category"><i class="fa fa-tag"></i> <span data-sl-text="">Category</span></p>
        <h3 class="sl-tcard-name" data-sl-card="name">Store name</h3>
        <p class="sl-tcard-desc" data-sl-card="description">Short description</p>
        <p class="sl-tcard-addr" data-sl-card="address"><i class="fa fa-map-marker"></i> <span data-sl-text="">Address</span></p>
        <div class="sl-tcard-actions">
            <a class="sl-tcard-more" data-sl-link="detail" href="#">View details <i class="fa fa-arrow-right"></i></a>
        </div>
    </div>
</article>`;

function valueOf(store, part, ctx) {
    switch (part) {
        case "name":
            return store.name;
        case "category":
            return store.category;
        case "address":
            return store.address;
        case "city":
            return [store.city, store.state].filter(Boolean).join(", ");
        case "description":
            return store.shortDescription;
        case "phone":
            return store.phone;
        case "email":
            return store.email;
        case "website":
            return (store.website || "").replace(/^https?:\/\//, "");
        case "distance": {
            const km = store.distance ?? store.distanceKm;
            return km !== undefined && km !== null ? `${formatDistance(km)}` : "";
        }
        case "hours_today": {
            if (store.is24Hours) {
                return "Open 24/7";
            }
            const today = WEEKDAYS[new Date().getDay()];
            const line = (store.hours || []).find((h) => h.day === today);
            return line ? line.hours : "";
        }
        case "featured":
            return store.featured ? "Featured" : "";
        case "featured_flag":
            return store.featured ? "1" : "";
        case "open24":
            return store.is24Hours ? "Open 24/7" : "";
        case "tags":
            return (store.tags || []).length ? "1" : "";
        case "image":
            return "1"; // image part always kept (placeholder when no picture)
        default:
            return ctx.extra?.[part] ?? "";
    }
}

function hrefOf(store, link) {
    switch (link) {
        case "detail":
            return store.detailUrl;
        case "directions": {
            const dest = store.lat || store.lng ? `${store.lat},${store.lng}` : store.address;
            return dest
                ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
                : "";
        }
        case "phone":
            return store.phone ? `tel:${store.phone}` : "";
        case "email":
            return store.email ? `mailto:${store.email}` : "";
        case "website":
            return store.website || "";
        case "map":
            return "#";
        default:
            return "";
    }
}

/**
 * Build the card element of `store` from the template element.
 * @param {HTMLElement} template  .sl-tcard element
 * @param {Object} store          public store payload
 * @param {Object} ctx            { selected, onSelect(store), editMode }
 */
export function renderCard(template, store, ctx = {}) {
    const card = template.cloneNode(true);
    card.removeAttribute("data-oe-id");
    card.classList.add("sl-tcard-live");
    card.classList.toggle("sl-tcard-selected", !!ctx.selected);
    card.classList.toggle("sl-tcard-featured", !!store.featured);
    card.dataset.storeId = String(store.id);
    for (const el of card.querySelectorAll("[contenteditable]")) {
        el.removeAttribute("contenteditable");
    }

    for (const partEl of [...card.querySelectorAll("[data-sl-card]")]) {
        const part = partEl.dataset.slCard;
        const value = valueOf(store, part, ctx);
        if (!value) {
            partEl.remove();
            continue;
        }
        if (part === "image") {
            const img = partEl.querySelector("img");
            partEl.classList.toggle("sl-noimg", !store.imageUrl);
            if (img) {
                if (store.imageUrl) {
                    img.src = store.imageUrl;
                    img.alt = store.name;
                } else {
                    img.remove();
                }
            }
            const ph = partEl.querySelector(".sl-tcard-ph i");
            if (ph && store.categoryIcon) {
                ph.className = store.categoryIcon;
            }
            continue;
        }
        if (part === "featured_flag") {
            continue;
        }
        if (part === "tags") {
            const sample = partEl.querySelector("[data-sl-tag]") || partEl.firstElementChild;
            const proto = sample ? sample.cloneNode(true) : document.createElement("span");
            partEl.replaceChildren();
            for (const tag of store.tags) {
                const chip = proto.cloneNode(true);
                chip.textContent = tag.name;
                partEl.appendChild(chip);
            }
            continue;
        }
        if (part === "category") {
            const icon = partEl.querySelector("i.fa, span.fa");
            if (icon && store.categoryIcon) {
                icon.className = store.categoryIcon;
            }
        }
        const target = partEl.querySelector("[data-sl-text]") || partEl;
        target.textContent = value;
    }

    for (const linkEl of [...card.querySelectorAll("[data-sl-link]")]) {
        const link = linkEl.dataset.slLink;
        const href = hrefOf(store, link);
        if (!href) {
            linkEl.remove();
            continue;
        }
        linkEl.setAttribute("href", href);
        if (["directions", "website"].includes(link)) {
            linkEl.setAttribute("target", "_blank");
            linkEl.setAttribute("rel", "noopener noreferrer");
        }
        if (link === "map") {
            linkEl.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                ctx.onSelect?.(store);
            });
        } else if (ctx.editMode) {
            linkEl.addEventListener("click", (ev) => ev.preventDefault());
        } else {
            linkEl.addEventListener("click", (ev) => ev.stopPropagation());
        }
    }

    const clickMode = template.closest("[data-card-click]")?.dataset.cardClick || ctx.defaultClick || "detail";
    if (clickMode !== "none") {
        card.classList.add("sl-tcard-clickable");
        card.setAttribute("tabindex", "0");
        const activate = () => {
            if (clickMode === "select" && ctx.onSelect) {
                ctx.onSelect(store);
            } else if (clickMode === "detail" && !ctx.editMode && store.detailUrl) {
                window.location.href = store.detailUrl;
            }
        };
        card.addEventListener("click", activate);
        card.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                activate();
            }
        });
    }
    return card;
}

/** Template element of a block (or a default one built on the fly). */
export function getCardTemplate(blockEl) {
    const tpl = blockEl.querySelector(".sl-card-tpl .sl-tcard");
    if (tpl) {
        return tpl;
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = DEFAULT_CARD_TEMPLATE.trim();
    return wrapper.firstElementChild;
}
