import { registry } from "@web/core/registry";

import {
    StoreFinderBlock,
    StoreSearchBlock,
    StoreFilterBlock,
    StoreListBlock,
    StoreMapBlock,
    StoreFinderBlockEdit,
} from "./finder";

const edit = registry.category("public.interactions.edit");
// The edit behavior lives on the shared base class; blocks inherit it.
edit.add("store_locator.sl_block_base", {
    Interaction: StoreFinderBlock,
    mixin: StoreFinderBlockEdit,
    isAbstract: true,
});
for (const [name, Interaction] of [
    ["store_locator.sl_search", StoreSearchBlock],
    ["store_locator.sl_filter", StoreFilterBlock],
    ["store_locator.sl_list", StoreListBlock],
    ["store_locator.sl_map", StoreMapBlock],
]) {
    edit.add(name, { Interaction });
}
