// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, logOut } = vi.hoisted(() => ({ getSessionUser: vi.fn(), logOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("./auth/actions", () => ({ logOut }));

import { UserNav } from "./user-nav";

// UserNav is an async Server Component: await it, then render what it returns.
async function renderNav() {
  render(await UserNav());
}

beforeEach(() => {
  getSessionUser.mockReset();
  logOut.mockReset();
});

describe("UserNav when signed out", () => {
  beforeEach(() => getSessionUser.mockResolvedValue(null));

  it("offers Log in and Sign up links", async () => {
    await renderNav();

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });

  it("does not show account or log out controls", async () => {
    await renderNav();

    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });
});

describe("UserNav when signed in", () => {
  beforeEach(() => getSessionUser.mockResolvedValue({ id: "u1", email: "ada@garden.test" }));

  it("links to the account page and offers Log out", async () => {
    await renderNav();

    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });

  it("hides the Log in and Sign up links", async () => {
    await renderNav();

    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("calls the logOut server action when Log out is pressed", async () => {
    logOut.mockResolvedValue(undefined);
    await renderNav();

    await userEvent.setup().click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(logOut).toHaveBeenCalledTimes(1));
  });
});
