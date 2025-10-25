// components/UserSearch.tsx
'use client'
import React, { useState } from 'react';

export default function UserSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  async function search(e?: any) {
    if (e) e.preventDefault();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      const json = await res.json().catch(()=>[]);
      setResults(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('search error', err);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function addFriend(targetId: string) {
    if (!confirm('Send a friend request to this user?')) return;
    try {
      setSending(s => ({ ...s, [targetId]: true }));
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId })
      });
      const j = await res.json().catch(()=>null);
      if (!res.ok) {
        alert('Failed to send request: ' + (j?.error || res.statusText));
        return;
      }
      alert('Friend request sent (if not already).');
    } catch (err) {
      console.error('addFriend error', err);
      alert('Failed to send request');
    } finally {
      setSending(s => ({ ...s, [targetId]: false }));
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search name or email"
          className="input flex-1"
        />
        <button className="btn" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      <div className="mt-3 space-y-2">
        {results.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-2 border rounded">
            <img src={u.avatarUrl ?? '/avatar-placeholder.png'} className="w-10 h-10 rounded-full" alt="avatar" />
            <div className="flex-1">
              <div className="font-medium">{u.name ?? u.profile?.displayName ?? 'No name'}</div>
              <div className="text-sm text-slate-500">
                {u.status === 'pending_delete' ? 'Scheduled for deletion' : u.status === 'deleted' ? 'Deleted' : ''}
              </div>
            </div>

            {u.status === 'deleted' ? (
              <div className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">Not available</div>
            ) : (
              <button
                onClick={() => addFriend(u.id)}
                className="btn"
                disabled={!!sending[u.id]}
              >
                {sending[u.id] ? 'Sending…' : 'Add'}
              </button>
            )}
          </div>
        ))}

        {results.length === 0 && !loading && (
          <div className="text-sm text-slate-400 mt-2">No results</div>
        )}
      </div>
    </div>
  )
}
    
