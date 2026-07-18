"use client";

import type { ApiResponse } from "@/lib/api/http";

async function unwrap<T>(res: Response): Promise<T> {
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // fall through to generic error
  }
  if (!res.ok || !body || !body.success) {
    throw new Error(body?.error ?? "Something went wrong. Please try again.");
  }
  return body.data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return unwrap<T>(res);
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return unwrap<T>(res);
}

export async function apiPostForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
  return unwrap<T>(res);
}
