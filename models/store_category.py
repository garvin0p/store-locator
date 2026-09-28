# -*- coding: utf-8 -*-
from odoo import api, fields, models


class StoreCategory(models.Model):
    _name = 'store.category'
    _description = 'Store Category'
    _order = 'sequence, name, id'

    name = fields.Char(required=True, translate=True)
    description = fields.Text(translate=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)
    color = fields.Integer(string='Color Index', default=0)
    icon = fields.Char(
        string='Icon',
        help='FontAwesome icon class shown next to the category name, e.g. "fa fa-shopping-bag".')
    image = fields.Image(max_width=256, max_height=256)
    is_published = fields.Boolean(string='Published', default=True, index=True)
    store_ids = fields.One2many('store.location', 'category_id', string='Stores')
    store_count = fields.Integer(compute='_compute_store_count')

    @api.depends('store_ids')
    def _compute_store_count(self):
        for category in self:
            category.store_count = len(category.store_ids)

    def action_view_stores(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': self.env._('Stores'),
            'res_model': 'store.location',
            'view_mode': 'list,form',
            'domain': [('category_id', '=', self.id)],
            'context': {'default_category_id': self.id},
        }
