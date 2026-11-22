/**
 * Lightweight payslip printing utility.
 *
 * Opens a hidden new window with print-friendly HTML so users can save a
 * polished payslip as PDF via the browser's native print dialog. Works
 * without extra dependencies.
 */

import {
  type PayComponentGroup,
  type TemplateBlock,
  resolveBlockItems,
} from "./payTemplateLayout";

export interface PayslipLine {
  code?: string;
  name: string;
  amount: number;
  category: "earning" | "deduction" | string;
  sequence?: number;
}

export interface PayslipData {
  companyName?: string;
  companyAddress?: string;
  companyTin?: string;
  employeeName: string;
  employeePosition?: string;
  employeeDepartment?: string;
  employeeId?: string | number;
  daysWorked?: string | number | null;
  periodStart: string | Date;
  periodEnd: string | Date;
  lines: PayslipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  payRunName?: string;
  paidDate?: string | Date | null;
  layoutBlocks?: TemplateBlock[] | null;
  componentGroups?: PayComponentGroup[];
}

const fmt = (amount: number) =>
  "₱" +
  (Number(amount) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString();
};

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

const escapeWithBreaks = (s: string) => escape(s).replace(/\n/g, "<br />");

const renderTableRows = (
  lines: PayslipLine[],
  options: { negative?: boolean; showCodes?: boolean } = {},
) => {
  const { negative = false, showCodes = false } = options;

  return lines.length === 0
    ? '<tr><td class="muted" colspan="2">None.</td></tr>'
    : lines
        .map(
          (line) => `
            <tr>
              <td>
                ${showCodes && line.code ? `<div class="code">${escape(line.code)}</div>` : ""}
                <div>${escape(line.name)}</div>
              </td>
              <td class="amt ${negative ? "neg" : ""}">${negative ? "-" : ""}${fmt(line.amount)}</td>
            </tr>`,
        )
        .join("");
};

const renderDefaultLayout = (data: PayslipData) => {
  const earnings = data.lines.filter((line) => line.category === "earning");
  const deductions = data.lines.filter((line) => line.category === "deduction");

  return `
    <div class="header-block">
      <div>
        <div class="brand">${escape(data.companyName || "Payroll")}</div>
        <div class="subline">Employee Payslip</div>
      </div>
      <div class="doc">
        <strong>${escape(data.payRunName || "Pay Run")}</strong>
        <div>Generated ${escape(new Date().toLocaleString())}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="label">Employee</div>
        <div class="val">${escape(data.employeeName)}</div>
      </div>
      <div>
        <div class="label">Position</div>
        <div class="val">${escape(data.employeePosition || "—")}</div>
      </div>
      <div>
        <div class="label">Employee ID</div>
        <div class="val">${escape(String(data.employeeId ?? "—"))}</div>
      </div>
      <div>
        <div class="label">Pay Period</div>
        <div class="val">${escape(fmtDate(data.periodStart))} – ${escape(fmtDate(data.periodEnd))}</div>
      </div>
    </div>

    <section>
      <h2 class="earn">Earnings</h2>
      <table>${renderTableRows(earnings)}</table>
    </section>

    <section>
      <h2 class="ded">Deductions</h2>
      <table>${renderTableRows(deductions, { negative: true })}</table>
    </section>

    <div class="totals">
      <div class="row"><span>Gross Pay</span><span class="amt">${fmt(data.grossPay)}</span></div>
      <div class="row"><span>Total Deductions</span><span class="amt neg">-${fmt(data.totalDeductions)}</span></div>
      <div class="net"><span>NET PAY</span><span class="amount">${fmt(data.netPay)}</span></div>
    </div>`;
};

