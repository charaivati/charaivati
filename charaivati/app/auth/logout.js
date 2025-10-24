// auth/logout.js
export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) { console.warn('logout request failed', e); }
  clearClientState();
  // redirect to login
  window.location.href = '/login';
}

export function clearClientState() {
  try {
    // Clear local storage and session storage
    localStorage.clear();
    sessionStorage.clear();
    // Clear IndexedDB (best-effort)
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => indexedDB.deleteDatabase(db.name));
      }).catch(()=>{/* some browsers may not support */});
    }
    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    }
    // Clear in-memory state: if using react-query / swr etc, reset caches:
    // queryClient.clear() or mutate/clear functions depending on lib
  } catch (e) {
    console.warn('error clearing client state', e);
  }
}
