# -*- coding: utf-8 -*-
"""HTTP tests for the public routes and Website builder integration."""
import json

from odoo.tests import HttpCase, tagged


@tagged("post_install", "-at_install")
class TestStoreLocatorHttp(HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.category = cls.env["store.category"].create({"name": "Http Category"})
        cls.other_category = cls.env["store.category"].create({"name": "Http Other"})
        cls.published_store = cls.env["store.location"].create({
            "name": "Http Visible Store",
            "category_id": cls.category.id,
            "city": "Http City",
            "zip": "100001",
            "latitude": 1.3,
            "longitude": 103.8,
        })
        cls.near_store = cls.env["store.location"].create({
            "name": "Http Near Store",
            "category_id": cls.other_category.id,
            "latitude": 1.31,
            "longitude": 103.81,
            "is_featured": True,
        })
        cls.unpublished_store = cls.env["store.location"].create({
            "name": "Http Hidden Store",
            "category_id": cls.category.id,
            "is_published": False,
        })
        cls.archived_store = cls.env["store.location"].create({
            "name": "Http Archived Store",
            "category_id": cls.category.id,
            "active": False,
        })

    def _get_json(self, url):
        response = self.url_open(url)
        self.assertEqual(response.status_code, 200, f"GET {url} failed")
        return json.loads(response.text)

    # ------------------------------------------------------------------
    # Pages
    # ------------------------------------------------------------------
    def test_01_locator_page_is_a_website_page(self):
        page = self.env.ref("store_locator.store_locator_website_page")
        self.assertEqual(page.url, "/store-locator")
        response = self.url_open("/store-locator")
        self.assertEqual(response.status_code, 200)
        self.assertIn('data-snippet="s_store_finder"', response.text)
        for block in ('s_sl_search', 's_sl_filter', 's_sl_list', 's_sl_map'):
            self.assertIn('data-snippet="%s"' % block, response.text)
        self.assertIn("s_store_locator_hero", response.text)

    def test_02_detail_page_slug_and_redirect(self):
        store = self.published_store
        self.assertTrue(store.website_url.startswith("/store-locator/store/http-visible-store-"))
        response = self.url_open(store.website_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("Http Visible Store", response.text)
        # Legacy numeric URLs keep working (redirect to the canonical slug).
        response = self.url_open(f"/store-locator/store/{store.id}", allow_redirects=False)
        self.assertIn(response.status_code, (301, 302, 308))
        self.assertTrue(response.headers["Location"].endswith(store.website_url))

    def test_03_detail_page_404_for_unpublished_and_archived(self):
        for store in (self.unpublished_store, self.archived_store):
            response = self.url_open(f"/store-locator/store/{store.id}")
            self.assertEqual(response.status_code, 404)
        response = self.url_open("/store-locator/store/99999999")
        self.assertEqual(response.status_code, 404)

    def test_04_detail_page_blocks_are_filled(self):
        html = self.url_open(self.published_store.website_url).text
        self.assertIn("o_store_locator_detail", html)
        for zone in ("oe_structure_store_detail_top", "oe_structure_store_detail_layout",
                     "oe_structure_store_detail_layout_bottom", "oe_structure_store_detail_bottom"):
            self.assertIn('id="%s"' % zone, html)
        # Title block shows this store's name, filled server-side
        self.assertRegex(html, r'data-sl-value="name"[^>]*>\s*Http Visible Store')
        # No phone: the Call button is hidden for visitors
        self.assertRegex(html, r'class="[^"]*sl-field-empty[^"]*"[^>]*data-sl-href="phone"|data-sl-href="phone"[^>]*class="[^"]*sl-field-empty')
        # Store id exposed for the related stores block
        self.assertIn('data-sl-store-id="%s"' % self.published_store.id, html)

    def test_05_related_stores_api(self):
        data = self._get_json(f"/store-locator/stores?related_to={self.published_store.id}&relation=nearby&limit=5")
        ids = [store["id"] for store in data["stores"]]
        self.assertNotIn(self.published_store.id, ids, "current store is always excluded")
        self.assertEqual(ids[0], self.near_store.id, "nearest store first")
        self.assertIn("distanceKm", data["stores"][0])
        data = self._get_json(f"/store-locator/stores?related_to={self.near_store.id}&relation=category")
        self.assertNotIn(self.published_store.id, [s["id"] for s in data["stores"]])

    def test_05b_manual_and_latest(self):
        ids = f"{self.near_store.id},{self.published_store.id}"
        data = self._get_json(f"/store-locator/stores?store_ids={ids}")
        self.assertEqual([s["id"] for s in data["stores"]], [self.near_store.id, self.published_store.id])
        data = self._get_json(f"/store-locator/stores?store_ids={ids}&exclude_ids={self.near_store.id}")
        self.assertEqual([s["id"] for s in data["stores"]], [self.published_store.id])
        data = self._get_json("/store-locator/stores?order=latest&limit=1")
        newest = self.env["store.location"].search([("is_published", "=", True)], order="create_date desc, id desc", limit=1)
        self.assertEqual(data["stores"][0]["id"], newest.id)

    def test_05c_edit_preview_payload_needs_login(self):
        response = self.url_open(
            "/store-locator/store-fields",
            data=json.dumps({"jsonrpc": "2.0", "method": "call", "params": {"store_id": self.published_store.id}}),
            headers={"Content-Type": "application/json"})
        self.assertIn("error", response.json())
        self.authenticate("admin", "admin")
        response = self.url_open(
            "/store-locator/store-fields",
            data=json.dumps({"jsonrpc": "2.0", "method": "call", "params": {"store_id": self.published_store.id}}),
            headers={"Content-Type": "application/json"})
        payload = response.json()["result"]
        self.assertIn("Http Visible Store", payload["html"]["name"])
        self.assertFalse(payload["present"]["phone"])

    def test_06_sitemap_lists_published_stores(self):
        response = self.url_open("/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.published_store.website_url, response.text)
        self.assertNotIn(f"-{self.unpublished_store.id}<", response.text)

    # ------------------------------------------------------------------
    # JSON API
    # ------------------------------------------------------------------
    def test_10_api_shape_and_published_only(self):
        data = self._get_json("/store-locator/stores?limit=48")
        for key in ("stores", "total", "page", "limit", "hasMore"):
            self.assertIn(key, data)
        ids = [store["id"] for store in data["stores"]]
        self.assertIn(self.published_store.id, ids)
        self.assertNotIn(self.unpublished_store.id, ids)
        self.assertNotIn(self.archived_store.id, ids)

    def test_11_api_public_fields_only(self):
        data = self._get_json("/store-locator/stores?search=Http+Visible")
        store = data["stores"][0]
        for key in ("id", "name", "category", "address", "lat", "lng", "featured", "detailUrl"):
            self.assertIn(key, store)
        for forbidden in ("created_by", "create_uid", "write_uid", "sequence", "code"):
            self.assertNotIn(forbidden, store)
        self.assertEqual(store["detailUrl"], self.published_store.website_url)

    def test_12_api_block_restrictions(self):
        data = self._get_json(f"/store-locator/stores?category_ids={self.other_category.id}&limit=48")
        ids = [store["id"] for store in data["stores"]]
        self.assertEqual(ids, [self.near_store.id])
        data = self._get_json("/store-locator/stores?featured=1&limit=48")
        ids = [store["id"] for store in data["stores"]]
        self.assertIn(self.near_store.id, ids)
        self.assertNotIn(self.published_store.id, ids)
        # A category chip can only narrow a block restriction, never widen it.
        data = self._get_json(
            f"/store-locator/stores?category_ids={self.other_category.id}&category_id={self.category.id}")
        self.assertEqual(data["stores"], [])

    def test_13_api_pagination_sanitized(self):
        data = self._get_json("/store-locator/stores?page=abc&limit=-5")
        self.assertEqual(data["page"], 1)
        self.assertGreaterEqual(data["limit"], 1)

    def test_14_bootstrap(self):
        data = self._get_json(f"/store-locator/bootstrap?category_ids={self.category.id}&limit=5")
        for key in ("config", "stores", "categories", "countries", "states", "total", "hasMore"):
            self.assertIn(key, data)
        self.assertEqual([c["id"] for c in data["categories"]], [self.category.id])
        self.assertEqual(data["limit"], 5)
        self.assertNotIn("googleKey", [k for k, v in data["config"].items() if v])
