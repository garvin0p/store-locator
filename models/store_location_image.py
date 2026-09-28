# -*- coding: utf-8 -*-
from odoo import fields, models


class StoreLocationImage(models.Model):
    """One photo of a store's public gallery.

    Managed from the "Gallery" tab of the store form. Images are ordered by
    sequence and displayed on the public store detail page with a lightbox.
    """
    _name = 'store.location.image'
    _description = 'Store Location Image'
    _order = 'sequence, id'

    store_id = fields.Many2one(
        'store.location', string='Store', required=True,
        ondelete='cascade', index=True)
    name = fields.Char(
        string='Caption',
        help='Optional caption / filename shown in the backend and used as '
             'the image alt text on the public page.')
    sequence = fields.Integer(default=10)
    image_1920 = fields.Image(
        max_width=1920, max_height=1920, required=True)
