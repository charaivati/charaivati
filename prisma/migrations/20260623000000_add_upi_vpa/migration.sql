-- REQBCAST-1b: UPI VPA payment-handle field on Store and Profile.
-- DISPLAY/HANDOFF ONLY — platform never validates, collects, or escrows.
-- Shape-validated (name@bank) at input, never resolution-checked.

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "upiVpa" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "upiVpa" TEXT;
