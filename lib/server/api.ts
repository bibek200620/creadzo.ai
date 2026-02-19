import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function safeErrorMessage(error: unknown, fallback = "Request failed") {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  return fallback;
}

export function toIso(timestampMs: number | null | undefined): string | null {
  if (!timestampMs || Number.isNaN(timestampMs)) return null;
  return new Date(timestampMs).toISOString();
}

export function toTimestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Date.now();
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
