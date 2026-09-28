# Store Locator (Odoo 19) — 19.0.3.0.0

Production-ready **Odoo 19** module: manage your stores in the backend and expose
them on a public storefront page with an interactive map, live search, filters,
geolocation and SEO-friendly store detail pages.

> **Built for Odoo 19** — uses the 19.0 security model (`res.groups.privilege`),
> `<list>` views, and the interactions framework (`registry.category("public_components")`
> + `<owl-component>` tags) for the front-end Owl application.

---

## 1. Installation

Copy the `store_locator` folder into your custom addons directory:

```
D:\websites\work-space\odoo\custom_addons\store_locator
```

Make sure `odoo.conf` contains the addons path:

```ini
[options]
addons_path = D:\websites\work-space\odoo\odoo\addons, D:\websites\work-space\odoo\custom_addons
```

Install from PowerShell:

```powershell
cd D:\websites\work-space\odoo
python .\odoo\odoo-bin -c .\odoo.conf -d odoo_dev -i store_locator --stop-after-init
```

Or: restart the server, go to **Apps**, remove the *Apps* filter, search
**Store Locator** and click **Install** (don't forget *Update Apps List* first).

Upgrade an existing installation:

```powershell
python .\odoo\odoo-bin -c .\odoo.conf -d odoo_dev -u store_locator --stop-after-init
```

Run the test suite:

```powershell
python .\odoo\odoo-bin -c .\odoo.conf -d odoo_dev -i store_locator --test-enable --stop-after-init
```

---

## 2. Backend usage

Top menu **Store Locator** (requires the *Store Locator / Administrator* group):

| Menu        | Purpose                                                        |
|-------------|----------------------------------------------------------------|
| Stores      | Create/edit stores                                             |
| Categories  | Retail Store, Showroom, Service Center, Pickup Point...        |
| Tags        | Wheelchair Accessible, Parking Available, Open Sunday...       |
| Settings    | Map provider, default center/zoom, radius, stores per page...  |

### Adding a store

1. **Store Locator > Stores > New**
2. Fill in name, **category** (required), address, contact details.
3. Open the **Map** tab and set **Latitude / Longitude**
   (right-click on Google Maps -> the values are the decimal coordinates).
4. Optionally set per-day **Opening Hours** (or *Open 24/7*).
5. Toggle **Published** — unpublished or archived stores never appear on the site.

### Granting access

*Settings > Users* — pick a user, open the *Access Rights* tab, section
**Store Locator**: `User` (read-only) or `Administrator` (full access).

---

## 3. Website — everything is a building block (19.0.3.0.0)

Open any page, click **Edit**, and use the **Blocks** panel. Every part below
can be dragged, duplicated, removed and styled; select a block to see its
options in the sidebar. Changes preview live in the editor.

### 3.1 Store Locator page

Group **Store Locator** (sections):

| Section | Layout |
|---------|--------|
| Store Locator | Search bar on top, filter panel + store list on the left, sticky map on the right |
| Store Locator (Top Bar) | Search and filters in one horizontal bar, list + map below |
| Store Locator (Map on Top) | Bar, full-width map, store cards grid |
| Store Locator Hero | Gradient banner (standard section: text, background, spacing) |
| Store Cards | Store listing for the homepage / landing pages |
| Store Locator (Classic) | The all-in-one block of version 2.0 |

Inside a Store Locator section the parts are separate **inner blocks**
(Inner Content panel), so you can build any layout, e.g. search and filters
in one area, filters on the right, map on top:

| Block | Options |
|-------|---------|
| **Store Search** | placeholder, icon, search button + text, "use my location" + text, sort menu, shape (pill / rounded / square / underline), size, field and border colors; placed alone on another page it sends visitors to the locator page with the search |
| **Store Filter** | one block per filter: category, tags, country, state, ZIP, distance, featured, open 24/7, sort, clear button, result count. Display: chips / dropdown / radio list / checkbox list, and toggle switch / checkbox / button for yes-no filters. "All" text, label on/off (click it to rename), label beside, chip style, toggle color, width |
| **Filter Panel** | container you drop filters (and search) into: stacked / two columns / in a row, card / toolbar / plain, title, collapsible (closed at start, closed on mobile), sticky, background, spacing, corners |
| **Store List** | list or grid (1–4 columns), scrollable + height, result count, card click (show on map / open page / nothing), "load more" and "no result" texts, and the **card design** (below) |
| **Store Map** | height, sticky, theme (OpenStreetMap / Voyager / Light / Dark), corners, wheel zoom, max zoom; **markers**: pin / circle / dot / category icon / store photo / name label, size, normal / featured / selected colors; **popup**: photo, category, name, address, phone, today's hours, distance, details button + text, directions link + text |

Section options: restrict to categories / tags / featured stores, stores per
page, order, main and featured colors, overlap the block above.

**Card design.** Store List, Store Cards and Related Stores contain an editable
card (dashed frame in the editor). Every store card follows it:
- click a text or button inside it to restyle or rename it (e.g. "View Details")
- drag parts to reorder them
- toggle parts from the sidebar: image, name, category, short description,
  address, city, distance, tags, phone, email, today's hours, featured / 24/7
  badges; buttons: details, directions, call, email, website
- card style (image left / image top / text on image / minimal), look
  (border+shadow / flat / outline / floating), background, corners, image size,
  title color

### 3.2 Store Cards (homepage listing)

Show: **featured**, **latest**, **all**, **by category / tag** or
**hand-picked stores** (kept in your order); exclude stores; how many; order;
grid or **slider**; 2–4 columns; card click; card design; colors. Title, text
and the "View all stores" button are normal editable content.

### 3.3 Store detail pages

The page is made of blocks (group **Store Page** + inner blocks). The layout
is shared by every store page and each block shows the data of the store being
viewed (filled on the server, so it is SEO friendly):

| Block | Options |
|-------|---------|
| Store Title | size (display 3 … heading 4), weight, color, alignment |
| Store Text | shows short description / address / city / category / phone / mobile / email / website; size, color, alignment |
| Store Image | square avatar / circle / wide 16:9 / original, size, corners, white border, shadow, hide without photo |
| Store Gallery | slider with thumbnails below / above / beside, slider without thumbnails, photo grid; height, thumbnail size, corners, fit; **popup viewer on click** (arrows, counter, thumbnails, keyboard); autoplay; include main photo; arrows; counter |
| Store Badges | category / featured / 24-7 / tags on-off, soft / solid / outline / on-dark style |
| Store Buttons | alignment, stacked, full width on mobile; each button: directions / Google Maps / call / mobile / email / website / locator page (text and style editable, hidden when the store has no value) |
| Store Address, Hours, Contact | icon, one line; highlight today, striped / compact; show phone / mobile / email / website, icon style, in a row |
| Store About | store description |
| Store Location Map | height, zoom, theme, marker style / size / color, wheel zoom, popup |
| Store Breadcrumb | light / dark background |
| Related Stores | related by: nearest / same category / same tags / same city / state / country / any; current store always excluded; exclude more; how many; order; grid / slider; hide when empty; card design |

Any section, card or column of a store page has **Show Only If Store Has**
(photos, description, hours, phone, map...) so empty parts disappear
automatically, and sections have **Overlap Block Above**.

The "DRAG BUILDING BLOCKS HERE (THIS STORE ONLY)" zone is saved on each store.

Old `/store-locator/store/<id>` links 301-redirect to the SEO slug URL; published
stores are in `/sitemap.xml`.

### 3.4 JSON API

`/store-locator/stores` — params: `page`, `limit` (1..48), `search`,
`category_ids` / `tag_ids` / `featured` (block restrictions), `category_filter`,
`tag_filter`, `country_id`, `state_id`, `zip_code`, `open24` (visitor filters),
`store_ids` (manual order), `exclude_ids`, `related_to` + `relation`, `order`
(default / name / latest / sequence). Returns `{stores, total, page, limit, hasMore}`.

`/store-locator/bootstrap` — config + first page + filter options for a locator section.

### 3.5 Colors & multi-website

Settings > **Design** sets the default main / featured colors; every block can
override them. Set **Website** on a store to show it on one website only.

---

## 4. Map configuration

**Store Locator > Settings** (or *Website > Configuration > Settings > Store Locator*):

| Setting | Default | Notes |
|---------|---------|-------|
| Default Map Center | 40.7128 / -74.0060 | Used until stores or geolocation refine the view |
| Default Zoom | 12 | 1 = world, 15 = street |
| Map Provider | OpenStreetMap (Leaflet) | Free, no API key. Switch to *Google Maps* to use your key |
| Google Maps API Key | — | Required only for the Google provider; restrict it to your domain |
| Enable OpenStreetMap Tiles | Yes | |
| Enable Geolocation | Yes | |
| Enable Distance | Yes | |
| Default Search Radius | 25 km | Preselected radius filter |
| Stores Per Page | 12 | API page size (1..48) |

Leaflet + OpenStreetMap is bundled (`static/lib/leaflet`) — no CDN or API key
needed for the default experience. Map data © OpenStreetMap contributors.

---

## 5. Security model (Odoo 19)

`security.xml` creates an **ir.module.category** + a **res.groups.privilege**
("Store Locator") and two groups bound to it:

* `group_store_user` — read access (implies internal user)
* `group_store_manager` — full access (implies user; granted to System/admin)

Public / portal users get read access to published stores and categories only
(record rules), which the website needs for slug URLs. The JSON API still uses
`sudo()` behind a strict field whitelist and never exposes tracebacks. Internal
fields (`code`, `created_by`) are restricted to internal users.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Module not in Apps list | Check `addons_path`, restart server, *Update Apps List* |
| `External ID not found: store_locator.xxx` | Partial install — drop the module and reinstall: `--stop-after-init -i store_locator` |
| Map tiles blank / markers missing | Check browser console; ensure `static/lib/leaflet` assets load (hard refresh Ctrl+F5) |
| "Use my location" does nothing | Browser geolocation requires HTTPS (or `localhost`); check the permission prompt |
| Public page empty | Stores must be **Published** (and not archived); check demo data installed |
| Store Locator blocks missing in the editor | Upgrade the module, then hard refresh (Ctrl+F5) |
| /store-locator is 404 after deleting the page | Create a page with that URL and drop the Store Locator block on it |
| Google provider selected but no map | Set the API key; wrong key falls back to OpenStreetMap automatically |
| 404 on a store detail page | The store is unpublished or archived |
| Assets seem stale | Restart with `-u store_locator`, then Ctrl+F5 |

Log tail while installing:

```powershell
Get-Content -Wait .\odoo.log
```

---

## 7. Technical notes

* **No legacy code**: pure Owl 2 + ES modules, no jQuery, no `odoo.define`.
* **Odoo 19 views**: `<list>` tags, `invisible="expr"` syntax, `models.Constraint`.
* **SEO**: `website.seo.metadata` on stores, `additional_title` + `seo_object`
  (OG/Twitter tags) handled by `website.layout`, server-rendered fallback content.
* **Accessibility**: keyboard-navigable cards (`tabindex`, Enter/Space), ARIA
  labels, live regions for the result count, visible focus rings.
* **Dependencies**: `website` only (implies `base`).

---

## 8. Changelog

**19.0.3.0.0 — Drag-and-drop everything**

* Composable Store Locator: Search, Filter (11 types, several displays), Filter Panel, Store List, Store Map blocks sharing one live state; 3 ready layouts
* Editable card design (parts, order, texts, buttons, styles) for lists, listings and related stores
* Map marker styles (pin, circle, dot, icon, photo, label) with normal / featured / selected colors, map themes, configurable popup
* Store Cards: featured / latest / all / by category-tag / hand-picked, exclude, slider
* Store page rebuilt from blocks filled server-side: title, text, image, gallery slider + popup viewer, badges, buttons, address, hours, contact, about, location map, breadcrumb, related stores (nearest, same category...)
* "Show only if store has" on sections, cards and columns
* Upgrading from 2.0 keeps your edited /store-locator page (Classic block) and the old detail drop zones


**19.0.2.0.0 — Website editor integration**

* New blocks: Store Locator, Store Locator Hero, Store Cards, with sidebar options and live preview
* /store-locator converted to an editable website page
* Store pages: Store Page options panel, drop zones, inline editing, nearby stores, sidebar layout, plain header
* SEO slug URLs with 301 from old numeric URLs, sitemap entries, publish toggle, multi-website
* Colors configurable (settings + per block); map markers follow them
* Fixed: live search never filtered (search text was not stored)
* Fixed: icons missing (FontAwesome 5 names on Odoo's FontAwesome 4.7)
* Fixed: search box height on mobile
* Removed dead files (unused settings view, iframe snippet, orphan gallery script)
