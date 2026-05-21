// Retired — functionality moved to HealthInitiativePage Clients tab
// This route now redirects to /earn/initiative/[pageId] so existing bookmarks keep working.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function HealthDashboardRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const hb = await prisma.healthBusiness.findUnique({
    where: { id: businessId },
    select: { pageId: true },
  });

  redirect(hb ? `/earn/initiative/${hb.pageId}` : "/earn");
}
