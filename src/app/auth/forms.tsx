"use client";

import { useActionState } from "react";
import type { FormState, Profile } from "@/lib/types";
import { logIn, signUp, updateProfile } from "./actions";

const initialState: FormState = {};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="form-error">{state.error}</p>;
  if (state.message) return <p role="status" className="form-message">{state.message}</p>;
  return null;
}

// Re-keying on the echoed values makes the uncontrolled inputs pick up the new
// defaults after React resets the form following an action.
function formKey(state: FormState) {
  return state.values ? JSON.stringify(state.values) : "initial";
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const v = state.values ?? {};

  return (
    <form action={action} key={formKey(state)} className="form">
      <Status state={state} />
      <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
      <Field label="Password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters." />
      <Field label="First name" name="first_name" autoComplete="given-name" defaultValue={v.first_name} />
      <Field label="Last name" name="last_name" autoComplete="family-name" defaultValue={v.last_name} />
      <Field label="Display name" name="display_name" defaultValue={v.display_name} />
      <Field label="Evil nickname" name="evil_nickname" defaultValue={v.evil_nickname} hint="What should the world fear you as?" />
      <Field label="Phone number" name="phone_number" type="tel" autoComplete="tel" defaultValue={v.phone_number} />
      <button type="submit" disabled={pending}>
        {pending ? "Joining..." : "Join The Garden"}
      </button>
    </form>
  );
}

export function LogInForm() {
  const [state, action, pending] = useActionState(logIn, initialState);

  return (
    <form action={action} key={formKey(state)} className="form">
      <Status state={state} />
      <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={state.values?.email} />
      <Field label="Password" name="password" type="password" required autoComplete="current-password" />
      <button type="submit" disabled={pending}>
        {pending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  const v = state.values ?? {};
  const value = (name: keyof typeof v & keyof Profile) =>
    v[name] ?? profile[name] ?? "";

  return (
    <form action={action} key={formKey(state)} className="form">
      <Status state={state} />
      <Field label="First name" name="first_name" autoComplete="given-name" defaultValue={value("first_name")} />
      <Field label="Last name" name="last_name" autoComplete="family-name" defaultValue={value("last_name")} />
      <Field label="Display name" name="display_name" defaultValue={value("display_name")} />
      <Field label="Evil nickname" name="evil_nickname" defaultValue={value("evil_nickname")} />
      <Field label="Phone number" name="phone_number" type="tel" autoComplete="tel" defaultValue={value("phone_number")} />
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
