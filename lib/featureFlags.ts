export async function getFeatureFlagValue() {
  return true;
}

export async function upsertFeatureFlag() {
  throw new Error("feature flags are no longer used");
}
