/**
 * Store Locator — Featured Stores AJAX loader.
 *
 * Vanilla JS (no Odoo imports) so it survives module API changes across
 * Odoo versions. Runs on every public page; if it finds an element with
 * class `.s_store_locator_featured_loader` (i.e. an iframe-free embed of
 * the featured stores grid), it fetches the HTML from the
 * /store-locator/snippet/featured endpoint and injects it.
 *
 * Safe no-op when the element is not present.
 */
(function () {
    "use strict";

    function loadFeaturedStores(loader) {
        const limit = loader.dataset.limit || "4";
        fetch("/store-locator/snippet/featured?limit=" + encodeURIComponent(limit), {
            headers: { Accept: "text/html" },
        })
            .then(function (response) {
                if (!response.ok) {
                    return null;
                }
                return response.text();
            })
            .then(function (html) {
                if (!html) {
                    return;
                }
                const tmp = document.createElement("div");
                tmp.innerHTML = html;
                const grid = tmp.querySelector(".store-locator-featured-grid");
                if (grid) {
                    loader.innerHTML = grid.innerHTML;
                }
            })
            .catch(function (error) {
                console.warn("store_locator: failed to load featured stores snippet", error);
            });
    }

    function init() {
        const loaders = document.querySelectorAll(".s_store_locator_featured_loader");
        loaders.forEach(loadFeaturedStores);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
