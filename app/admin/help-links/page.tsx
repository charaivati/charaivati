import React, { useState, useEffect } from "react";
import { Trash2, Plus, Edit2, X } from "lucide-react";

type HelpLink = {
  id: string;
  pageSlug?: string | null;
  slugTags?: string[];
  country: string;
  title: string;
  url: string;
  notes?: string | null;
};

type Tab = {
  slug: string;
  title: string;
};

export default function AdminHelpLinksPage() {
  const [links, setLinks] = useState<HelpLink[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HelpLink | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    pageSlug: "",
    country: "All",
    title: "",
    url: "",
    notes: "",
    slugTags: [] as string[],
  });

  // Load links and tabs
  useEffect(() => {
    Promise.all([
      fetch("/api/help-links?pageSlug=").then((r) => r.json()),
      fetch("/api/tabs").then((r) => r.json()),
    ])
      .then(([linksRes, tabsRes]) => {
        setLinks(linksRes.data || []);
        setTabs(
          tabsRes.data?.map((t: any) => ({ slug: t.slug, title: t.title })) || []
        );
      })
      .finally(() => setLoading(false));
  }, []);

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
      } else {
        alert(data.error);
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
      } else {
        alert(data.error);
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
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete link");
    }
  };

  const resetForm = () => {
    setFormData({
      pageSlug: "",
      country: "All",
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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Help Links Admin</h1>
          <button
            onClick={() => {
              resetForm();
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Link
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">
              {editing ? "Edit Link" : "Create New Link"}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="text"
                  placeholder="URL"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Page Slug (optional)"
                  value={formData.pageSlug}
                  onChange={(e) =>
                    setFormData({ ...formData, pageSlug: e.target.value })
                  }
                  className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>

              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white resize-none"
                rows={3}
              />

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Tab Tags (select multiple):
                </label>
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.slug}
                      onClick={() => toggleTag(tab.slug)}
                      className={`px-3 py-1 rounded text-sm transition ${
                        formData.slugTags.includes(tab.slug)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {tab.slug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={editing ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Links List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline truncate"
                    >
                      {link.title}
                    </a>
                  </td>
                  <td className="px-4 py-3">{link.country}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {link.slugTags?.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(link)}
                      className="text-blue-400 hover:text-blue-300 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}