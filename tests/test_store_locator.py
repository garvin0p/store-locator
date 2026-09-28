# -*- coding: utf-8 -*-
import json

from odoo.tests import HttpCase, TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestStoreLocatorModels(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.category = cls.env['store.category'].create({
            'name': 'Test Category',
        })
        cls.store = cls.env['store.location'].create({
            'name': 'Test Store',
            'category_id': cls.category.id,
            'city': 'Testville',
            'zip': '12345',
            'latitude': 40.7128,
            'longitude': -74.006,
            'phone': '+1 555-0100',
        })

    def test_create_store(self):
        self.assertTrue(self.store.active)
        self.assertTrue(self.store.is_published)
        self.assertEqual(self.store.full_address, '12345, Testville')
        self.assertEqual(self.store.created_by, self.env.user)

    def test_google_maps_url_computed(self):
        self.assertIn('https://www.google.com/maps', self.store.google_maps_url)
        self.assertIn('40.7128,-74.006', self.store.google_maps_url)

    def test_custom_maps_url_wins(self):
        self.store.maps_url_override = 'https://maps.example.com/store'
        self.assertEqual(self.store.google_maps_url, 'https://maps.example.com/store')

    def test_unique_code_constraint(self):
        self.env['store.location'].create({
            'name': 'Other Store',
            'category_id': self.category.id,
            'code': 'UNIQ-1',
        })
        with self.assertRaises(Exception):
            self.env['store.location'].create({
                'name': 'Duplicate Code Store',
                'category_id': self.category.id,
                'code': 'UNIQ-1',
            })

    def test_latitude_constraint(self):
        with self.assertRaises(Exception):
            self.env['store.location'].create({
                'name': 'Bad Latitude',
                'category_id': self.category.id,
                'latitude': 123.0,
            })

    def test_unpublished_not_in_public_domain(self):
        public_domain = [('active', '=', True), ('is_published', '=', True)]
        self.assertIn(self.store.id, self.env['store.location'].search(public_domain).ids)
        self.store.is_published = False
        self.assertNotIn(self.store.id, self.env['store.location'].search(public_domain).ids)

    def test_archived_not_in_public_domain(self):
        public_domain = [('active', '=', True), ('is_published', '=', True)]
        self.store.active = False
        self.assertNotIn(self.store.id, self.env['store.location'].search(public_domain).ids)

    def test_opening_hours(self):
        self.store.mon_hours = '9:00 - 18:00'
        hours = self.store._get_opening_hours()
        self.assertEqual(hours, [{'day': 'Monday', 'hours': '9:00 - 18:00'}])


@tagged('post_install', '-at_install')
class TestStoreLocatorRoutes(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.category = cls.env['store.category'].create({
            'name': 'Route Category',
        })
        cls.store = cls.env['store.location'].create({
            'name': 'Route Test Store',
            'category_id': cls.category.id,
            'city': 'Route City',
            'latitude': 41.8781,
            'longitude': -87.6298,
        })

    def test_public_page_ok(self):
        response = self.url_open('/store-locator')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Store Locator', response.content)
        self.assertIn(b's_store_locator', response.content)

    def test_public_api_ok(self):
        response = self.url_open('/store-locator/stores?page=1&limit=5')
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content)
        self.assertIn('stores', payload)
        self.assertIn('total', payload)
        self.assertIn('page', payload)
        self.assertIn('limit', payload)
        self.assertIn('hasMore', payload)
        self.assertGreaterEqual(payload['total'], 1)
        names = [store['name'] for store in payload['stores']]
        self.assertIn('Route Test Store', names)

    def test_public_api_filters(self):
        response = self.url_open('/store-locator/stores?search=Route City')
        payload = json.loads(response.content)
        self.assertEqual(payload['total'], 1)

    def test_public_api_whitelisted_fields_only(self):
        response = self.url_open('/store-locator/stores')
        payload = json.loads(response.content)
        forbidden = {'created_by', 'active', 'sequence', 'code'}
        for store in payload['stores']:
            self.assertFalse(forbidden & set(store.keys()))

    def test_detail_page_ok(self):
        response = self.url_open('/store-locator/store/%s' % self.store.id)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Route Test Store', response.content)

    def test_detail_page_unpublished_404(self):
        self.store.is_published = False
        response = self.url_open('/store-locator/store/%s' % self.store.id)
        self.assertEqual(response.status_code, 404)

    def test_detail_page_invalid_404(self):
        response = self.url_open('/store-locator/store/99999999')
        self.assertEqual(response.status_code, 404)


@tagged('post_install', '-at_install')
class TestStoreGallery(TransactionCase):
    """Gallery images: ordering, cascade delete and public payload."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.category = cls.env['store.category'].create({'name': 'Gallery Category'})
        cls.store = cls.env['store.location'].create({
            'name': 'Gallery Store',
            'category_id': cls.category.id,
        })
        cls.img_b = cls.env['store.location.image'].create({
            'store_id': cls.store.id,
            'name': 'Second',
            'sequence': 20,
            'image_1920': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQTX4NAAIkAXSaGkHUAAAAAElFTkSuQmCC',
        })
        cls.img_a = cls.env['store.location.image'].create({
            'store_id': cls.store.id,
            'name': 'First',
            'sequence': 10,
            'image_1920': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQTX4NAAIkAXSaGkHUAAAAAElFTkSuQmCC',
        })

    def test_ordering_by_sequence(self):
        self.assertEqual(
            self.store.gallery_image_ids.mapped('name'), ['First', 'Second'])

    def test_cascade_delete(self):
        store_id = self.store.id
        self.assertEqual(
            self.env['store.location.image'].search_count(
                [('store_id', '=', store_id)]), 2)
        self.store.unlink()
        self.assertEqual(
            self.env['store.location.image'].search_count(
                [('store_id', '=', store_id)]), 0)


@tagged('post_install', '-at_install')
class TestStoreFieldFilling(TransactionCase):
    """Server-side filling of the Store Page blocks."""

    def test_fill_document(self):
        from odoo.addons.store_locator.controllers.store_fields import fill_document
        payload = {
            'html': {'name': 'Shop &amp; Co', 'badges': '<span class="b">X</span>'},
            'href': {'phone': '', 'directions': 'https://maps.example/dir'},
            'src': {'image': ''},
            'present': {'name': True, 'phone': False, 'gallery': True},
            'geo': {'lat': 1.5, 'lng': 2.5, 'name': 'Shop', 'address': 'Street', 'featured': False},
            'alt': 'Shop',
        }
        page = (b'<!DOCTYPE html>\n<html><body><div>'
                b'<h1 data-sl-value="name">Store Name</h1>'
                b'<div data-sl-value="badges">x</div>'
                b'<a data-sl-href="phone" href="#">Call</a>'
                b'<a data-sl-href="directions" href="#">Go</a>'
                b'<img data-sl-src="image" src="x.png"/>'
                b'<section data-sl-if="gallery"></section><section data-sl-if="phone|email"></section>'
                b'<div data-sl-geo=""></div><script>var a = 1 < 2;</script>'
                b'</div></body></html>')
        out = fill_document(page, payload).decode()
        self.assertTrue(out.startswith('<!DOCTYPE html>'))
        self.assertIn('>Shop &amp; Co</h1>', out)
        self.assertIn('<span class="b">X</span>', out)
        self.assertIn('href="https://maps.example/dir"', out)
        self.assertRegex(out, r'<a data-sl-href="phone" href="#" class="sl-field-empty">')
        self.assertIn('store_placeholder.svg', out)
        self.assertIn('data-sl-lat="1.5"', out)
        self.assertIn('var a = 1 < 2;', out)
        self.assertEqual(out.count('sl-field-empty'), 2)

    def test_untouched_without_markers(self):
        from odoo.addons.store_locator.controllers.store_fields import fill_document
        page = b'<!DOCTYPE html><html><body><p>plain</p></body></html>'
        self.assertEqual(fill_document(page, {}), page)
