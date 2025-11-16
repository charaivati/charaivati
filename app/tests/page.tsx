"use client"
import React, { useState } from 'react';
import { Download, Copy, CheckCircle, RefreshCw } from 'lucide-react';

export default function DriveImageViewer() {
  const [copied, setCopied] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(true);

  // Extract file IDs from Google Drive URLs
  const images = [
    {
      id: '1PwzIiesbN0ndPOcR0AFOGoxSRWNBQjr3',
      name: 'Image 1',
      url: 'https://drive.google.com/file/d/1PwzIiesbN0ndPOcR0AFOGoxSRWNBQjr3/view?usp=drive_link',
    },
    {
      id: '1TqsMnbkUnZ-TisKk8xDyA01RfwbvcH1A',
      name: 'Image 2',
      url: 'https://drive.google.com/file/d/1TqsMnbkUnZ-TisKk8xDyA01RfwbvcH1A/view?usp=drive_link',
    },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getProxyUrl = (fileId: string) => {
    if (token) {
      return `/api/social/proxy?id=${fileId}&type=image&token=${encodeURIComponent(token)}`;
    }
    return `/api/social/proxy?id=${fileId}&type=image`;
  };

  const getAuthApiUrl = (fileId: string) => {
    if (!token) return null;
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=YOUR_API_KEY`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Google Drive Image Viewer - Debug</h1>
          <p className="text-gray-400">Test direct URLs vs authenticated API</p>
        </div>

        {/* Token Input */}
        {showTokenInput && (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <h2 className="text-xl font-semibold text-yellow-200 mb-4">🔑 Step 1: Paste Your Access Token</h2>
            <p className="text-sm text-yellow-100/70 mb-4">
              Open your app's console → Network tab → look for Drive API requests → copy the Authorization header token (just the part after "Bearer ")
            </p>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your access token here (starts with 'ya29.')"
              className="w-full p-3 rounded-lg bg-black/50 border border-yellow-500/30 text-white text-sm font-mono min-h-[80px]"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowTokenInput(false)}
                className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm transition-colors"
              >
                {token ? 'Got it, Continue →' : 'Skip for now'}
              </button>
              {token && (
                <button
                  onClick={() => {
                    setToken('');
                    setShowTokenInput(true);
                  }}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                  Clear Token
                </button>
              )}
            </div>
          </div>
        )}

        {/* Direct Google Drive URLs */}
        <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">📄 File IDs</h2>
          <div className="space-y-3">
            {images.map((img) => (
              <div key={img.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{img.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{img.id}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Open
                  </a>
                  <button
                    onClick={() => copyToClipboard(img.id, img.id)}
                    className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition-colors"
                  >
                    {copied === img.id ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy ID
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API URLs */}
        <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">🔗 API Endpoints</h2>
          <div className="space-y-4">
            {images.map((img) => (
              <div key={`api-${img.id}`}>
                <p className="text-xs text-gray-400 mb-2">{img.name} - Authenticated API:</p>
                <code className="text-xs text-green-400 break-all block p-2 bg-black/50 rounded mb-2">
                  {token
                    ? `https://www.googleapis.com/drive/v3/files/${img.id}?alt=media`
                    : 'Paste token above to see endpoint'}
                </code>
                {token && (
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `https://www.googleapis.com/drive/v3/files/${img.id}?alt=media`,
                        `api-${img.id}`
                      )
                    }
                    className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition-colors"
                  >
                    {copied === `api-${img.id}` ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Endpoint
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Image Display Grid */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">🖼️ Image Display Test</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Direct Drive URLs */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/10 bg-black/40">
                <p className="text-sm font-medium text-white">1. Direct Drive URL</p>
                <p className="text-xs text-gray-500">
                  {token ? '✓ Works from browser' : '❌ Blocked by CORS from img tag'}
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {images.map((img) => (
                    <div key={`direct-${img.id}`}>
                      <p className="text-xs text-gray-400 mb-2">{img.name}</p>
                      <img
                        src={`https://drive.google.com/uc?id=${img.id}`}
                        alt={img.name}
                        className="w-full h-48 object-cover rounded-lg bg-black/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23333" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ECORS Blocked%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Proxy with Token */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/10 bg-black/40">
                <p className="text-sm font-medium text-white">2. Via Proxy + Token</p>
                <p className="text-xs text-gray-500">{token ? '✓ Should work' : '⚠️ Need token'}</p>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {images.map((img) => (
                    <div key={`proxy-${img.id}`}>
                      <p className="text-xs text-gray-400 mb-2">{img.name}</p>
                      <img
                        src={getProxyUrl(img.id)}
                        alt={img.name}
                        className="w-full h-48 object-cover rounded-lg bg-black/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23333" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EProxy Error%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Direct Authenticated API */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/10 bg-black/40">
                <p className="text-sm font-medium text-white">3. Direct Auth API</p>
                <p className="text-xs text-gray-500">{token ? '✓ No CORS' : '⚠️ Need token'}</p>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {images.map((img) => (
                    <div key={`authapi-${img.id}`}>
                      <p className="text-xs text-gray-400 mb-2">{img.name}</p>
                      {token ? (
                        <img
                          src={`https://www.googleapis.com/drive/v3/files/${img.id}?alt=media`}
                          alt={img.name}
                          className="w-full h-48 object-cover rounded-lg bg-black/50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23333" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EAuth Required%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-full h-48 rounded-lg bg-black/50 flex items-center justify-center">
                          <p className="text-xs text-gray-500">Paste token above</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Tips */}
        <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-200 mb-3">💡 How to Get Your Token</h3>
          <ol className="text-sm text-blue-100/70 space-y-2 list-decimal list-inside">
            <li>Open your app's browser DevTools (F12)</li>
            <li>Go to Network tab</li>
            <li>Post an image in Earning tab</li>
            <li>Look for requests to googleapis.com</li>
            <li>Click on one → Headers tab → find "Authorization: Bearer ya29..."</li>
            <li>Copy the part after "Bearer " (the long token)</li>
            <li>Paste it in the input above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}