const renderTemplateLayout = (data: PayslipData) => {
  const blocks = data.layoutBlocks ?? [];
  const groups = data.componentGroups ?? [];
  const layoutLines = data.lines.map((line, index) => ({
    ...line,
    code: line.code ?? "",
    sequence: line.sequence ?? index,
  }));
  const blockRowsById = resolveBlockItems(blocks, layoutLines, groups);

  return blocks
    .map((block) => {
      const cfg = block.config ?? {};

      switch (block.type) {
        case "company-header":
          return `
            <div class="header-block">
              <div>
                <div class="brand">${escape(data.companyName || "Payroll")}</div>
                ${cfg.showAddress !== false && data.companyAddress ? `<div class="subline">${escape(data.companyAddress)}</div>` : ""}
                ${cfg.showTin !== false && data.companyTin ? `<div class="subline">TIN: ${escape(data.companyTin)}</div>` : ""}
              </div>
              <div class="doc">
                <strong>${escape(cfg.title || "PAYSLIP")}</strong>
                <div>${escape(data.payRunName || "Pay Run")}</div>
                <div>Generated ${escape(new Date().toLocaleString())}</div>
              </div>
            </div>`;

        case "employee-info": {
          const fields = [
            { label: "Employee Name", value: data.employeeName },
            ...(cfg.showId !== false
              ? [
                  {
                    label: "Employee ID",
                    value: String(data.employeeId ?? "—"),
                  },
                ]
              : []),
            ...(cfg.showPosition !== false
              ? [{ label: "Position", value: data.employeePosition || "—" }]
              : []),
            ...(cfg.showDepartment !== false
              ? [{ label: "Department", value: data.employeeDepartment || "—" }]
              : []),
          ];

          return `
            <section>
              <h2>Employee Information</h2>
              <div class="meta-grid">
                ${fields
                  .map(
                    (field) => `
                      <div>
                        <div class="label">${escape(field.label)}</div>
                        <div class="val">${escape(String(field.value))}</div>
                      </div>`,
                  )
                  .join("")}
              </div>
            </section>`;
        }

        case "pay-period": {
          const fields = [
            {
              label: "Pay Period",
              value: `${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`,
            },
            ...(cfg.showPayDate !== false
              ? [
                  {
                    label: "Pay Date",
                    value: fmtDate(data.paidDate || new Date()),
                  },
                ]
              : []),
            ...(cfg.showDaysWorked !== false && data.daysWorked != null
              ? [{ label: "Days Worked", value: String(data.daysWorked) }]
              : []),
          ];

          return `
            <section>
              <div class="period-strip">
                ${fields
                  .map(
                    (field) => `
                      <div>
                        <div class="label">${escape(field.label)}</div>
                        <div class="val">${escape(String(field.value))}</div>
                      </div>`,
                  )
                  .join("")}
              </div>
            </section>`;
        }

        case "earnings-table": {
          const lines = blockRowsById[block.id] ?? [];
          const groupName = groups.find(
            (group) => group.code === cfg.groupCode,
          )?.name;
          return `
            <section>
              <h2 class="earn">${escape(cfg.title || "Earnings")}</h2>
              ${groupName ? `<div class="section-chip earn-chip">${escape(groupName)}</div>` : ""}
              <table>${renderTableRows(lines, { showCodes: cfg.showCodes !== false })}</table>
            </section>`;
        }

        case "deductions-table": {
          const lines = blockRowsById[block.id] ?? [];
          const groupName = groups.find(
            (group) => group.code === cfg.groupCode,
          )?.name;
          return `
            <section>
              <h2 class="ded">${escape(cfg.title || "Deductions")}</h2>
              ${groupName ? `<div class="section-chip ded-chip">${escape(groupName)}</div>` : ""}
              <table>${renderTableRows(lines, { negative: true, showCodes: cfg.showCodes !== false })}</table>
            </section>`;
        }

        case "net-summary": {
          const summaryItems = [
            ...(cfg.showGross !== false
              ? [
                  {
                    label: "Gross Earnings",
                    value: fmt(data.grossPay),
                    tone: "green",
                  },
                ]
              : []),
            ...(cfg.showDeductions !== false
              ? [
                  {
                    label: "Total Deductions",
                    value: `-${fmt(data.totalDeductions)}`,
                    tone: "red",
                  },
                ]
              : []),
            { label: "Net Pay", value: fmt(data.netPay), tone: "teal" },
          ];

          return `
            <section>
              <div class="summary-grid">
                ${summaryItems
                  .map(
                    (item) => `
                      <div class="summary-card ${item.tone}">
                        <div class="summary-label">${escape(item.label)}</div>
                        <div class="summary-value">${escape(item.value)}</div>
                      </div>`,
                  )
                  .join("")}
              </div>
            </section>`;
        }

        case "custom-text":
          return `
            <section>
              <div class="custom-text ${escape(String(cfg.align || "left"))}">${escapeWithBreaks(String(cfg.text || ""))}</div>
            </section>`;

        case "separator":
          return `<hr class="sep ${escape(String(cfg.style || "solid"))}" />`;

        case "signature-line": {
          const labels =
            Array.isArray(cfg.labels) && cfg.labels.length > 0
              ? cfg.labels
              : ["Prepared by", "Checked by", "Received by"];

          return `
            <section>
              <div class="signature-grid">
                ${labels
                  .map(
                    (label) => `
                      <div class="signature-item">
                        <div class="signature-line"></div>
                        <div class="signature-label">${escape(String(label))}</div>
                      </div>`,
                  )
                  .join("")}
              </div>
            </section>`;
        }

        default:
          return "";
      }
    })
    .join("");
};

