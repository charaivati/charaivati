// components/UserSearch.tsx
'use client'
import React, { useState, useCallback } from 'react';

export default function UserSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search users and pages in parallel
      const [usersRes, pagesRes] = await Promise.all([
        fetch(`/api/users?q=${encodeURIComponent(query)}`),
        fetch(`/api/user/pages?q=${encodeURIComponent(query)}`),
      ]);

      const usersJson = await usersRes.json().catch(() => []);
      const pagesJson = await pagesRes.json().catch(() => ({ pages: [] }));

      const users = (Array.isArray(usersJson) ? usersJson : []).map((u: any) => ({
        ...u,
        type: 'user'
      }));

      const pages = ((pagesJson as any)?.pages || []).map((p: any) => ({
        ...p,
        type: 'page'
      }));

      setResults([...users, ...pages]);
    } catch (err) {
      console.error('search error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQ(value);
    search(value);
  };

  async function addFriend(targetId: string) {
    if (!confirm('Send a friend request to this user?')) return;
    try {
      setSending(s => ({ ...s, [targetId]: true }));
      const res = await fetch('/api/user/friends', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: targetId })
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        alert('Failed to send request: ' + (j?.error || res.statusText));
        return;
      }
      alert('Friend request sent!');
    } catch (err) {
      console.error('addFriend error', err);
      alert('Failed to send request');
    } finally {
      setSending(s => ({ ...s, [targetId]: false }));
    }
  }

  async function followPage(pageId: string) {
    try {
      setSending(s => ({ ...s, [pageId]: true }));
      const res = await fetch('/api/user/follows', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        alert('Failed to follow: ' + (j?.error || res.statusText));
        return;
      }
      alert('Following page!');
    } catch (err) {
      console.error('followPage error', err);
      alert('Failed to follow');
    } finally {
      setSending(s => ({ ...s, [pageId]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          value={q}
          onChange={handleSearch}
          placeholder="Search people or pages…"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map(item => (
          <div
            key={`${item.type}-${item.id}`}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <img
              src={item.avatarUrl ?? '/avatar-placeholder.png'}
              alt={item.name || item.title}
              className="w-10 h-10 rounded-full object-cover"
            />

            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {item.name || item.title || 'No name'}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {item.type === 'page' ? 'Page' : 'Person'}
              </div>
            </div>

            {item.status === 'deleted' ? (
              <div className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 whitespace-nowrap">
                Not available
              </div>
            ) : (
              <button
                onClick={() => item.type === 'user' ? addFriend(item.id) : followPage(item.id)}
                disabled={!!sending[item.id]}
                className="px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-medium transition whitespace-nowrap"
              >
                {sending[item.id] ? 'Sending…' : item.type === 'user' ? 'Add Friend' : 'Follow'}
              </button>
            )}
          </div>
        ))}

        {results.length === 0 && !loading && q && (
          <div className="text-sm text-gray-400 text-center py-4">No results found</div>
        )}

        {results.length === 0 && !loading && !q && (
          <div className="text-sm text-gray-400 text-center py-4">Start typing to search</div>
        )}
      </div>
    </div>
  );
}