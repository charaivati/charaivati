import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#111827", backgroundColor: "#fff" },
  heading: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subHeading: { fontSize: 8, color: "#6B7280", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  col: { flex: 1 },
  label: { fontSize: 7, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 9, marginBottom: 2 },
  valueBold: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  divider: { borderBottom: "1pt solid #E5E7EB", marginVertical: 12 },
  metaBox: { alignItems: "flex-end", marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F9FAFB", padding: "6 4", borderBottom: "1pt solid #E5E7EB" },
  tableRow: { flexDirection: "row", padding: "5 4", borderBottom: "1pt solid #F3F4F6" },
  tableRowAlt: { flexDirection: "row", padding: "5 4", borderBottom: "1pt solid #F3F4F6", backgroundColor: "#FAFAFA" },
  cellDesc: { flex: 4, fontSize: 9 },
  cellNum: { flex: 1, textAlign: "right", fontSize: 9 },
  cellHead: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#6B7280" },
  totalsBox: { alignItems: "flex-end", marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 40, marginTop: 3 },
  totalLabel: { fontSize: 9, color: "#6B7280", width: 100, textAlign: "right" },
  totalValue: { fontSize: 9, width: 70, textAlign: "right" },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", width: 100, textAlign: "right" },
  grandValue: { fontSize: 10, fontFamily: "Helvetica-Bold", width: 70, textAlign: "right" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: "#E5E7EB", borderTopStyle: "solid", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#9CA3AF" },
  badge: { backgroundColor: "#F3F4F6", padding: "3 8", borderRadius: 4, fontSize: 8, color: "#374151", alignSelf: "flex-start", marginBottom: 12 },
});

export type InvoiceDocumentProps = {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "tax_invoice" | "bill_of_supply";
  seller: { legalName: string; companyName?: string; gstin?: string; gstState?: string; address?: string; city?: string; state?: string; pinCode?: string };
  buyer: { legalName: string; companyName?: string; gstin?: string; address?: string; city?: string; state?: string; pinCode?: string };
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  gstAmount?: number;
  gstRate?: number;
  grandTotal: number;
  notes?: string;
};

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PartyBlock({ title, p }: { title: string; p: InvoiceDocumentProps["seller"] }) {
  const addrLine = [p.address, p.city, p.state, p.pinCode].filter(Boolean).join(", ");
  return (
    <View style={S.col}>
      <Text style={S.label}>{title}</Text>
      <Text style={S.valueBold}>{p.legalName}</Text>
      {p.companyName ? <Text style={S.value}>{p.companyName}</Text> : null}
      {p.gstin ? <Text style={S.value}>GSTIN: {p.gstin}</Text> : null}
      {p.gstState ? <Text style={S.value}>State: {p.gstState}</Text> : null}
      {addrLine ? <Text style={{ ...S.value, color: "#6B7280" }}>{addrLine}</Text> : null}
    </View>
  );
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const { invoiceNumber, invoiceDate, invoiceType, seller, buyer, items, subtotal, gstAmount, gstRate, grandTotal, notes } = props;
  const isTax = invoiceType === "tax_invoice";

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Heading */}
        <Text style={S.heading}>{isTax ? "TAX INVOICE" : "BILL OF SUPPLY"}</Text>
        {!isTax && (
          <Text style={S.subHeading}>
            This is not a GST invoice. Input tax credit is not available.
          </Text>
        )}

        {/* Meta */}
        <View style={S.metaBox}>
          <Text style={S.valueBold}>{invoiceNumber}</Text>
          <Text style={{ ...S.value, color: "#6B7280" }}>{invoiceDate}</Text>
        </View>

        <View style={S.divider} />

        {/* Parties */}
        <View style={S.row}>
          <PartyBlock title="Seller / Billed By" p={seller} />
          <PartyBlock title="Buyer / Billed To" p={buyer} />
        </View>

        <View style={S.divider} />

        {/* Items table */}
        <View style={S.tableHeader}>
          <Text style={{ ...S.cellDesc, ...S.cellHead }}>Description</Text>
          <Text style={{ ...S.cellNum, ...S.cellHead }}>Qty</Text>
          <Text style={{ ...S.cellNum, ...S.cellHead }}>Unit Price</Text>
          <Text style={{ ...S.cellNum, ...S.cellHead }}>Total</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={S.cellDesc}>{item.description}</Text>
            <Text style={S.cellNum}>{item.quantity}</Text>
            <Text style={S.cellNum}>{fmtCurrency(item.unitPrice)}</Text>
            <Text style={S.cellNum}>{fmtCurrency(item.total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsBox}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{fmtCurrency(subtotal)}</Text>
          </View>
          {isTax && gstAmount != null && gstRate != null && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>GST @ {gstRate}%</Text>
              <Text style={S.totalValue}>{fmtCurrency(gstAmount)}</Text>
            </View>
          )}
          <View style={{ ...S.totalRow, borderTopWidth: 1, borderTopColor: "#E5E7EB", borderTopStyle: "solid", marginTop: 4, paddingTop: 4 }}>
            <Text style={S.grandLabel}>Grand Total</Text>
            <Text style={S.grandValue}>{fmtCurrency(grandTotal)}</Text>
          </View>
        </View>

        {notes && (
          <>
            <View style={S.divider} />
            <Text style={S.label}>Notes</Text>
            <Text style={{ ...S.value, color: "#6B7280" }}>{notes}</Text>
          </>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Generated by Charaivati · {invoiceDate}</Text>
          <Text style={S.footerText}>{invoiceNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