export const printPayslip = (data: PayslipData) => {
  const bodyHtml =
    (data.layoutBlocks?.length ?? 0) > 0
      ? renderTemplateLayout(data)
      : renderDefaultLayout(data);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Payslip — ${escape(data.employeeName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif;
    color: #1a202c;
    margin: 0;
    padding: 32px;
    background: #fff;
  }
  .sheet { max-width: 760px; margin: 0 auto; }
  section { margin-bottom: 18px; }
  .header-block { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2d3748; padding-bottom: 12px; margin-bottom: 16px; gap: 16px; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #1a365d; }
  .subline { font-size: 12px; color: #718096; margin-top: 2px; }
  .doc { text-align: right; font-size: 12px; color: #4a5568; }
  .doc strong { font-size: 14px; color: #1a202c; display: block; margin-bottom: 2px; }
  .meta-grid, .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; font-size: 13px; }
  .label { color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .val { color: #1a202c; font-weight: 500; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; margin: 18px 0 6px; }
  h2.earn { color: #276749; }
  h2.ded { color: #9b2c2c; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 8px; border-bottom: 1px solid #edf2f7; }
  td .code { font-size: 10px; color: #718096; letter-spacing: 0.06em; text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 2px; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  td.neg { color: #c53030; }
  td.muted { color: #a0aec0; font-style: italic; padding: 8px; }
  .section-chip { display: inline-block; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .earn-chip { background: #f0fff4; color: #276749; }
  .ded-chip { background: #fff5f5; color: #9b2c2c; }
  .totals { margin-top: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .net, .net { margin-top: 8px; padding: 12px; background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; font-weight: 700; font-size: 16px; color: #22543d; display:flex;justify-content:space-between;align-items:center; }
  .totals .net .amount, .net .amount { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .summary-card { border-radius: 10px; padding: 12px; text-align: center; }
  .summary-card.green { background: #f0fff4; color: #276749; }
  .summary-card.red { background: #fff5f5; color: #9b2c2c; }
  .summary-card.teal { background: #e6fffa; color: #234e52; }
  .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .summary-value { font-size: 15px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .period-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f7fafc; }
  .custom-text.left { text-align: left; }
  .custom-text.center { text-align: center; }
  .custom-text.right { text-align: right; }
  .sep { border: 0; border-top: 1px solid #cbd5e0; margin: 16px 0; }
  .sep.dashed { border-top-style: dashed; }
  .sep.dotted { border-top-style: dotted; }
  .signature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 24px; padding-top: 20px; }
  .signature-item { text-align: center; }
  .signature-line { border-top: 1px solid #2d3748; margin-bottom: 6px; }
  .signature-label { font-size: 11px; color: #718096; }
  .footer { margin-top: 28px; font-size: 11px; color: #a0aec0; text-align: center; }
  .stamp { display: inline-block; margin-top: 4px; padding: 4px 10px; border: 1px dashed #cbd5e0; border-radius: 999px; color: #718096; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
  @media print {
    body { padding: 12mm; }
    .no-print { display: none !important; }
    @page { margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="sheet">
    ${bodyHtml}

    <div class="footer">
      ${data.paidDate ? `<div>Paid on ${escape(fmtDate(data.paidDate))}</div>` : ""}
      <div class="stamp">Computer-generated payslip — no signature required</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 80);
    });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
};
