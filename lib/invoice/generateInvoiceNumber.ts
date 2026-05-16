import { db } from "@/lib/db";

export async function generateInvoiceNumber(): Promise<string> {
  const count = await db.order.count({ where: { invoiceNumber: { not: null } } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(5, "0");
  return `INV-${year}-${seq}`;
}
