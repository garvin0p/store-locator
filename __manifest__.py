# -*- coding: utf-8 -*-
# Part of store_locator. See README.md for full documentation.
{
    'name': 'Store Locator',
    'version': '19.0.3.0.0',
    'category': 'Website/Website',
    'summary': 'Store locator built for the Website editor: drag-and-drop blocks, map, search, filters, editable store pages',
    'description': """
Store Locator
=============
Manage your physical stores in the Odoo backend and publish them with the
Website editor:

* "Store Locator" building blocks (Website > Edit > Blocks > Store Locator):
  interactive locator (map + list + search + filters), hero banner and store
  cards — drop them on any page and configure everything from the sidebar
  (layout, height, colors, categories, featured only, filters, card parts...)
* Default /store-locator page, fully editable, managed in Website > Pages
* Store detail pages editable in the Website editor: "Store Page" options
  (layout, hero, breadcrumb, gallery, hours, contact, about, map, nearby
  stores, back button), drop zones and inline editing
* OpenStreetMap (Leaflet) or Google Maps, geolocation, distance sort/filter
* SEO: slug URLs, sitemap, meta tags, publish toggle, multi-website
""",
    'author': 'Insignia Techno Labs',
    'website': 'https://www.insigniatechnolabs.com',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/store_locator_page.xml',
        'data/store_locator_data.xml',
        'views/store_location_views.xml',
        'views/store_category_views.xml',
        'views/store_locator_settings.xml',
        'views/store_field_values.xml',
        'views/store_locator_templates.xml',
        'views/snippets/s_store_locator.xml',
        'views/snippets/s_store_blocks.xml',
        'views/store_locator_menus.xml',
    ],
    'demo': [
        'demo/store_locator_demo.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'store_locator/static/lib/leaflet/leaflet.css',
            'store_locator/static/lib/leaflet/leaflet.js',
            'store_locator/static/src/scss/store_locator.scss',
            'store_locator/static/src/scss/store_blocks.scss',
            'store_locator/static/src/xml/store_locator.xml',
            'store_locator/static/src/finder/finder.xml',
            'store_locator/static/src/finder/*.js',
            'store_locator/static/src/js/store_locator_map.js',
            'store_locator/static/src/js/store_locator.js',
            'store_locator/static/src/snippets/**/*.js',
            ('remove', 'store_locator/static/src/snippets/**/*.edit.js'),
        ],
        # Edit-mode flavour of the block interactions (live preview in the editor)
        'website.assets_inside_builder_iframe': [
            'store_locator/static/src/snippets/**/*.edit.js',
        ],
        # Builder sidebar options
        'website.website_builder_assets': [
            'store_locator/static/src/website_builder/**/*',
        ],
    },
    'application': True,
    'installable': True,
    'auto_install': False,
}
