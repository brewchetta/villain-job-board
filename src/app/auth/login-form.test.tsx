// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/types";

const logIn = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ logIn, signUp: vi.fn(), updateProfile: vi.fn() }));

import { LogInForm } from "./forms";

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

function submittedFormData(call = 0) {
  return logIn.mock.calls[call][1] as FormData;
}

beforeEach(() => {
  logIn.mockReset();
});

describe("LogInForm", () => {
  it("renders required email and password fields with the right autocomplete hints", () => {
    render(<LogInForm />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("valid credentials", () => {
    it("submits exactly the email and password that were typed", async () => {
      logIn.mockResolvedValue({}); // a real success redirects away, so no state comes back
      render(<LogInForm />);

      await fillAndSubmit("ada@garden.test", "correct horse battery");

      await waitFor(() => expect(logIn).toHaveBeenCalledTimes(1));
      const data = submittedFormData();
      expect(data.get("email")).toBe("ada@garden.test");
      expect(data.get("password")).toBe("correct horse battery");
    });

    it("shows no error after a successful submit", async () => {
      logIn.mockResolvedValue({});
      render(<LogInForm />);

      await fillAndSubmit("ada@garden.test", "correct horse battery");

      await waitFor(() => expect(logIn).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("invalid credentials", () => {
    const invalid: FormState = { error: "Invalid email or password.", values: { email: "ada@garden.test" } };

    it("shows the error as an alert", async () => {
      logIn.mockResolvedValue(invalid);
      render(<LogInForm />);

      await fillAndSubmit("ada@garden.test", "wrong password");

      expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    });

    it("keeps the email so it can be corrected, but clears the password", async () => {
      logIn.mockResolvedValue(invalid);
      render(<LogInForm />);

      await fillAndSubmit("ada@garden.test", "wrong password");

      await screen.findByRole("alert");
      expect(screen.getByLabelText("Email")).toHaveValue("ada@garden.test");
      expect(screen.getByLabelText("Password")).toHaveValue("");
    });

    it("lets the user try again and then succeed", async () => {
      logIn.mockResolvedValueOnce(invalid).mockResolvedValueOnce({});
      render(<LogInForm />);

      await fillAndSubmit("ada@garden.test", "wrong password");
      await screen.findByRole("alert");

      const user = userEvent.setup();
      await user.type(screen.getByLabelText("Password"), "right password");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() => expect(logIn).toHaveBeenCalledTimes(2));
      expect(submittedFormData(1).get("email")).toBe("ada@garden.test");
      expect(submittedFormData(1).get("password")).toBe("right password");
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });

    it("does not reveal whether the email or the password was the problem", async () => {
      logIn.mockResolvedValue(invalid);
      render(<LogInForm />);

      await fillAndSubmit("nobody@garden.test", "whatever123");

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).not.toMatch(/no account|not found|doesn't exist|wrong password|incorrect password/i);
    });
  });

  it("disables the button and says so while logging in", async () => {
    let finish!: (state: FormState) => void;
    logIn.mockReturnValue(new Promise<FormState>((resolve) => (finish = resolve)));
    render(<LogInForm />);

    await fillAndSubmit("ada@garden.test", "correct horse battery");

    const pending = await screen.findByRole("button", { name: "Logging in..." });
    expect(pending).toBeDisabled();

    finish({});
    expect(await screen.findByRole("button", { name: "Log in" })).toBeEnabled();
  });
});
