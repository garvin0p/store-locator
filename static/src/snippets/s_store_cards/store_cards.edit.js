import { registry } from "@web/core/registry";

import { StoreCardsSnippet } from "./store_cards";

const StoreCardsSnippetEdit = (I) =>
    class extends I {
        start() {
            super.start();
            this.addListener(
                this.el,
                "click",
                (ev) => {
                    if (ev.target.closest(".sl-cards-rt a[href], .s_store_cards_grid a[href]")) {
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
            const template = this.el.querySelector(".sl-card-tpl");
            return JSON.stringify([super.getConfigurationSnapshot(), template ? template.innerHTML : ""]);
        }

        isImpactedBy(el) {
            return this.el.contains(el);
        }
    };

registry.category("public.interactions.edit").add("store_locator.store_cards", {
    Interaction: StoreCardsSnippet,
    mixin: StoreCardsSnippetEdit,
});
