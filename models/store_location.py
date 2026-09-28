# -*- coding: utf-8 -*-
import math
from urllib.parse import quote

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import html_translate

DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
DAY_LABELS = [
    ('Monday', 'mon_hours'), ('Tuesday', 'tue_hours'), ('Wednesday', 'wed_hours'),
    ('Thursday', 'thu_hours'), ('Friday', 'fri_hours'), ('Saturday', 'sat_hours'),
    ('Sunday', 'sun_hours'),
]


class StoreLocation(models.Model):
    _name = 'store.location'
    _description = 'Store Location'
    _inherit = [
        'website.seo.metadata',
        'website.published.mixin',
        'website.multi.mixin',
    ]
    _order = 'sequence, name, id'

    # ------------------------------------------------------------------
    # Basics
    # ------------------------------------------------------------------
    name = fields.Char(required=True, translate=True)
    active = fields.Boolean(default=True, index=True)
    code = fields.Char(
        copy=False, groups='base.group_user',
        help='Unique internal reference of the store (branch code, SKU...).')
    category_id = fields.Many2one(
        'store.category', string='Category', required=True,
        ondelete='restrict', index=True)
    short_description = fields.Text(
        translate=True,
        help='One-line summary displayed on the store card in the locator.')
    description = fields.Html(sanitize=True, translate=True)
    sequence = fields.Integer(default=10)
    tag_ids = fields.Many2many(
        'store.tag', relation='store_location_store_tag_rel',
        string='Tags')
    image_1920 = fields.Image(max_width=1920, max_height=1920)
    gallery_image_ids = fields.One2many(
        'store.location.image', 'store_id', string='Gallery Images',
        copy=True,
        help='Photo gallery shown on the public store detail page. '
             'Manage the pictures from the "Gallery" tab.')
    is_featured = fields.Boolean(
        string='Featured',
        help='Featured stores are highlighted and appear first in the locator results.')
    is_published = fields.Boolean(
        string='Published', default=True, index=True, copy=False)
    website_id = fields.Many2one(
        help='Restrict the store to one website. Leave empty to show it on every website.')
    website_content = fields.Html(
        string='Page Content', translate=html_translate, sanitize=False,
        sanitize_overridable=True, copy=False,
        help='Building blocks dropped on this store page with the Website editor.')
    created_by = fields.Many2one(
        'res.users', string='Created By', default=lambda self: self.env.user,
        readonly=True, copy=False, groups='base.group_user')

    # ------------------------------------------------------------------
    # Address
    # ------------------------------------------------------------------
    street = fields.Char()
    street2 = fields.Char()
    city = fields.Char()
    zip = fields.Char(string='ZIP')
    state_id = fields.Many2one('res.country.state', string='State', ondelete='restrict')
    country_id = fields.Many2one('res.country', string='Country', ondelete='restrict')
    full_address = fields.Char(compute='_compute_full_address')

    # ------------------------------------------------------------------
    # Contact
    # ------------------------------------------------------------------
    phone = fields.Char()
    mobile = fields.Char()
    email = fields.Char()
    website = fields.Char(string='Store Website', help='Public website of the store (link shown on the store page).')

    # ------------------------------------------------------------------
    # Map
    # ------------------------------------------------------------------
    latitude = fields.Float(
        digits=(16, 7),
        help='Latitude in decimal degrees. Required to display the store on the map.')
    longitude = fields.Float(
        digits=(16, 7),
        help='Longitude in decimal degrees. Required to display the store on the map.')
    maps_url_override = fields.Char(
        string='Custom Maps URL',
        help='Custom Google Maps URL. When empty, the URL is generated from the coordinates.')
    google_maps_url = fields.Char(
        string='Google Maps URL', compute='_compute_google_maps_url')

    # ------------------------------------------------------------------
    # Opening hours
    # ------------------------------------------------------------------
    opening_hours = fields.Text(
        translate=True,
        help='Free-text opening hours. They are displayed on the store page when the '
             'per-day schedule below is not used.')
    mon_hours = fields.Char(string='Monday')
    tue_hours = fields.Char(string='Tuesday')
    wed_hours = fields.Char(string='Wednesday')
    thu_hours = fields.Char(string='Thursday')
    fri_hours = fields.Char(string='Friday')
    sat_hours = fields.Char(string='Saturday')
    sun_hours = fields.Char(string='Sunday')
    is_24_hours = fields.Boolean(string='Open 24/7')

    _code_uniq = models.Constraint(
        'UNIQUE (code)',
        'The store code must be unique across stores.')

    # ------------------------------------------------------------------
    # Computes / constraints
    # ------------------------------------------------------------------
    @api.depends('street', 'street2', 'city', 'zip', 'state_id', 'country_id')
    def _compute_full_address(self):
        for store in self:
            parts = [
                store.street, store.street2, store.zip, store.city,
                store.state_id.name, store.country_id.name,
            ]
            store.full_address = ', '.join(part for part in parts if part)

    @api.depends('latitude', 'longitude', 'maps_url_override')
    def _compute_google_maps_url(self):
        for store in self:
            if store.maps_url_override:
                store.google_maps_url = store.maps_url_override
            elif store.latitude or store.longitude:
                store.google_maps_url = (
                    'https://www.google.com/maps/search/?api=1&query=%s,%s'
                    % (store.latitude, store.longitude)
                )
            else:
                store.google_maps_url = False

    @api.constrains('latitude')
    def _check_latitude(self):
        for store in self:
            if store.latitude and not -90 <= store.latitude <= 90:
                raise ValidationError(self.env._('Latitude must be between -90 and 90 degrees.'))

    @api.constrains('longitude')
    def _check_longitude(self):
        for store in self:
            if store.longitude and not -180 <= store.longitude <= 180:
                raise ValidationError(self.env._('Longitude must be between -180 and 180 degrees.'))

    @api.onchange('state_id')
    def _onchange_state_id(self):
        if self.state_id and self.state_id.country_id:
            self.country_id = self.state_id.country_id

    @api.depends_context('lang')
    @api.depends('name')
    def _compute_website_url(self):
        for store in self:
            if store.id:
                store.website_url = '/store-locator/store/%s' % self.env['ir.http']._slug(store)
            else:
                store.website_url = '#'

    def _default_is_published(self):
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _get_opening_hours(self):
        """Return a list of {'day': ..., 'hours': ...} for days with a schedule."""
        self.ensure_one()
        return [
            {'day': day, 'hours': getattr(self, field)}
            for day, field in DAY_LABELS
            if getattr(self, field)
        ]

    def _has_coordinates(self):
        self.ensure_one()
        return bool(self.latitude or self.longitude)

    def _distance_to(self, other):
        """Great-circle distance in kilometers between two stores (Haversine)."""
        self.ensure_one()
        radius = 6371.0
        lat1, lng1 = math.radians(self.latitude), math.radians(self.longitude)
        lat2, lng2 = math.radians(other.latitude), math.radians(other.longitude)
        dlat, dlng = lat2 - lat1, lng2 - lng1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _get_nearby_stores(self, candidates, limit=3):
        """Return [(store, distance_km)] of the closest ``candidates`` to this store."""
        self.ensure_one()
        if not self._has_coordinates():
            return []
        others = [
            (store, self._distance_to(store))
            for store in candidates
            if store.id != self.id and store._has_coordinates()
        ]
        others.sort(key=lambda pair: pair[1])
        return others[:limit]

    def action_open_in_google_maps(self):
        """Open the store in Google Maps (browser action)."""
        self.ensure_one()
        if self.google_maps_url:
            url = self.google_maps_url
        elif self.full_address:
            url = 'https://www.google.com/maps/search/?api=1&query=%s' % quote(self.full_address)
        else:
            url = 'https://www.google.com/maps'
        return {
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'new',
        }
