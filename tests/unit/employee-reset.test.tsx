// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmployeeDashboard from "@/app/employee/page";

const fetchMock = vi.fn();

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input: string) => {
    if (input === "/api/employee/claims") return Promise.resolve(ok({ claims: [] }));
    if (input === "/api/employee/reset") {
      return Promise.resolve(ok({ seededVisits: 2, deletedArtifacts: 3 }));
    }
    return Promise.reject(new Error(`Unexpected request: ${input}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EmployeeDashboard demo reset", () => {
  it("does not POST reset when the confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    render(<EmployeeDashboard />);
    await screen.findByText("No claims yet");
    fetchMock.mockClear();

    await user.click(screen.getByRole("button", { name: "Reset demo data" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the reset result and reloads the queue after confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();
    render(<EmployeeDashboard />);
    await screen.findByText("No claims yet");
    fetchMock.mockClear();

    await user.click(screen.getByRole("button", { name: "Reset demo data" }));

    await screen.findByText(
      "Demo reset: 2 visits restored and 3 ClaimLens artifacts removed.",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/employee/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/employee/claims", {
        cache: "no-store",
      }),
    );
  });
});
