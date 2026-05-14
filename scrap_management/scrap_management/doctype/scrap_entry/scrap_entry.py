import frappe
from frappe.model.document import Document
from frappe.utils import flt

class ScrapEntry(Document):

    def before_save(self):
        self.fetch_work_order_details()
        self.calculate_rows()
        self.calculate_totals()

    def fetch_work_order_details(self):
        if not self.work_order:
            return
        wo = frappe.get_doc("Work Order", self.work_order)
        self.bom = wo.bom_no
        self.production_item = wo.production_item
        self.fg_completed_qty = wo.qty
        self.company = wo.company

    def calculate_rows(self):
        for row in self.scrap_items:
            row.scrap_qty = max(0, flt(row.expected_qty) - flt(row.actual_qty))
            row.scrap_value = flt(row.scrap_qty) * flt(row.valuation_rate)
            row.dealer_value = flt(row.scrap_qty) * flt(row.dealer_rate)
            if self.default_scrap_action and not row.scrap_action:
                row.scrap_action = self.default_scrap_action
            if self.default_target_warehouse and not row.target_warehouse:
                row.target_warehouse = self.default_target_warehouse

    def calculate_totals(self):
        self.total_scrap_qty = sum(flt(r.scrap_qty) for r in self.scrap_items)
        self.total_scrap_value = sum(flt(r.scrap_value) for r in self.scrap_items)
        self.total_dealer_value = sum(flt(r.dealer_value) for r in self.scrap_items)

    def on_submit(self):
        self.create_stock_entries()

    def create_stock_entries(self):
        write_off = [r for r in self.scrap_items if r.scrap_action == "Write Off" and flt(r.scrap_qty) > 0]
        returns = [r for r in self.scrap_items if r.scrap_action == "Return to Stock" and flt(r.scrap_qty) > 0]
        if write_off:
            self._make_stock_entry("Material Issue", write_off)
        if returns:
            self._make_stock_entry("Material Transfer", returns)

    def _make_stock_entry(self, entry_type, items):
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = entry_type
        se.company = self.company
        se.posting_date = self.posting_date
        se.remarks = "Scrap Entry: {0}".format(self.name)
        for row in items:
            se.append("items", {
                "item_code": row.item_code,
                "qty": row.scrap_qty,
                "uom": row.uom,
                "s_warehouse": row.source_warehouse,
                "t_warehouse": row.target_warehouse if entry_type == "Material Transfer" else None,
                "basic_rate": row.valuation_rate,
            })
        se.insert(ignore_permissions=True)
        se.submit()
        frappe.msgprint("Stock Entry {0} created.".format(se.name), alert=True)
