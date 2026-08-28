import { describe, expect, it } from "vitest";
import { can, isPlatformStaff, officeScopes, type Seat } from "@/lib/auth/can";

const OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const seat = (role: Seat["role"], scope?: string): Seat =>
  scope
    ? { role, scope_type: "office", scope_id: scope }
    : { role, scope_type: "platform", scope_id: null };

describe("can()", () => {
  it("keeps impersonation with the superadmin alone (§5)", () => {
    // §5 hands impersonation to `platform_superadmin` by name, and §16.3 makes
    // it the one action that lets a person act as somebody else. A widened
    // grant here would be invisible until it had already happened.
    expect(can([seat("platform_superadmin")], "office.impersonate")).toBe(true);
    expect(can([seat("platform_admin")], "office.impersonate")).toBe(false);
    expect(can([seat("platform_compliance")], "office.impersonate")).toBe(false);
    expect(can([seat("office_owner", OFFICE_A)], "office.impersonate")).toBe(false);
  });

  it("keeps a support agent out of money and configuration", () => {
    const support = [seat("platform_support")];
    expect(can(support, "platform.oversee")).toBe(true);
    expect(can(support, "order.force")).toBe(false);
    expect(can(support, "platform.config")).toBe(false);
    expect(can(support, "office.provision")).toBe(false);
    expect(can(support, "kyc.review")).toBe(false);
  });

  it("keeps compliance out of rates and finance (§5)", () => {
    const compliance = [seat("platform_compliance")];
    expect(can(compliance, "kyc.review")).toBe(true);
    expect(can(compliance, "platform.audit")).toBe(true);
    expect(can(compliance, "office.rates")).toBe(false);
    expect(can(compliance, "office.finance")).toBe(false);
  });

  it("scopes an office seat to its own office", () => {
    const owner = [seat("office_owner", OFFICE_A)];
    expect(can(owner, "office.team", OFFICE_A)).toBe(true);
    expect(can(owner, "office.team", OFFICE_B)).toBe(false);
    // A platform seat satisfies an office capability from any scope.
    expect(can([seat("platform_admin")], "office.team", OFFICE_B)).toBe(true);
  });

  it("does not treat a customer or an office member as platform staff", () => {
    expect(isPlatformStaff([seat("customer")])).toBe(false);
    expect(isPlatformStaff([seat("office_owner", OFFICE_A)])).toBe(false);
    expect(isPlatformStaff([seat("platform_support")])).toBe(true);
  });

  it("lists each office once, however many seats are held there", () => {
    expect(
      officeScopes([
        seat("office_owner", OFFICE_A),
        seat("office_finance", OFFICE_A),
        seat("office_viewer", OFFICE_B),
      ]),
    ).toEqual([OFFICE_A, OFFICE_B]);
  });
});
