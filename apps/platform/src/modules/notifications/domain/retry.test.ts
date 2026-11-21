import { describe, expect, test } from "vitest";
import { decideAfterFailure, MAX_ATTEMPTS } from "./retry";

const now = new Date("2026-11-22T10:00:00.000Z");
const minutesLater = (decision: ReturnType<typeof decideAfterFailure>) =>
  decision.status === "PENDING" ? (decision.nextAttemptAt.getTime() - now.getTime()) / 60_000 : null;

describe("PLT-08 · reintentos del outbox", () => {
  test("PLT-08: backoff de 1, 5, 15 y 60 minutos", () => {
    expect([1, 2, 3, 4].map((attempt) => minutesLater(decideAfterFailure(attempt, now)))).toEqual([1, 5, 15, 60]);
  });

  test("PLT-08: tras 5 fallos el evento queda FAILED", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(decideAfterFailure(5, now)).toEqual({ status: "FAILED" });
    expect(decideAfterFailure(6, now)).toEqual({ status: "FAILED" });
  });
});
