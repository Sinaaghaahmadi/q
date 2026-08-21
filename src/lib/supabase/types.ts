/**
 * Hand-maintained schema types for the tables and functions the app actually
 * touches. Regenerate the full set with `supabase gen types typescript` once
 * the CLI is in CI; until then this stays deliberately small and honest about
 * Phase-2 surface area, while still typing every call site.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type KycStatus = "unverified" | "pending" | "approved" | "rejected" | "more_info_needed";

export type AppRole =
  | "customer"
  | "office_viewer"
  | "office_operator"
  | "office_finance"
  | "office_owner"
  | "platform_support"
  | "platform_compliance"
  | "platform_admin"
  | "platform_superadmin";

export type Profile = {
  id: string;
  full_name_fa: string | null;
  full_name_latin: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  email: string | null;
  locale: string;
  theme: string;
  national_code: string | null;
  dob: string | null;
  nationality: string | null;
  address: Json | null;
  kyc_status: KycStatus;
  risk_tier: number;
  referral_code: string | null;
  frozen_at: string | null;
  frozen_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Membership = {
  id: string;
  user_id: string;
  role: AppRole;
  scope_type: "platform" | "office";
  scope_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type KycSubmission = {
  id: string;
  user_id: string;
  status: KycStatus;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  second_approver: string | null;
  recommended_by: string | null;
  recommended_at: string | null;
  recommendation: KycStatus | null;
  reason: string | null;
  data: Json;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type KycDocumentKind = "passport" | "national_id" | "selfie" | "proof_of_address";

export type KycDocument = {
  id: string;
  submission_id: string;
  kind: KycDocumentKind;
  storage_path: string;
  mime: string;
  sha256: string;
  ocr: Json | null;
  expires_at: string | null;
  created_at: string;
};

export type AccountKind = "sheba" | "card" | "iban" | "swift" | "cash_pickup";

export type BeneficiaryAccount = {
  id: string;
  user_id: string;
  nickname: string;
  currency: string;
  country: string;
  kind: AccountKind;
  details: Record<string, string>;
  holder_name: string;
  is_third_party: boolean;
  verification_state: "unverified" | "pending" | "verified" | "rejected";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LoginEvent = {
  id: string;
  user_id: string;
  kind: "sign_in" | "sign_out" | "revoked";
  ip: string | null;
  user_agent: string | null;
  device_label: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  reason: string | null;
  ip: string | null;
  created_at: string;
};

export type LegalAcceptance = {
  id: string;
  user_id: string;
  document: string;
  version: string;
  accepted_at: string;
  ip: string | null;
};

/** Row + the Insert/Update shapes PostgREST accepts for it. */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * Declared as a type alias, not an interface: supabase-js checks the schema
 * against `Record<string, GenericTable>`, and only anonymous object types get
 * the implicit index signature that check needs — an interface silently
 * degrades every query result to `never`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      memberships: Table<Membership>;
      kyc_submissions: Table<KycSubmission, "user_id">;
      kyc_documents: Table<KycDocument, "submission_id" | "kind" | "storage_path" | "mime" | "sha256">;
      beneficiary_accounts: Table<
        BeneficiaryAccount,
        "user_id" | "nickname" | "currency" | "country" | "kind" | "holder_name"
      >;
      login_events: Table<LoginEvent, "user_id" | "kind">;
      audit_log: Table<AuditLogEntry, "action" | "entity_type">;
      legal_acceptances: Table<LegalAcceptance, "user_id" | "document" | "version">;
    };
    Views: Record<string, never>;
    Functions: {
      otp_rate_check: {
        Args: { p_phone: string; p_ip?: string | null };
        Returns: Json;
      };
      kyc_recommend: {
        Args: { p_submission: string; p_recommendation: KycStatus; p_reason?: string | null };
        Returns: undefined;
      };
      kyc_decide: {
        Args: { p_submission: string; p_decision: KycStatus; p_reason?: string | null };
        Returns: undefined;
      };
    };
    Enums: { app_role: AppRole; kyc_status: KycStatus };
    CompositeTypes: Record<string, never>;
  };
};
