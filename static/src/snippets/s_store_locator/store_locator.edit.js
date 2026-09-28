import { registry } from "@web/core/registry";

import { StoreLocatorSnippet } from "./store_locator";

/**
 * Edit-mode flavour: the locator stays interactive for a live preview,
 * but links never navigate away from the editor.
 */
const StoreLocatorSnippetEdit = (I) =>
    class extends I {
        start() {
            super.start();
            this.addListener(
                this.el,
                "click",
                (ev) => {
                    if (ev.target.closest(".s_store_locator_app a[href]")) {
                        ev.preventDefault();
                    }
                },
                { capture: true }
            );
        }

        isEditMode() {
            return true;
        }
    };

registry.category("public.interactions.edit").add("store_locator.snippet", {
    Interaction: StoreLocatorSnippet,
    mixin: StoreLocatorSnippetEdit,
});
