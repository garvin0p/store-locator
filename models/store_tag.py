# -*- coding: utf-8 -*-
from odoo import fields, models


class StoreTag(models.Model):
    _name = 'store.tag'
    _description = 'Store Tag'
    _order = 'sequence, name, id'

    name = fields.Char(required=True, translate=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)
    color = fields.Integer(string='Color Index', default=0, help='Color used on tags displayed in the frontend.')
