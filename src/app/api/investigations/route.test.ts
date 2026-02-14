import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock, persistEventMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  persistEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/events/log", () => ({
  persistEvent: persistEventMock,
}));

import { POST } from "./route";

describe("POST /api/investigations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates investigation and emits initial events", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        investigation: {
          create: vi.fn().mockResolvedValue({
            id: "inv_1",
            requirement: "Need PG near Koramangala under 15k",
          }),
        },
        contact: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: "contact_1" })
            .mockResolvedValueOnce({ id: "contact_2" }),
        },
        call: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              id: "call_1",
              investigationId: "inv_1",
              status: "QUEUED",
              score: null,
              failureReason: null,
              updatedAt: now,
              contact: {
                name: "Asha Homes",
                phone: "+919900001111",
                language: "ENGLISH",
              },
            })
            .mockResolvedValueOnce({
              id: "call_2",
              investigationId: "inv_1",
              status: "QUEUED",
              score: null,
              failureReason: null,
              updatedAt: now,
              contact: {
                name: "City Stay",
                phone: "+919900002222",
                language: "HINDI",
              },
            }),
        },
      };

      return callback(tx);
    });

    const response = await POST(
      new Request("http://localhost/api/investigations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requirement: "Need PG near Koramangala under 15k",
          contacts: [
            {
              name: "Asha Homes",
              phone: "+919900001111",
              language: "english",
            },
            {
              name: "City Stay",
              phone: "+919900002222",
              language: "hindi",
            },
          ],
        }),
      }),
    );

    const payload = (await response.json()) as { investigationId: string };
    expect(response.status).toBe(201);
    expect(payload.investigationId).toBe("inv_1");
    expect(persistEventMock).toHaveBeenCalledTimes(3);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/investigations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requirement: "",
          contacts: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
