# 0010 — The application holds no service-role key

**Decision.** Both the browser and server Supabase clients use the publishable
key. Anything that needs to act beyond the caller's own rights is a
`SECURITY DEFINER` database function that checks the caller's role itself:
`otp_rate_check`, `kyc_recommend`, `kyc_decide`, `assert_transition`.

**Why.** A service-role key in the web tier is a single credential that
bypasses every RLS policy we wrote; one server-side mistake and §15's whole
security model is decoration. Keeping it out means RLS is genuinely the
boundary rather than nominally so, and it removes the most valuable secret
from the deployment surface.

**Consequences.** Every privileged operation has to be expressible as a
database function with an explicit role check — which is the discipline we
wanted anyway. Signed URLs for KYC documents are minted on the reviewer's own
session, so storage RLS decides whether they are allowed at all. Migration
0007 revokes `EXECUTE` on everything that should not be reachable as RPC.
