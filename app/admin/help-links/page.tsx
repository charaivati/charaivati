// app/admin/help-links/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trash2, Plus, Edit2, X, Search } from "lucide-react";

type HelpLink = {
  id: string;
  pageSlug?: string | null;
  slugTags?: string[];
  country: string;
  title: string;
  url: string;
  notes?: string | null;
  createdAt?: string;
};

type TabItem = {
  id: string;
  slug: string;
  title: string;
  category?: string | null;
};

export default function AdminHelpLinksPage() {
  const [links, setLinks] = useState<HelpLink[]>([]);
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HelpLink | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  const [formData, setFormData] = useState({
    pageSlug: "",
    country: "India",
    title: "",
    url: "",
    notes: "",
    slugTags: [] as string[],
  });

  // Load links and tabs
  useEffect(() => {
    Promise.all([
      fetch("/api/help-links").then((r) => r.json()),
      fetch("/api/tabs").then((r) => r.json()),
    ])
      .then(([linksRes, tabsRes]) => {
        setLinks(linksRes.data || []);
        setTabs(tabsRes.tabs || []);
      })
      .catch((e) => console.error("Failed to load data", e))
      .finally(() => setLoading(false));
  }, []);

  // Filtered and grouped tabs for tag selector
  const filteredTabs = useMemo(() => {
    const q = tagFilter.toLowerCase();
    const filtered = tabs.filter(
      (t) =>
        t.slug.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );

    const grouped: Record<string, TabItem[]> = {};
    filtered.forEach((t) => {
      const cat = t.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
    return grouped;
  }, [tabs, tagFilter]);

  const handleCreate = async () => {
    if (!formData.title || !formData.url) {
      alert("Title and URL are required");
      return;
    }

    try {
      const res = await fetch("/api/help-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.ok) {
        setLinks([...links, data.data]);
        resetForm();
        setShowForm(false);
        alert("Link created successfully!");
      } else {
        alert(data.error || "Failed to create link");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to create link");
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!formData.title || !formData.url) {
      alert("Title and URL are required");
      return;
    }

    try {
      const res = await fetch(`/api/help-links/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.ok) {
        setLinks(links.map((l) => (l.id === editing.id ? data.data : l)));
        resetForm();
        setEditing(null);
        alert("Link updated successfully!");
      } else {
        alert(data.error || "Failed to update link");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update link");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this link?")) return;

    try {
      const res = await fetch(`/api/help-links/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setLinks(links.filter((l) => l.id !== id));
        alert("Link deleted successfully!");
      } else {
        alert(data.error || "Failed to delete link");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete link");
    }
  };

  const resetForm = () => {
    setFormData({
      pageSlug: "",
      country: "India",
      title: "",
      url: "",
      notes: "",
      slugTags: [],
    });
  };

  const startEdit = (link: HelpLink) => {
    setFormData({
      pageSlug: link.pageSlug || "",
      country: link.country,
      title: link.title,
      url: link.url,
      notes: link.notes || "",
      slugTags: link.slugTags || [],
    });
    setEditing(link);
    setShowForm(true);
  };

  const toggleTag = (slug: string) => {
    setFormData((prev) => ({
      ...prev,
      slugTags: prev.slugTags.includes(slug)
        ? prev.slugTags.filter((s) => s !== slug)
        : [...prev.slugTags, slug],
    }));
  };

  if (loading) return <div className="p-6 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Official Links Admin</h1>
          <button
            onClick={() => {
              resetForm();
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Add Link
          </button>
        </div>

        {showForm && (
          <div className="bg-white/5 rounded-lg p-6 mb-8 border border-white/10">
            <h2 className="text-xl font-semibold mb-4">{editing ? "Edit Link" : "Create New Link"}</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Link Title (e.g., EPFO Login Portal)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400"
                />
                <input
                  type="text"
                  placeholder="URL"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Country (e.g., India, All)"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400"
                />
                <input
                  type="text"
                  placeholder="Page Slug (optional)"
                  value={formData.pageSlug}
                  onChange={(e) => setFormData({ ...formData, pageSlug: e.target.value })}
                  className="px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400"
                />
              </div>

              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400 resize-none"
                rows={2}
              />

              {/* Tab Tag Selector */}
              <div>
                <label className="block text-sm font-semibold mb-3">
                  Assign to Tabs (like EPFO, IRCTC, etc.)
                </label>
                <button
                  type="button"
                  onClick={() => setShowTagSelector(!showTagSelector)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-left hover:bg-white/20 transition"
                >
                  {formData.slugTags.length === 0
                    ? "Click to select tabs..."
                    : `${formData.slugTags.length} tab(s) selected`}
                </button>

                {showTagSelector && (
                  <div className="mt-3 bg-white/5 rounded border border-white/10 p-4">
                    <input
                      type="text"
                      placeholder="Search tabs..."
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 rounded border border-white/20 text-white placeholder-gray-400 mb-3 text-sm"
                    />

                    <div className="max-h-64 overflow-y-auto space-y-3">
                      {Object.entries(filteredTabs).length === 0 ? (
                        <div className="text-gray-400 text-sm">No tabs found</div>
                      ) : (
                        Object.entries(filteredTabs).map(([category, items]) => (
                          <div key={category}>
                            <div className="text-xs font-semibold text-gray-300 mb-2">{category}</div>
                            <div className="space-y-2 ml-3">
                              {items.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleTag(t.slug)}
                                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                                    formData.slugTags.includes(t.slug)
                                      ? "bg-blue-600 text-white border border-blue-500"
                                      : "bg-white/10 text-gray-200 border border-white/20 hover:bg-white/20"
                                  }`}
                                >
                                  <div className="font-medium">{t.title}</div>
                                  <div className="text-xs opacity-75">{t.slug}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.slugTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.slugTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs flex items-center gap-2"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                    resetForm();
                    setShowTagSelector(false);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={editing ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Links Table */}
        <div className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/10 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Country</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tags</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-3">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline truncate block max-w-xs"
                      >
                        {link.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">{link.country}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {link.slugTags?.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(link)}
                          className="text-blue-400 hover:text-blue-300 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="text-red-400 hover:text-red-300 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {links.length === 0 && (
            <div className="p-6 text-center text-gray-400">No help links created yet</div>
          )}
        </div>
      </div>
    </div>
  );
}