# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    store_locator_default_lat = fields.Float(
        string='Default Latitude',
        config_parameter='store_locator.default_lat',
        help='Initial latitude of the map when no store matches or no geolocation is available.')
    store_locator_default_lng = fields.Float(
        string='Default Longitude',
        config_parameter='store_locator.default_lng',
        help='Initial longitude of the map when no store matches or no geolocation is available.')
    store_locator_default_zoom = fields.Integer(
        string='Default Zoom',
        config_parameter='store_locator.default_zoom',
        help='Initial zoom level of the map (1 = world, 15 = street).')
    store_locator_map_provider = fields.Selection(
        selection=[
            ('openstreetmap', 'OpenStreetMap (Leaflet)'),
            ('google', 'Google Maps'),
        ],
        string='Map Provider',
        default='openstreetmap',
        config_parameter='store_locator.map_provider',
        help='Engine used for the interactive map. Google Maps requires an API key.')
    store_locator_google_maps_api_key = fields.Char(
        string='Google Maps API Key',
        config_parameter='store_locator.google_maps_api_key',
        help='Required when the map provider is Google Maps. Create the key in the Google Cloud console.')
    store_locator_enable_osm = fields.Boolean(
        string='Enable OpenStreetMap Tiles',
        default=True,
        config_parameter='store_locator.enable_osm',
        help='If disabled, the map only works with a Google Maps API key.')
    store_locator_enable_geolocation = fields.Boolean(
        string='Enable Geolocation',
        default=True,
        config_parameter='store_locator.enable_geolocation',
        help='Ask visitors for their browser location to compute distances. The visitor position is never stored.')
    store_locator_enable_distance = fields.Boolean(
        string='Enable Distance',
        default=True,
        config_parameter='store_locator.enable_distance',
        help='Display the distance between the visitor and each store, and allow sorting by distance.')
    store_locator_search_radius = fields.Integer(
        string='Default Search Radius (km)',
        default=25,
        config_parameter='store_locator.search_radius',
        help='Radius (in kilometers) preselected for the "distance from me" filter. Visitors can change it.')
    store_locator_stores_per_page = fields.Integer(
        string='Stores Per Page',
        default=12,
        config_parameter='store_locator.stores_per_page',
        help='Number of stores returned per API page (between 1 and 48).')
    store_locator_primary_color = fields.Char(
        string='Primary Color',
        default='#2563eb',
        config_parameter='store_locator.primary_color',
        help='Main color of the store pages (buttons, chips, hero banner). '
             'Each Store Locator block can override it from the Website editor.')
    store_locator_accent_color = fields.Char(
        string='Accent Color',
        default='#f59e0b',
        config_parameter='store_locator.accent_color',
        help='Color used for featured stores (stars, featured markers).')
