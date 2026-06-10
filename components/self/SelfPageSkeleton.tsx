// components/self/SelfPageSkeleton.tsx
// Shared by app/(with-nav)/self/loading.tsx (route-level) and the page's
// Suspense fallback so both loading states look identical.
export default function SelfPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-4 pt-3">
      <div className="h-7 w-44 rounded-lg bg-white/10" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="h-4 w-2/5 rounded bg-white/10" />
        <div className="h-3 w-3/5 rounded bg-white/5" />
        <div className="h-32 rounded-xl bg-white/5" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex-none" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
