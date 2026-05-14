frappe.ui.form.on('Scrap Entry', {
    work_order(frm) {
        if (!frm.doc.work_order) return;
        frappe.call({
            method: 'frappe.client.get',
            args: { doctype: 'Work Order', name: frm.doc.work_order },
            callback(r) {
                if (!r.message) return;
                let wo = r.message;
                frm.set_value('bom', wo.bom_no);
                frm.set_value('production_item', wo.production_item);
                frm.set_value('fg_completed_qty', wo.qty);
                frm.set_value('company', wo.company);
                frm.clear_table('scrap_items');
                if (!wo.bom_no) return;
                frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: 'BOM', name: wo.bom_no },
                    callback(b) {
                        if (!b.message) return;
                        b.message.items.forEach(item => {
                            let row = frm.add_child('scrap_items');
                            row.item_code = item.item_code;
                            row.item_name = item.item_name;
                            row.expected_qty = item.qty;
                            row.actual_qty = item.qty;
                            row.scrap_qty = 0;
                            row.uom = item.uom;
                            row.scrap_action = frm.doc.default_scrap_action || 'Write Off';
                            row.target_warehouse = frm.doc.default_target_warehouse || '';
                        });
                        frm.refresh_field('scrap_items');
                        frm.doc.scrap_items.forEach(row => {
                            frappe.db.get_value('Item', row.item_code, 'valuation_rate', v => {
                                if (v && v.valuation_rate) {
                                    frappe.model.set_value(row.doctype, row.name, 'valuation_rate', v.valuation_rate);
                                }
                            });
                        });
                    }
                });
            }
        });
    },
    default_scrap_action(frm) {
        frm.doc.scrap_items.forEach(row => {
            frappe.model.set_value(row.doctype, row.name, 'scrap_action', frm.doc.default_scrap_action);
        });
    },
    default_target_warehouse(frm) {
        frm.doc.scrap_items.forEach(row => {
            frappe.model.set_value(row.doctype, row.name, 'target_warehouse', frm.doc.default_target_warehouse);
        });
    }
});

frappe.ui.form.on('Scrap Entry Item', {
    actual_qty(frm, cdt, cdn) { recalc(frm, cdt, cdn); },
    dealer_rate(frm, cdt, cdn) { recalc(frm, cdt, cdn); },
    valuation_rate(frm, cdt, cdn) { recalc(frm, cdt, cdn); }
});

function recalc(frm, cdt, cdn) {
    let r = locals[cdt][cdn];
    let scrap_qty = Math.max(0, flt(r.expected_qty) - flt(r.actual_qty));
    frappe.model.set_value(cdt, cdn, 'scrap_qty', scrap_qty);
    frappe.model.set_value(cdt, cdn, 'scrap_value', scrap_qty * flt(r.valuation_rate));
    frappe.model.set_value(cdt, cdn, 'dealer_value', scrap_qty * flt(r.dealer_rate));
    let total_qty = 0, total_val = 0, total_dealer = 0;
    frm.doc.scrap_items.forEach(row => {
        total_qty += flt(row.scrap_qty);
        total_val += flt(row.scrap_value);
        total_dealer += flt(row.dealer_value);
    });
    frm.set_value('total_scrap_qty', total_qty);
    frm.set_value('total_scrap_value', total_val);
    frm.set_value('total_dealer_value', total_dealer);
}
