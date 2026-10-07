export type Job = {
  id: string;
  title: string;
  summary: string;
  pay: string;
  benefits: string[];
  qualifications: string[];
  location: string;
  disclaimers: string[];
};

export type Profile = {
  id: string;
  role: "candidate" | "admin";
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  resume_id: string | null;
  phone_number: string | null;
  evil_nickname: string | null;
};

// Shared result shape for auth/profile form server actions.
export type FormState = {
  error?: string;
  message?: string;
  // Echoed back so the form can repopulate after a failed submit (never the password).
  values?: Record<string, string>;
};

export type ApplicationStatus =
  | "submitted"
  | "reviewing"
  | "interviewing"
  | "offered"
  | "rejected"
  | "withdrawn";

export type Application = {
  id: string;
  job_id: string;
  job_title: string;
  status: ApplicationStatus;
  referral_code: string | null;
  created_at: string;
};
