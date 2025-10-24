// pages/api/user/[userId]/tabs.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to merge defaults and overrides
async function getMergedTabs(userId: string, levelKey: string) {
  // 1) get levelId
  const level = await prisma.level.findUnique({ where: { key: levelKey } });
  if (!level) return { level: null, tabs: [] };

  // 2) load defaults for the level (is_default = true)
  const defaults = await prisma.tab.findMany({
    where: { levelId: level.id, is_default: true },
    orderBy: { title: "asc" }, // or defaultPosition if you add that field
  });

  // 3) load the user's overrides for that level
  const overrides = await prisma.userTab.findMany({
    where: { userId, levelId: level.id },
  });

  const overridesByTabId: Record<string, any> = {};
  const overridesBySlug: Record<string, any> = {};
  const userAdded: any[] = [];

  for (const o of overrides) {
    if (o.tabId) overridesByTabId[o.tabId] = o;
    if (o.defaultSlug) overridesBySlug[o.defaultSlug] = o;
    if (!o.tabId && !o.defaultSlug) {
      // unusual: a userTab with no reference; skip or push as custom
      userAdded.push(o);
    }
  }

  // 4) merge default list applying overrides
  const merged: any[] = defaults.map((d, index) => {
    const diffById = overridesByTabId[d.id];
    const diffBySlug = overridesBySlug[d.slug];
    const diff = diffById || diffBySlug;

    return {
      id: d.id,
      slug: d.slug,
      title: diff?.customTitle ?? d.title,
      description: d.description,
      metadata: diff?.customMetadata ?? d.metadata,
      levelId: d.levelId,
      isDefault: true,
      visible: diff?.visible ?? true,
      position: diff?.position ?? (index + 1),
      userTabId: diff?.id ?? null,
    };
  });

  // 5) append user-created tabs that reference a custom Tab record
  const customTabs = await prisma.customTab.findMany({
    where: { userId },
  });

  // find userTab rows that point to customTab via tabId
  for (const ut of overrides) {
    if (ut.tabId) {
      const maybeTab = await prisma.tab.findUnique({ where: { id: ut.tabId } });
      if (maybeTab && maybeTab.is_custom) {
        merged.push({
          id: maybeTab.id,
          slug: maybeTab.slug,
          title: ut.customTitle ?? maybeTab.title,
          description: ut.customMetadata ?? maybeTab.description,
          levelId: maybeTab.levelId,
          isDefault: false,
          visible: ut.visible,
          position: ut.position ?? 9999,
          userTabId: ut.id,
        });
      }
    }
  }

  // 6) sort by position, fallback to default order
  merged.sort((a, b) => (a.position ?? 999999) - (b.position ?? 999999));

  return { level, tabs: merged };
}

// Main handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  if (req.method === "GET") {
    const levelKey = (req.query.level as string) || "personal";
    const out = await getMergedTabs(userId, levelKey);
    return res.json(out);
  }

  // Create a new user override / userTab
  if (req.method === "POST") {
    const { tabId, defaultSlug, levelKey, position, visible, customTitle, customMetadata } = req.body;
    // resolve levelId
    const level = levelKey ? await prisma.level.findUnique({ where: { key: levelKey } }) : null;
    const levelId = level?.id ?? null;

    const created = await prisma.userTab.create({
      data: {
        userId,
        tabId: tabId ?? null,
        levelId,
        defaultSlug: defaultSlug ?? null,
        position,
        visible: visible ?? true,
        customTitle,
        customMetadata,
      },
    });
    return res.status(201).json(created);
  }

  // Update an override
  if (req.method === "PUT") {
    const { userTabId } = req.query as any;
    if (!userTabId) return res.status(400).json({ error: "Missing userTabId" });

    const { position, visible, customTitle, customMetadata } = req.body;
    const updated = await prisma.userTab.update({
      where: { id: userTabId },
      data: { position, visible, customTitle, customMetadata },
    });
    return res.json(updated);
  }

  // Delete override
  if (req.method === "DELETE") {
    const { userTabId } = req.query as any;
    if (!userTabId) return res.status(400).json({ error: "Missing userTabId" });

    await prisma.userTab.delete({ where: { id: userTabId } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
