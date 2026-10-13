// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ApplyForm + the REAL applyToJob / withdrawApplication server actions, with only
// the outside world faked: auth, cache revalidation, and a Postgres stand-in that
// mimics the rules in supabase/schema.sql (apply_to_job / withdraw_application).
// Keep it in step with that file: this fake is the only thing here that knows the
// SQL rules, and the SQL itself is not run by the test suite.
const db = vi.hoisted(() => {
  type Row = { id: string; job_id: string; status: string; referral_code: string | null };
  const state = {
    applications: [] as Row[],
    // public.employees ids: the only valid referral codes (sample rows from schema.sql).
    employees: new Set(["E-1001", "E-1002", "E-1003", "E-1042", "A".repeat(50)]),
    delayMs: 0,
    forceError: null as null | { code?: string; message: string },
  };

  const rpc = vi.fn(async (fn: string, args: Record<string, string | null>) => {
    if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs));
    if (state.forceError) return { error: state.forceError };

    if (fn === "apply_to_job") {
      const code = args.p_referral_code?.trim().slice(0, 50) || null;
      // Checked before anything is written, like the SQL function.
      if (code !== null && !state.employees.has(code)) {
        return {
          error: { code: "P0001", message: "That referral code doesn't match any employee. Check it and try again, or leave it blank." },
        };
      }
      const existing = state.applications.find((a) => a.job_id === args.p_job_id);
      if (existing && existing.status !== "withdrawn") {
        return { error: { code: "P0001", message: "You have already applied to this job." } };
      }
      if (existing) Object.assign(existing, { status: "submitted", referral_code: code });
      else state.applications.push({ id: `app-${state.applications.length + 1}`, job_id: String(args.p_job_id), status: "submitted", referral_code: code });
      return { error: null };
    }

    const app = state.applications.find((a) => a.id === args.p_application_id);
    if (!app || app.status === "withdrawn") {
      return { error: { code: "P0001", message: "Application not found, or it can no longer be withdrawn." } };
    }
    app.status = "withdrawn";
    return { error: null };
  });

  return { state, rpc, revalidatePath: vi.fn(), requireUser: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: db.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: db.requireUser }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient: async () => ({ rpc: db.rpc }) }));

import { ApplyForm, WithdrawButton } from "./forms";

const referralInput = () => screen.getByLabelText(/Referral code/);
const applyButton = () => screen.getByRole("button", { name: "Apply now" });

beforeEach(() => {
  db.state.applications = [];
  db.state.delayMs = 0;
  db.state.forceError = null;
  db.rpc.mockClear();
  db.revalidatePath.mockClear();
  db.requireUser.mockReset();
  db.requireUser.mockResolvedValue({ id: "u1", email: "ada@garden.test" });
});

describe("ApplyForm: the form itself", () => {
  it("shows an optional referral code field limited to 50 characters, and an Apply button", () => {
    render(<ApplyForm jobId="henchperson" />);

    expect(referralInput()).not.toBeRequired();
    expect(referralInput()).toHaveAttribute("maxlength", "50");
    expect(screen.getByText(/Optional/)).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("can't type more than 50 characters into the referral code", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "x".repeat(60));

    expect(referralInput()).toHaveValue("x".repeat(50));
  });
});

describe("ApplyForm: referral codes", () => {
  it("submits a referral code and confirms the application", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "E-1042");
    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted. Good luck, villain.");
    expect(db.rpc).toHaveBeenCalledWith("apply_to_job", { p_job_id: "henchperson", p_referral_code: "E-1042" });
    expect(db.state.applications).toEqual([
      { id: "app-1", job_id: "henchperson", status: "submitted", referral_code: "E-1042" },
    ]);
  });

  it("accepts an application with no referral code at all", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted");
    expect(db.rpc).toHaveBeenCalledWith("apply_to_job", { p_job_id: "henchperson", p_referral_code: null });
    expect(db.state.applications[0].referral_code).toBeNull();
  });

  it("treats a whitespace-only code as no code", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "     ");
    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    expect(db.rpc).toHaveBeenCalledWith("apply_to_job", { p_job_id: "henchperson", p_referral_code: null });
  });

  it("trims spaces around a code", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "  E-1001  ");
    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    expect(db.state.applications[0].referral_code).toBe("E-1001");
  });

  it("accepts a code of exactly 50 characters", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "A".repeat(50));
    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    expect(db.state.applications[0].referral_code).toBe("A".repeat(50));
  });

  it("clears the field after a successful submit", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "E-1042");
    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    await waitFor(() => expect(referralInput()).toHaveValue(""));
  });
});

