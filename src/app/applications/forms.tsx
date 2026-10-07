"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/types";
import { applyToJob, withdrawApplication } from "./actions";

const initialState: FormState = {};

export function ApplyForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(applyToJob, initialState);

  return (
    <form action={action} className="form">
      {state.error ? (
        <p role="alert" className="form-error">{state.error}</p>
      ) : null}
      {state.message ? (
        <p role="status" className="form-message">{state.message}</p>
      ) : null}
      <input type="hidden" name="job_id" value={jobId} />
      <label className="field">
        <span>Referral code</span>
        <input
          name="referral_code"
          maxLength={50}
          defaultValue={state.values?.referral_code}
          autoComplete="off"
        />
        <small>Optional. The employee ID of the person who referred you.</small>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Applying..." : "Apply now"}
      </button>
    </form>
  );
}

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(
    withdrawApplication,
    initialState,
  );

  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="application_id" value={applicationId} />
      <button type="submit" disabled={pending} className="link-button">
        {pending ? "Withdrawing..." : "Withdraw"}
      </button>
      {state.error ? (
        <span role="alert" className="form-error-inline">{state.error}</span>
      ) : null}
    </form>
  );
}
