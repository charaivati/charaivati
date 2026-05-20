// scripts/seed-app-remaining.ts
// Seeds Tab records for app/app/layout, initiatives, and saved pages.
// Run with: npx tsx scripts/seed-app-remaining.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STRINGS = [
  // ─── Layout — bottom nav + header ────────────────────────────────────────
  { slug: "app-layout-tab-home",        title: "Home",              description: "Bottom nav tab label" },
  { slug: "app-layout-tab-initiatives", title: "Initiatives",       description: "Bottom nav tab label" },
  { slug: "app-layout-tab-explore",     title: "Explore",           description: "Bottom nav tab label" },
  { slug: "app-layout-tab-orders",      title: "Orders",            description: "Bottom nav tab label" },
  { slug: "app-layout-my-account",      title: "My Account",        description: "Profile menu link" },
  { slug: "app-layout-sign-out",        title: "Sign out",          description: "Profile menu button" },
  { slug: "app-layout-sign-in-up",      title: "Sign in / Sign up", description: "Guest profile menu link" },
  { slug: "app-layout-sign-in",         title: "Sign in",           description: "Unauthenticated header button" },

  // ─── Initiatives page — headings / empty states ───────────────────────────
  { slug: "app-initiatives-heading",      title: "Your Initiatives",                     description: "Initiatives page heading" },
  { slug: "app-initiatives-subtitle",     title: "Manage your initiatives and public pages", description: "Initiatives page subtitle" },
  { slug: "app-initiatives-empty",        title: "No initiatives yet.",                  description: "Empty state" },
  { slug: "app-initiatives-add-btn",      title: "+ Add Initiative",                     description: "Button to open create form" },
  { slug: "app-initiatives-open",         title: "Open →",                               description: "Button to open initiative hub" },

  // ─── Initiatives page — delete modal ──────────────────────────────────────
  { slug: "app-initiatives-delete",         title: "Delete",                                          description: "Delete button on initiative card" },
  { slug: "app-initiatives-deleting",       title: "Deleting",                                        description: "Loading state on delete button" },
  { slug: "app-initiatives-delete-title",   title: "Delete initiative?",                              description: "Delete confirmation modal title" },
  { slug: "app-initiatives-delete-warning", title: "All data will be lost forever. This cannot be undone.", description: "Delete modal warning" },
  { slug: "app-initiatives-cancel",         title: "Cancel",                                          description: "Cancel button" },
  { slug: "app-initiatives-confirm-delete", title: "Yes, delete",                                     description: "Confirm delete button" },

  // ─── Initiatives page — create form ──────────────────────────────────────
  { slug: "app-initiatives-form-title",      title: "Add an Initiative",           description: "Create form heading" },
  { slug: "app-initiatives-type-health",     title: "Health & Wellness",           description: "Initiative type option" },
  { slug: "app-initiatives-type-health-sub", title: "Coaching, nutrition, fitness",description: "Health type subtitle" },
  { slug: "app-initiatives-type-store",      title: "Store",                       description: "Initiative type option" },
  { slug: "app-initiatives-type-store-sub",  title: "Sell products",               description: "Store type subtitle" },
  { slug: "app-initiatives-type-learning",   title: "Learning",                    description: "Initiative type option" },
  { slug: "app-initiatives-type-learning-sub",title: "Teach a skill or subject",  description: "Learning type subtitle" },
  { slug: "app-initiatives-type-service",    title: "Service",                     description: "Initiative type option" },
  { slug: "app-initiatives-type-service-sub",title: "Consulting or sessions",      description: "Service type subtitle" },
  { slug: "app-initiatives-type-helping",    title: "Helping Initiative",          description: "Initiative type option" },
  { slug: "app-initiatives-type-helping-sub",title: "Community cause, volunteering","description": "Helping type subtitle" },
  { slug: "app-initiatives-course-type",     title: "Course Type",                 description: "Course type section label" },
  { slug: "app-initiatives-course-skill",    title: "Skill / Sport",               description: "Course type option" },
  { slug: "app-initiatives-course-academic", title: "Academic",                    description: "Course type option" },
  { slug: "app-initiatives-course-art",      title: "Art",                         description: "Course type option" },
  { slug: "app-initiatives-course-growth",   title: "Personal Growth",             description: "Course type option" },
  { slug: "app-initiatives-name-placeholder",title: "Initiative name",             description: "Input placeholder" },
  { slug: "app-initiatives-desc-placeholder",title: "Description (optional)",      description: "Textarea placeholder" },
  { slug: "app-initiatives-create-btn",      title: "Create Initiative",           description: "Create form submit button" },
  { slug: "app-initiatives-creating",        title: "Creating...",                 description: "Loading state on create button" },
  { slug: "app-initiatives-coming-soon",     title: "Coming soon",                 description: "Badge on locked consultation modes" },

  // ─── Initiatives page — sign-in prompt ───────────────────────────────────
  { slug: "app-initiatives-sign-in-title", title: "Sign in to create your initiative", description: "Prompt when unauthenticated" },
  { slug: "app-initiatives-sign-in-sub",   title: "It only takes a minute. Free forever.", description: "Sign-in prompt subtitle" },
  { slug: "app-initiatives-sign-in-btn",   title: "Sign In →",                           description: "Sign-in prompt button" },

  // ─── Initiatives page — kind labels on cards ─────────────────────────────
  { slug: "app-initiatives-kind-health",   title: "Health",   description: "Initiative kind badge" },
  { slug: "app-initiatives-kind-helping",  title: "Helping",  description: "Initiative kind badge" },
  { slug: "app-initiatives-kind-learning", title: "Learning", description: "Initiative kind badge" },
  { slug: "app-initiatives-kind-service",  title: "Service",  description: "Initiative kind badge" },
  { slug: "app-initiatives-kind-store",    title: "Store",    description: "Initiative kind badge" },

  // ─── Saved / Explore page ─────────────────────────────────────────────────
  { slug: "app-saved-heading",             title: "Explore",              description: "Saved/Explore page heading" },
  { slug: "app-saved-pinned-heading",      title: "Saved Stores",         description: "Pinned stores section heading" },
  { slug: "app-saved-pinned-empty",        title: "No saved stores yet.", description: "Pinned stores empty state" },
  { slug: "app-saved-unpin",               title: "Unpin",                description: "Button to unpin a saved store" },
  { slug: "app-saved-unpinning",           title: "Unpinning",            description: "Loading state for unpin" },
  { slug: "app-saved-wishlist-heading",    title: "Saved Products",       description: "Wishlist section heading" },
  { slug: "app-saved-wishlist-empty",      title: "No saved products yet.", description: "Wishlist empty state" },
  { slug: "app-saved-free",               title: "Free",                 description: "Price label when product is free" },
  { slug: "app-saved-buy-now",            title: "Buy Now",              description: "Buy Now button on wishlist product" },
  { slug: "app-saved-unsave",             title: "Unsave",               description: "Remove from wishlist button" },
  { slug: "app-saved-removing",           title: "Removing",             description: "Loading state for unsave" },
  { slug: "app-saved-browse-heading",     title: "Browse Stores",        description: "Browse all stores section heading" },
  { slug: "app-saved-search-placeholder", title: "Search stores...",     description: "Store search input placeholder" },
  { slug: "app-saved-no-stores",          title: "No stores yet.",       description: "Browse stores empty state" },
  { slug: "app-saved-pin",               title: "Pin",                  description: "Pin a store button" },
  { slug: "app-saved-pinned-label",      title: "Pinned",               description: "Label when store is already pinned" },
  { slug: "app-saved-pinning",           title: "Pinning",              description: "Loading state for pin" },
  { slug: "app-saved-visit",             title: "Visit →",              description: "Visit store link" },
];

async function main() {
  console.log(`Seeding ${STRINGS.length} Tab records...\n`);
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-app" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description ?? "", category: "ui-app", is_default: false, is_custom: false } });
      console.log(`  + ${s.slug}`);
      created++;
    }
  }
  console.log(`\nDone: ${created} created, ${updated} updated`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
