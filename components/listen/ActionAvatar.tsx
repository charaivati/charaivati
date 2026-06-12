"use client";

// PRIV-ACT-1: small shared avatar bubble used by FriendSearchCards and
// ReminderCard so person cards look consistent.
export default function ActionAvatar({
  name,
  url,
  size = 9,
}: {
  name: string | null;
  url: string | null;
  size?: 7 | 9;
}) {
  const px = size === 9 ? "w-9 h-9" : "w-7 h-7";
  return (
    <span
      className={`${px} rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-xs text-gray-300 flex-shrink-0`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        (name ?? "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}
