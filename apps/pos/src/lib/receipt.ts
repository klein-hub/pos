import { formatPeso, TENDER_LABELS } from '@digita/core';
import type { RecordedSale, Shop } from '../backend/types';
import type { ShopCatalog } from '../store/shop';
import { formatDateTime, lineLabel } from './format';

/** Plain-text receipt for the share sheet — Messenger and SMS render nothing richer. */
export function receiptText(sale: RecordedSale, shop: Shop, catalog: ShopCatalog, demo: boolean): string {
  const { quote } = sale;
  const out: string[] = [
    shop.companyName,
    shop.locationName,
    '',
    `Receipt ${sale.receiptNo}`,
    formatDateTime(sale.soldAt),
    `Cashier: ${sale.cashier.name}`,
    '',
  ];

  for (const line of quote.lines) {
    const product = catalog.productOf(line.variantId);
    const variant = catalog.pricing.getVariant(line.variantId);
    const name =
      product && variant ? lineLabel(product.name, variant.size, catalog.variantsOf(product.id).length) : line.variantId;
    out.push(`${line.qty} x ${name}  ${formatPeso(line.lineGross)}`);
    for (const id of line.modifierIds) {
      out.push(`   + ${catalog.pricing.getModifier(id)?.name ?? id}`);
    }
  }

  out.push('', `Subtotal  ${formatPeso(quote.subtotal)}`);
  if (quote.discount) {
    const kind = quote.discount.kind === 'pwd' ? 'PWD' : 'Senior';
    out.push(
      `Less VAT exemption (${kind})  -${formatPeso(quote.vatExemption)}`,
      `Less 20% ${kind} discount  -${formatPeso(quote.exemptDiscount)}`,
      `${kind}: ${quote.discount.holderName}, ID ${quote.discount.idNumber}`,
    );
  }
  out.push(`TOTAL  ${formatPeso(quote.total)}`, '');

  for (const p of sale.payments) {
    out.push(`${TENDER_LABELS[p.method]}  ${formatPeso(p.tendered ?? p.amount)}${p.referenceNo ? `  Ref ${p.referenceNo}` : ''}`);
  }
  if (sale.change > 0) out.push(`Change  ${formatPeso(sale.change)}`);

  out.push(
    '',
    `VATable sales  ${formatPeso(quote.vatableSales)}`,
    `VAT (12%)  ${formatPeso(quote.vatAmount)}`,
    `VAT-exempt sales  ${formatPeso(quote.vatExemptSales)}`,
  );
  if (demo) out.push('', 'DEMO DATA — NOT AN OFFICIAL RECEIPT');

  return out.join('\n');
}