describe("ApplyForm: submission outcomes", () => {
  it("refreshes the job page and the account page after a successful submit", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    expect(db.revalidatePath).toHaveBeenCalledWith("/jobs/henchperson");
    expect(db.revalidatePath).toHaveBeenCalledWith("/account");
  });

  it("explains that you already applied, and keeps the code you typed", async () => {
    db.state.applications = [{ id: "app-1", job_id: "henchperson", status: "submitted", referral_code: null }];
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "E-1042");
    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("You have already applied to this job.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(referralInput()).toHaveValue("E-1042");
    expect(db.revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a user who withdrew apply again", async () => {
    db.state.applications = [{ id: "app-1", job_id: "henchperson", status: "withdrawn", referral_code: "OLD" }];
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "E-1002");
    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted");
    expect(db.state.applications).toEqual([
      { id: "app-1", job_id: "henchperson", status: "submitted", referral_code: "E-1002" },
    ]);
  });

  it("says the job no longer exists if it was deleted", async () => {
    db.state.forceError = { code: "23503", message: "violates foreign key constraint" };
    render(<ApplyForm jobId="deleted-job" />);

    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("That job no longer exists.");
  });

  it("shows a generic message for unexpected database errors and never leaks details", async () => {
    db.state.forceError = { code: "42P01", message: 'relation "applications" does not exist' };
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().click(applyButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Please try again.");
    expect(alert.textContent).not.toMatch(/relation|applications/);
  });

  it("disables the button and shows 'Applying...' while the request is in flight", async () => {
    db.state.delayMs = 50;
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("button", { name: "Applying..." })).toBeDisabled();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();
  });

  // An expired session (requireUser redirecting to /login) is covered at the action
  // level in applications/actions.test.ts: Next handles the redirect, which a bare
  // React test render can't, so it would only surface here as an unhandled error.
  it("checks the session on every submit", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().click(applyButton());

    await screen.findByRole("status");
    expect(db.requireUser).toHaveBeenCalledTimes(1);
  });
});

describe("WithdrawButton", () => {
  it("withdraws the application", async () => {
    db.state.applications = [{ id: "app-1", job_id: "henchperson", status: "submitted", referral_code: null }];
    render(<WithdrawButton applicationId="app-1" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(db.state.applications[0].status).toBe("withdrawn"));
    expect(db.rpc).toHaveBeenCalledWith("withdraw_application", { p_application_id: "app-1" });
    expect(db.revalidatePath).toHaveBeenCalledWith("/account");
  });

  it("shows an error if the application can't be withdrawn", async () => {
    db.state.applications = [{ id: "app-1", job_id: "henchperson", status: "withdrawn", referral_code: null }];
    render(<WithdrawButton applicationId="app-1" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Withdraw" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Application not found, or it can no longer be withdrawn.");
  });

  it("shows 'Withdrawing...' and disables the button while in flight", async () => {
    db.state.applications = [{ id: "app-1", job_id: "henchperson", status: "submitted", referral_code: null }];
    db.state.delayMs = 50;
    render(<WithdrawButton applicationId="app-1" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Withdraw" }));

    expect(await screen.findByRole("button", { name: "Withdrawing..." })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Withdraw" })).toBeEnabled());
  });
});

// Referral codes are checked against public.employees by apply_to_job (see
// supabase/schema.sql). Any non-blank code that isn't an employee id is refused.
describe("referral codes must belong to a real employee", () => {
  it("rejects a referral code that doesn't match any employee", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "NOT-A-REAL-EMPLOYEE");
    await userEvent.setup().click(applyButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/referral code/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not create an application when the referral code is rejected", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "NOT-A-REAL-EMPLOYEE");
    await userEvent.setup().click(applyButton());

    await screen.findByRole("alert");
    expect(db.state.applications).toHaveLength(0);
  });

  it("keeps the rejected code in the field so it can be corrected", async () => {
    render(<ApplyForm jobId="henchperson" />);

    await userEvent.setup().type(referralInput(), "NOT-A-REAL-EMPLOYEE");
    await userEvent.setup().click(applyButton());

    await screen.findByRole("alert");
    expect(referralInput()).toHaveValue("NOT-A-REAL-EMPLOYEE");
  });
});
