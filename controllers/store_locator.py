# -*- coding: utf-8 -*-
import logging
import re

from werkzeug.exceptions import NotFound

from odoo import http
from odoo.fields import Domain
from odoo.http import request

from .store_fields import fill_document, store_field_payload

_logger = logging.getLogger(__name__)

_COLOR_RE = re.compile(r'^#(?:[0-9a-fA-F]{3}){1,2}$')
DEFAULT_PRIMARY = '#2563eb'
DEFAULT_ACCENT = '#f59e0b'
MAX_PER_PAGE = 48


def _to_bool(value):
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_id_list(value):
    """Parse "1,2,3" (or a single id) into a list of positive ints."""
    if not value:
        return []
    ids = []
    for part in str(value).split(','):
        number = _to_int(part.strip())
        if number > 0:
            ids.append(number)
    return ids


def _safe_color(value, default):
    value = (value or '').strip()
    return value if _COLOR_RE.match(value) else default


class StoreLocatorController(http.Controller):

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _get_config(self):
        """Locator configuration from ir.config_parameter (never crash on bad values)."""
        ICP = request.env['ir.config_parameter'].sudo()

        def param(key, default, cast):
            try:
                return cast(ICP.get_param(key, default))
            except (TypeError, ValueError):
                return default

        provider = ICP.get_param('store_locator.map_provider', 'openstreetmap')
        return {
            'lat': param('store_locator.default_lat', 40.7128, float),
            'lng': param('store_locator.default_lng', -74.0060, float),
            'zoom': min(max(param('store_locator.default_zoom', 12, int), 1), 19),
            'radius': max(param('store_locator.search_radius', 25, int), 1),
            'geolocation': param('store_locator.enable_geolocation', True, _to_bool),
            'distance': param('store_locator.enable_distance', True, _to_bool),
            'osm': param('store_locator.enable_osm', True, _to_bool),
            'perPage': min(max(param('store_locator.stores_per_page', 12, int), 1), MAX_PER_PAGE),
            # Only send the Google key when actually needed: it is a client-side
            # (referrer-restricted) key, but never leak it if unused.
            'provider': provider if provider == 'google' else 'openstreetmap',
            'googleKey': ICP.get_param('store_locator.google_maps_api_key', '') if provider == 'google' else '',
            'primaryColor': _safe_color(ICP.get_param('store_locator.primary_color'), DEFAULT_PRIMARY),
            'accentColor': _safe_color(ICP.get_param('store_locator.accent_color'), DEFAULT_ACCENT),
        }

    def _public_domain(self):
        """Domain of stores visible to anonymous visitors on the current website."""
        domain = Domain([('active', '=', True), ('is_published', '=', True)])
        if request and getattr(request, 'website', None):
            domain &= request.website.website_domain()
        return domain

    def _search_domain(self, search=None, category_ids=None, country_id=None,
                       state_id=None, zip_code=None, featured=None, tag_ids=None,
                       open24=None, store_ids=None, exclude_ids=None, tag_filter=None):
        domain = self._public_domain()
        if search:
            search = search.strip()
            domain &= Domain.OR([
                [('name', 'ilike', search)],
                [('city', 'ilike', search)],
                [('zip', 'ilike', search)],
                [('street', 'ilike', search)],
            ])
        if category_ids:
            domain &= Domain('category_id', 'in', category_ids)
        if tag_ids:
            domain &= Domain('tag_ids', 'in', tag_ids)
        if tag_filter:
            domain &= Domain('tag_ids', 'in', tag_filter)
        if store_ids:
            domain &= Domain('id', 'in', store_ids)
        if exclude_ids:
            domain &= Domain('id', 'not in', exclude_ids)
        country_id = _to_int(country_id)
        if country_id:
            domain &= Domain('country_id', '=', country_id)
        state_id = _to_int(state_id)
        if state_id:
            domain &= Domain('state_id', '=', state_id)
        if zip_code:
            domain &= Domain('zip', 'ilike', zip_code.strip())
        if _to_bool(featured or ''):
            domain &= Domain('is_featured', '=', True)
        if _to_bool(open24 or ''):
            domain &= Domain('is_24_hours', '=', True)
        return domain

    def _prepare_public_store(self, store):
        """Convert a store record into a whitelisted, public-safe dict."""
        return {
            'id': store.id,
            'name': store.name,
            'categoryId': store.category_id.id,
            'category': store.category_id.name,
            'categoryIcon': store.category_id.icon or '',
            'shortDescription': store.short_description or '',
            'imageUrl': '/web/image/store.location/%s/image_1920' % store.id if store.image_1920 else '',
            'street': store.street or '',
            'street2': store.street2 or '',
            'city': store.city or '',
            'zip': store.zip or '',
            'stateId': store.state_id.id,
            'state': store.state_id.name or '',
            'countryId': store.country_id.id,
            'country': store.country_id.name or '',
            'address': store.full_address or '',
            'phone': store.phone or '',
            'mobile': store.mobile or '',
            'email': store.email or '',
            'website': store.website or '',
            'lat': store.latitude,
            'lng': store.longitude,
            'is24Hours': store.is_24_hours,
            'openingHours': store.opening_hours or '',
            'hours': store._get_opening_hours(),
            'featured': store.is_featured,
            'tags': [{'id': tag.id, 'name': tag.name, 'color': tag.color} for tag in store.tag_ids],
            'gallery': [
                {
                    'id': image.id,
                    'name': image.name or store.name,
                    'imageUrl': '/web/image/store.location.image/%s/image_1920' % image.id,
                }
                for image in store.gallery_image_ids
            ],
            'googleMapsUrl': store.google_maps_url or '',
            'detailUrl': store.website_url,
        }

    def _get_filter_options(self, domain=None, category_ids=None):
        """Categories / countries / states used by the frontend filters."""
        category_domain = [('is_published', '=', True)]
        if category_ids:
            category_domain.append(('id', 'in', category_ids))
        categories = request.env['store.category'].sudo().search_read(
            category_domain, ['name', 'icon', 'color'], order='sequence, name')
        stores_brief = request.env['store.location'].sudo().search_read(
            domain if domain is not None else self._public_domain(),
            ['state_id', 'country_id', 'tag_ids', 'is_24_hours', 'is_featured'])
        tag_ids = {tag for row in stores_brief for tag in row['tag_ids']}
        tags = request.env['store.tag'].sudo().search_read(
            [('id', 'in', list(tag_ids))], ['name', 'color'], order='sequence, name')
        country_ids = {row['country_id'][0] for row in stores_brief if row['country_id']}
        state_ids = {row['state_id'][0] for row in stores_brief if row['state_id']}
        countries = request.env['res.country'].sudo().search_read(
            [('id', 'in', list(country_ids))], ['name'], order='name')
        states = request.env['res.country.state'].sudo().search_read(
            [('id', 'in', list(state_ids))], ['name', 'country_id'], order='name')
        return {
            'categories': [
                {'id': c['id'], 'name': c['name'], 'icon': c['icon'] or '', 'color': c['color']}
                for c in categories
            ],
            'countries': [{'id': c['id'], 'name': c['name']} for c in countries],
            'states': [
                {'id': s['id'], 'name': s['name'], 'countryId': s['country_id'][0]}
                for s in states
            ],
            'tags': [{'id': t['id'], 'name': t['name'], 'color': t['color']} for t in tags],
            'hasOpen24': any(row['is_24_hours'] for row in stores_brief),
            'hasFeatured': any(row['is_featured'] for row in stores_brief),
        }

    _ORDERS = {
        'default': 'is_featured desc, sequence, name',
        'name': 'name',
        'latest': 'create_date desc, id desc',
        'featured': 'is_featured desc, sequence, name',
        'sequence': 'sequence, name',
    }

    def _get_store_page(self, domain, page=1, limit=None, order=None, store_ids=None,
                        near=None):
        """One page of stores.

        ``store_ids``: manual selection, returned in that order.
        ``near``: store record; results sorted by distance to it.
        """
        Store = request.env['store.location'].sudo()
        limit = min(max(_to_int(limit, 0), 1), MAX_PER_PAGE) if limit else self._get_config()['perPage']
        page = max(_to_int(page, 1), 1)
        offset = (page - 1) * limit
        distances = {}
        if store_ids or near:
            stores = Store.search(domain)
            if store_ids:
                rank = {sid: index for index, sid in enumerate(store_ids)}
                stores = stores.sorted(lambda s: rank.get(s.id, len(rank)))
            else:
                pairs = near._get_nearby_stores(stores, limit=len(stores))
                distances = {store.id: km for store, km in pairs}
                stores = Store.browse([store.id for store, _km in pairs])
            total = len(stores)
            stores = stores[offset:offset + limit]
        else:
            total = Store.search_count(domain)
            stores = Store.search(
                domain, offset=offset, limit=limit,
                order=self._ORDERS.get(order or 'default', self._ORDERS['default']))
        result = []
        for store in stores:
            data = self._prepare_public_store(store)
            if store.id in distances:
                data['distanceKm'] = round(distances[store.id], 2)
            result.append(data)
        return {
            'stores': result,
            'total': total,
            'page': page,
            'limit': limit,
            'hasMore': offset + len(stores) < total,
        }

    def _related_domain(self, store, relation):
        """Domain of stores related to ``store`` (current store excluded)."""
        domain = Domain('id', '!=', store.id)
        if relation == 'category' and store.category_id:
            domain &= Domain('category_id', '=', store.category_id.id)
        elif relation == 'tags' and store.tag_ids:
            domain &= Domain('tag_ids', 'in', store.tag_ids.ids)
        elif relation == 'city' and store.city:
            domain &= Domain('city', '=ilike', store.city)
        elif relation == 'state' and store.state_id:
            domain &= Domain('state_id', '=', store.state_id.id)
        elif relation == 'country' and store.country_id:
            domain &= Domain('country_id', '=', store.country_id.id)
        elif relation in ('category', 'tags', 'city', 'state', 'country'):
            domain = Domain.FALSE
        return domain

    # ------------------------------------------------------------------
    # Bootstrap for the Website Builder "Store Locator" block
    # ------------------------------------------------------------------
    @http.route(
        '/store-locator/bootstrap', type='http', auth='public', methods=['GET'],
        website=True, sitemap=False, readonly=True)
    def store_locator_bootstrap(self, category_ids=None, featured=None, limit=None,
                                tag_ids=None, order=None, **kw):
        """Everything the locator block needs to boot in one request.

        ``category_ids`` / ``featured`` come from the block options set in the
        Website editor and permanently restrict the stores of that block.
        """
        try:
            config = self._get_config()
            categories = _to_id_list(category_ids)
            base_domain = self._search_domain(
                category_ids=categories, featured=featured, tag_ids=_to_id_list(tag_ids))
            data = self._get_store_page(
                base_domain, page=1, limit=limit or config['perPage'], order=order)
            data.update(self._get_filter_options(domain=base_domain, category_ids=categories))
            data['config'] = config
            return request.make_json_response(data)
        except Exception:
            _logger.exception('Store locator bootstrap failure')
            return request.make_json_response(
                {'error': 'Unable to load the stores. Please try again later.'}, status=500)

    # ------------------------------------------------------------------
    # JSON API (paginated)
    # ------------------------------------------------------------------
    @http.route(
        '/store-locator/stores', type='http', auth='public',
        methods=['GET'], website=True, sitemap=False, readonly=True)
    def store_locator_api(self, page='1', limit=None, search=None,
                          category_id=None, category_ids=None, category_filter=None,
                          country_id=None, state_id=None, zip_code=None, featured=None,
                          tag_ids=None, tag_filter=None, open24=None, store_ids=None,
                          exclude_ids=None, related_to=None, relation=None, order=None,
                          **post):
        """Public store search.

        Block restrictions (set in the Website editor): ``category_ids``,
        ``tag_ids``, ``featured``, ``store_ids`` (manual pick, kept in order).
        Visitor filters: ``search``, ``category_filter`` / ``category_id``,
        ``tag_filter``, ``country_id``, ``state_id``, ``zip_code``, ``open24``.
        Related stores: ``related_to=<store id>`` + ``relation`` (nearby,
        category, tags, city, state, country, any); the store itself is always
        excluded. ``exclude_ids`` removes more stores. ``order``: default,
        name, latest, sequence.
        """
        try:
            categories = _to_id_list(category_ids)
            chosen = _to_id_list(category_filter) or _to_id_list(category_id)
            if chosen:
                # Visitor filters can only narrow a block restriction.
                categories = [c for c in chosen if not categories or c in categories] or [0]
            manual_ids = _to_id_list(store_ids)
            domain = self._search_domain(
                search=search, category_ids=categories, country_id=country_id,
                state_id=state_id, zip_code=zip_code, featured=featured,
                tag_ids=_to_id_list(tag_ids), tag_filter=_to_id_list(tag_filter),
                open24=open24, store_ids=manual_ids, exclude_ids=_to_id_list(exclude_ids))
            near = None
            if related_to:
                current = request.env['store.location'].sudo().browse(_to_int(related_to)).exists()
                if not current:
                    return request.make_json_response(
                        {'stores': [], 'total': 0, 'page': 1, 'limit': 0, 'hasMore': False})
                relation = relation or 'nearby'
                domain &= self._related_domain(current, relation)
                if relation == 'nearby' and current._has_coordinates():
                    near = current
            return request.make_json_response(self._get_store_page(
                domain, page=page, limit=limit, order=order,
                store_ids=manual_ids or None, near=near))
        except Exception:
            _logger.exception('Store locator API failure')
            return request.make_json_response(
                {'error': 'Unable to load the stores. Please try again later.'},
                status=500)

    @http.route('/store-locator/store-fields', type='jsonrpc', auth='user', website=True, readonly=True)
    def store_fields_preview(self, store_id):
        """Values of the Store Page blocks, used by the editor to preview a
        freshly dropped block without saving."""
        store = request.env['store.location'].browse(_to_int(store_id)).exists()
        if not store or not store.has_access('read'):
            return {}
        return store_field_payload(request.env, store.sudo(), locator_url='/store-locator')

    # ------------------------------------------------------------------
    # Store detail page
    # ------------------------------------------------------------------
    def sitemap_stores(env, rule, qs):
        Store = env['store.location'].sudo()
        domain = Domain([('active', '=', True), ('is_published', '=', True)])
        domain &= env['website'].get_current_website().website_domain()
        for store in Store.search(domain):
            loc = '/store-locator/store/%s' % env['ir.http']._slug(store)
            if not qs or qs.lower() in loc:
                yield {'loc': loc}

    @http.route(
        '/store-locator/store/<model("store.location"):store>', type='http', auth='public',
        website=True, sitemap=sitemap_stores)
    def store_locator_detail(self, store, **post):
        store_id = store.id
        store = request.env['store.location'].sudo().search(
            self._public_domain() & Domain('id', '=', store_id), limit=1)
        if not store and request.env['store.location'].has_access('write'):
            # Let editors preview unpublished stores, like any other website record.
            store = request.env['store.location'].sudo().with_context(
                active_test=False).browse(store_id).exists()
        if not store:
            raise NotFound()

        if request.env['store.location'].has_access('write'):
            # Editors get a non-sudo record so the Website editor can save
            # inline edits (t-field) with their own access rights.
            store = store.sudo(False)

        config = self._get_config()
        values = {
            'store': store,
            'main_object': store,
            'sl_style': '--sl-primary: %s; --sl-accent: %s;' % (
                config['primaryColor'], config['accentColor']),
            'locator_url': '/store-locator',
        }
        response = request.render('store_locator.store_locator_store_page', values)
        # The page layout is made of editable blocks shared by all stores:
        # fill their data-sl-* markers with this store's data.
        response.flatten()
        payload = store_field_payload(request.env, store.sudo(), locator_url='/store-locator')
        response.set_data(fill_document(response.get_data(), payload))
        return response
