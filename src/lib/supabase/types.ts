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

export type OrderState =
  | "draft"
  | "submitted"
  | "matching"
  | "office_review"
  | "accepted"
  | "awaiting_irt_funding"
  | "irt_funded"
  | "foreign_leg_pending"
  | "foreign_leg_sent"
  | "recipient_confirmed"
  | "irt_released"
  | "completed"
  | "on_hold"
  | "info_needed"
  | "disputed"
  | "cancelled"
  | "refunded"
  | "expired"
  | "sla_breached";

/** The party a caller is, relative to one order. Null means "not a party". */
export type OrderActorRole = "customer" | "office" | "platform";

export type Order = {
  id: string;
  public_ref: string;
  customer_id: string;
  office_id: string | null;
  corridor: string;
  send_currency: string;
  send_amount_minor: number;
  receive_currency: string;
  receive_amount_minor: number;
  locked_rate: string;
  rate_locked_at: string;
  rate_expires_at: string;
  platform_fee_minor: number;
  office_fee_minor: number;
  spread_breakdown: Json;
  source_account_id: string | null;
  destination_account_id: string | null;
  state: OrderState;
  state_since: string;
  due_at: string | null;
  sla_target_at: string | null;
  version: number;
  purpose_of_transfer: string | null;
  notes: string | null;
  cancelled_reason: string | null;
  /** True when the order carries a P2P trade rather than a brokered transfer (§9). */
  is_p2p: boolean;
  p2p_trade_id: string | null;
  origin: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OrderEvent = {
  id: string;
  /** Insertion order. created_at is the transaction clock and repeats. */
  seq: number;
  order_id: string;
  from_state: OrderState | null;
  to_state: OrderState;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  attachment_path: string | null;
  meta: Json;
  created_at: string;
};

export type OrderDocumentKind = "irt_receipt" | "swift_mt103" | "foreign_receipt" | "invoice";

export type OrderDocument = {
  id: string;
  order_id: string;
  kind: OrderDocumentKind;
  storage_path: string;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExchangeOffice = {
  id: string;
  slug: string;
  legal_name_fa: string;
  legal_name_en: string;
  license_no: string;
  country: string;
  city: string | null;
  status: "draft" | "active" | "suspended" | "archived";
  branding: Json;
  contact: Json;
  working_hours: Json;
  corridors: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OfficeAccount = {
  id: string;
  office_id: string;
  currency: string;
  kind: "iban" | "card" | "swift" | "cash";
  details: Json;
  is_public: boolean;
  active: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OfficeRateConfig = {
  id: string;
  office_id: string;
  corridor: string;
  spread_bps: number;
  min_amount_minor: number | null;
  max_amount_minor: number | null;
  cutoff_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OfficeBalance = {
  id: string;
  office_id: string;
  currency: string;
  available_minor: number;
  reserved_minor: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** One live "acting as this office" session (§16.3). */
export type Impersonation = {
  id: string;
  actor_id: string;
  office_id: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  created_at: string;
};

export type FeatureFlag = {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rules: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LedgerEntry = {
  id: string;
  txn_id: string;
  ledger_account_id: string;
  direction: "debit" | "credit";
  amount_minor: number;
  currency: string;
  order_id: string | null;
  memo: string | null;
  created_at: string;
};

export type ConversationKind = "order" | "p2p" | "support";
export type SupportSegment = "customer" | "p2p" | "office";

export type Conversation = {
  id: string;
  kind: ConversationKind;
  subject_id: string | null;
  segment: SupportSegment | null;
  status: "open" | "pending" | "resolved" | "archived";
  assigned_to: string | null;
  last_message_at: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  last_read_at: string | null;
  muted: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  attachments: Json;
  is_internal_note: boolean;
  /** Soft compliance signals from `message_flags` — never a block (§10). */
  flags: Json;
  revision_of: string | null;
  created_at: string;
};

export type P2pOffer = {
  id: string;
  user_id: string;
  side: "have" | "want";
  have_currency: string;
  want_currency: string;
  amount_minor: number;
  min_slice_minor: number | null;
  max_slice_minor: number | null;
  rate_mode: "fixed" | "market_offset";
  rate_value: string;
  terms: string | null;
  expires_at: string | null;
  status: "open" | "paused" | "filled" | "cancelled" | "removed";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type P2pTrade = {
  id: string;
  offer_id: string;
  taker_id: string;
  maker_id: string;
  amount_minor: number;
  agreed_rate: string;
  escrow_office_id: string | null;
  state: string;
  order_id: string | null;
  dispute_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Reputation = {
  user_id: string;
  trades_completed: number;
  completion_rate: string;
  avg_release_seconds: number | null;
  rating_avg: string | null;
  badges: Json;
  created_at: string;
  updated_at: string;
};

export type Currency = { code: string; decimals: number; created_at: string };

export type Referral = {
  id: string;
  referrer_id: string;
  referee_id: string;
  code: string;
  /** Set when the referee's first order completes (§17.9), never on signup. */
  rewarded_at: string | null;
  created_at: string;
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
      kyc_documents: Table<
        KycDocument,
        "submission_id" | "kind" | "storage_path" | "mime" | "sha256"
      >;
      beneficiary_accounts: Table<
        BeneficiaryAccount,
        "user_id" | "nickname" | "currency" | "country" | "kind" | "holder_name"
      >;
      login_events: Table<LoginEvent, "user_id" | "kind">;
      audit_log: Table<AuditLogEntry, "action" | "entity_type">;
      legal_acceptances: Table<LegalAcceptance, "user_id" | "document" | "version">;
      orders: Table<
        Order,
        | "customer_id"
        | "corridor"
        | "send_currency"
        | "send_amount_minor"
        | "receive_currency"
        | "receive_amount_minor"
        | "locked_rate"
        | "rate_locked_at"
        | "rate_expires_at"
      >;
      order_events: Table<OrderEvent>;
      order_documents: Table<OrderDocument, "order_id" | "kind" | "storage_path">;
      exchange_offices: Table<ExchangeOffice>;
      office_accounts: Table<OfficeAccount, "office_id" | "currency" | "kind">;
      office_rate_config: Table<OfficeRateConfig, "office_id" | "corridor">;
      office_balances: Table<OfficeBalance, "office_id" | "currency">;
      impersonations: Table<Impersonation>;
      feature_flags: Table<FeatureFlag, "key">;
      ledger_entries: Table<LedgerEntry>;
      conversations: Table<Conversation, "kind">;
      conversation_participants: Table<ConversationParticipant, "conversation_id" | "user_id">;
      messages: Table<Message, "conversation_id">;
      p2p_offers: Table<P2pOffer>;
      p2p_trades: Table<P2pTrade>;
      reputation: Table<Reputation, "user_id">;
      currencies: Table<Currency, "code" | "decimals">;
      referrals: Table<Referral, "referrer_id" | "referee_id" | "code">;
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
      order_advance: {
        Args: { p_order: string; p_to: OrderState; p_reason?: string | null };
        Returns: OrderState;
      };
      order_claim: {
        Args: { p_order: string; p_office: string };
        Returns: OrderState;
      };
      order_actor_role: {
        Args: { p_order: string };
        Returns: OrderActorRole | null;
      };
      allowed_transitions: {
        Args: { s: OrderState };
        Returns: OrderState[];
      };
      admin_create_office: {
        Args: { p_office: Json };
        Returns: string;
      };
      admin_set_office_status: {
        Args: { p_office: string; p_status: string; p_reason?: string | null };
        Returns: string;
      };
      admin_set_office_member: {
        Args: { p_office: string; p_user: string; p_role: AppRole; p_grant?: boolean };
        Returns: undefined;
      };
      admin_create_order_on_behalf: {
        Args: { p_payload: Json };
        Returns: string;
      };
      order_force_transition: {
        Args: { p_order: string; p_to: OrderState; p_reason: string };
        Returns: OrderState;
      };
      impersonation_start: {
        Args: { p_office: string; p_reason: string; p_minutes?: number };
        Returns: Impersonation;
      };
      impersonation_end: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      active_impersonation: {
        Args: Record<string, never>;
        Returns: Impersonation | null;
      };
      office_defaults: {
        Args: Record<string, never>;
        Returns: Json;
      };
      conversation_for_order: {
        Args: { p_order: string };
        Returns: string;
      };
      conversation_for_support: {
        Args: Record<string, never>;
        Returns: string;
      };
      message_send: {
        Args: { p_conversation: string; p_body: string; p_internal?: boolean };
        Returns: string;
      };
      conversation_mark_read: {
        Args: { p_conversation: string };
        Returns: undefined;
      };
      support_set_state: {
        Args: { p_conversation: string; p_status?: string | null; p_assign?: boolean };
        Returns: undefined;
      };
      p2p_offer_publish: {
        Args: { p_payload: Json };
        Returns: string;
      };
      p2p_offer_close: {
        Args: { p_offer: string; p_reason?: string | null };
        Returns: undefined;
      };
      p2p_trade_take: {
        Args: { p_offer: string; p_amount_minor: number; p_agreed_rate: number };
        Returns: string;
      };
      p2p_trade_dispute: {
        Args: { p_trade: string; p_reason: string };
        Returns: undefined;
      };
      p2p_rate: {
        Args: { p_trade: string; p_score: number; p_comment?: string | null };
        Returns: undefined;
      };
      p2p_limits: {
        Args: Record<string, never>;
        Returns: Json;
      };
      conversation_for_trade: {
        Args: { p_trade: string };
        Returns: string;
      };
      order_public_status: {
        Args: { p_ref: string };
        Returns: Json;
      };
      customer_tier: {
        Args: { p_user?: string | null };
        Returns: Json;
      };
      customer_tiers: {
        Args: Record<string, never>;
        Returns: Json;
      };
      referral_claim: {
        Args: { p_code: string };
        Returns: boolean;
      };
    };
    Enums: { app_role: AppRole; kyc_status: KycStatus; order_state: OrderState };
    CompositeTypes: Record<string, never>;
  };
};
