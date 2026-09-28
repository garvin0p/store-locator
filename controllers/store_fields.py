# -*- coding: utf-8 -*-
"""Server-side filling of the "Store Page" building blocks.

The store detail page layout is a normal, fully editable website zone made of
static blocks (so the Website editor can move, clone and style them). Blocks
mark the places that show store data with ``data-sl-*`` attributes:

* ``data-sl-value="name"``  -> inner HTML replaced by the store value
* ``data-sl-href="phone"``  -> ``href`` set (the link/button text stays editable)
* ``data-sl-src="image"``   -> ``src`` / ``alt`` of an <img> set
* ``data-sl-if="phone|email"`` -> element hidden (class ``sl-field-empty``)
  when the store has none of those values. Editors still see it (dimmed).
* ``data-sl-geo``           -> ``data-sl-lat`` / ``data-sl-lng`` / ``data-sl-name`` set

The layout is shared by every store page, so it is filled on each request for
the current store. Filling happens on the final HTML with lxml.
"""
import re
from urllib.parse import quote

from lxml import html as lxml_html
from markupsafe import Markup

PLACEHOLDER_IMAGE = '/store_locator/static/src/img/store_placeholder.svg'

# Keys a block can test with data-sl-if (value present or not)
_DOCTYPE_RE = re.compile(rb'^\s*(<!DOCTYPE[^>]*>)', re.IGNORECASE)


def _render(env, template, values):
    return str(env['ir.qweb']._render(template, values))


def store_field_payload(env, store, locator_url='/store-locator'):
    """Everything the store page blocks can display for ``store``."""
    lat, lng = store.latitude, store.longitude
    has_geo = bool(lat or lng)
    address_query = store.full_address or store.name or ''
    directions = (
        'https://www.google.com/maps/dir/?api=1&destination=%s,%s' % (lat, lng)
        if has_geo else
        'https://www.google.com/maps/search/?api=1&query=%s' % quote(address_query))
    hours = store._get_opening_hours()
    gallery = []
    if store.image_1920:
        gallery.append({
            'url': '/web/image/store.location/%s/image_1920' % store.id,
            'alt': store.name, 'main': True,
        })
    for image in store.gallery_image_ids:
        gallery.append({
            'url': '/web/image/store.location.image/%s/image_1920' % image.id,
            'alt': image.name or store.name, 'main': False,
        })

    qvals = {
        'store': store,
        'hours': hours,
        'gallery': gallery,
        'locator_url': locator_url,
    }
    html = {
        'name': Markup.escape(store.name or ''),
        'short_description': Markup.escape(store.short_description or ''),
        'description': Markup(store.description or ''),
        'category': _render(env, 'store_locator.sl_value_category', qvals),
        'address': _render(env, 'store_locator.sl_value_address', qvals),
        'address_line': Markup.escape(store.full_address or ''),
        'city': Markup.escape(store.city or ''),
        'phone': Markup.escape(store.phone or ''),
        'mobile': Markup.escape(store.mobile or ''),
        'email': Markup.escape(store.email or ''),
        'website': Markup.escape((store.website or '').replace('https://', '').replace('http://', '')),
        'hours': _render(env, 'store_locator.sl_value_hours', qvals),
        'badges': _render(env, 'store_locator.sl_value_badges', qvals),
        'contact': _render(env, 'store_locator.sl_value_contact', qvals),
        'gallery': _render(env, 'store_locator.sl_value_gallery', qvals),
        'breadcrumb': _render(env, 'store_locator.sl_value_breadcrumb', qvals),
        'code': Markup.escape(store.code or '') if 'code' in store._fields else '',
    }
    href = {
        'directions': directions,
        'maps': store.google_maps_url or directions,
        'phone': 'tel:%s' % store.phone if store.phone else '',
        'mobile': 'tel:%s' % store.mobile if store.mobile else '',
        'email': 'mailto:%s' % store.email if store.email else '',
        'website': store.website or '',
        'locator': locator_url,
        'detail': store.website_url,
    }
    description_text = re.sub(r'<[^>]*>', '', store.description or '').strip()
    present = {
        'name': True,
        'short_description': bool(store.short_description),
        'description': bool(description_text),
        'image': bool(store.image_1920),
        'gallery': bool(gallery),
        'gallery_images': bool(store.gallery_image_ids),
        'phone': bool(store.phone),
        'mobile': bool(store.mobile),
        'email': bool(store.email),
        'website': bool(store.website),
        'contact': bool(store.phone or store.mobile or store.email or store.website),
        'hours': bool(store.is_24_hours or hours or store.opening_hours),
        'open24': bool(store.is_24_hours),
        'featured': bool(store.is_featured),
        'tags': bool(store.tag_ids),
        'address': bool(store.full_address),
        'map': has_geo,
        'geo': has_geo,
        'directions': True,
        'maps': True,
        'locator': True,
        'detail': True,
        'category': bool(store.category_id),
        'badges': True,
        'breadcrumb': True,
    }
    # Any other value block is "present" when it has content
    for key, value in html.items():
        present.setdefault(key, bool(str(value).strip()))
    return {
        'html': {k: str(v) for k, v in html.items()},
        'href': href,
        'src': {
            'image': '/web/image/store.location/%s/image_1920' % store.id if store.image_1920 else '',
        },
        'present': present,
        'geo': {
            'lat': lat, 'lng': lng, 'name': store.name or '',
            'address': store.full_address or '', 'featured': bool(store.is_featured),
        } if has_geo else {},
        'alt': store.name or '',
    }


