// app/api/friends/utils.ts
export function canonicalPair(a: string, b: string) {
  return a < b
    ? { userAId: a, userBId: b }
    : { userAId: b, userBId: a };
}
