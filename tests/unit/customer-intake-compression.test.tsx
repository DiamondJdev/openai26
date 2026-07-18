// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerClaimPage from "@/app/c/[token]/page";
import { compressCustomerImage } from "@/lib/client/image-compression";

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "customer-token" }),
}));

vi.mock("@/lib/client/image-compression", () => ({
  ImageCompressionError: class ImageCompressionError extends Error {},
  compressCustomerImage: vi.fn(),
}));

const fetchMock = vi.fn();
const compressMock = vi.mocked(compressCustomerImage);
let submittedForm: FormData | null = null;

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  submittedForm = null;
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
  fetchMock.mockImplementation((input: string, init?: RequestInit) => {
    if (input === "/api/customer/claim") {
      return Promise.resolve(ok({ view: { state: "intake" } }));
    }
    if (input === "/api/customer/claim/intake") {
      submittedForm = init?.body as FormData;
      return Promise.resolve(ok({ view: { state: "under_review" } }));
    }
    return Promise.reject(new Error(`Unexpected request: ${input}`));
  });
  compressMock.mockImplementation(async (original) =>
    new File([`compressed:${original.name}`], `compressed-${original.name}.jpg`, {
      type: "image/jpeg",
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("customer intake photo submission", () => {
  it("replaces every original camera file with its compressed JPEG", async () => {
    const user = userEvent.setup();
    render(<CustomerClaimPage />);
    await screen.findByText("Tell us about your claim");

    await user.type(screen.getByLabelText("Full name"), "Jordan Doe");
    await user.type(screen.getByLabelText("Email"), "jordan@example.com");
    await user.type(screen.getByLabelText("Phone"), "555-123-4567");
    await user.click(screen.getByRole("checkbox"));

    for (const kind of ["plate", "odometer", "insurance"]) {
      const original = new File([`original:${kind}`], `${kind}.png`, {
        type: "image/png",
      });
      const input = document.getElementById(kind) as HTMLInputElement;
      await user.upload(input, original);
    }

    await waitFor(() => expect(compressMock).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "Submit claim" }));

    await waitFor(() => expect(submittedForm).not.toBeNull());
    for (const kind of ["plate", "odometer", "insurance"]) {
      const value = submittedForm?.get(kind);
      expect(value).toBeInstanceOf(File);
      expect((value as File).name).toBe(`compressed-${kind}.png.jpg`);
      expect((value as File).type).toBe("image/jpeg");
    }
  });
});