def _is_present(payload, expression):
    keys = [k.strip() for k in (expression or '').split('|') if k.strip()]
    if not keys:
        return True
    present = payload['present']
    return any(present.get(key, False) for key in keys)


def _set_class(el, cls, enabled):
    classes = (el.get('class') or '').split()
    if enabled and cls not in classes:
        classes.append(cls)
    elif not enabled and cls in classes:
        classes.remove(cls)
    if classes:
        el.set('class', ' '.join(classes))
    elif 'class' in el.attrib:
        del el.attrib['class']


def _replace_inner(el, fragment):
    for child in list(el):
        el.remove(child)
    el.text = None
    if not fragment:
        return
    parts = lxml_html.fragments_fromstring(fragment)
    if parts and isinstance(parts[0], str):
        el.text = parts.pop(0)
    for part in parts:
        el.append(part)


def fill_document(page_html, payload):
    """Fill every data-sl-* marker of a rendered page for one store."""
    if isinstance(page_html, str):
        page_html = page_html.encode('utf-8')
    if b'data-sl-' not in page_html:
        return page_html
    match = _DOCTYPE_RE.match(page_html)
    doctype = match.group(1).decode() if match else '<!DOCTYPE html>'
    doc = lxml_html.document_fromstring(page_html)

    for el in doc.xpath('//*[@data-sl-value]'):
        key = el.get('data-sl-value')
        if key in payload['html']:
            _replace_inner(el, payload['html'][key])
            el.set('data-sl-filled', '1')
            _set_class(el, 'sl-field-empty', not payload['present'].get(key, True))

    for el in doc.xpath('//*[@data-sl-href]'):
        key = el.get('data-sl-href')
        value = payload['href'].get(key)
        if value is None:
            continue
        el.set('href', value or '#')
        _set_class(el, 'sl-field-empty', not value)
        if key in ('directions', 'maps', 'website') and value:
            el.set('target', '_blank')
            el.set('rel', 'noopener noreferrer')

    for el in doc.xpath('//*[@data-sl-src]'):
        key = el.get('data-sl-src')
        value = payload['src'].get(key)
        el.set('src', value or PLACEHOLDER_IMAGE)
        el.set('alt', payload['alt'])
        _set_class(el, 'sl-img-placeholder', not value)

    for el in doc.xpath('//*[@data-sl-geo]'):
        geo = payload['geo']
        for attr in ('lat', 'lng', 'name', 'address'):
            el.set('data-sl-%s' % attr, str(geo.get(attr, '')))
        el.set('data-sl-featured', '1' if geo.get('featured') else '')
        _set_class(el, 'sl-field-empty', not geo)

    for el in doc.xpath('//*[@data-sl-if]'):
        _set_class(el, 'sl-field-empty', not _is_present(payload, el.get('data-sl-if')))

    body = lxml_html.tostring(doc, encoding='utf-8', method='html')
    return doctype.encode() + b'\n' + body
