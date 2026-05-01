import { describe, expect, it } from "vitest";

import {
  mintInstanceId,
  recoverInstanceCounter,
  resetInstanceCounter,
} from "@/lib/engine/decks";

describe("instance id minting", () => {
  it("produces unique ids in sequence within a session", () => {
    resetInstanceCounter(0);
    expect(mintInstanceId("inv")).toBe("inv-0");
    expect(mintInstanceId("inv")).toBe("inv-1");
    expect(mintInstanceId("r")).toBe("r-2"); // counter is shared across prefixes
  });

  it("recoverInstanceCounter bumps the counter past the highest existing id", () => {
    // Simulate a state restored from localStorage that contains existing ids.
    // The counter is module-scoped, so a fresh reset would normally collide.
    resetInstanceCounter(0);
    const restoredState = {
      players: {
        p1: {
          investments: [
            { instanceId: "inv-95", cardId: "x" },
            { instanceId: "inv-7", cardId: "y" },
          ],
          resourceHand: [
            { instanceId: "r-104", resource: "corn", specialtyId: null },
          ],
        },
      },
      rickhouses: [
        {
          barrels: [
            {
              barrelId: "barrel-110",
              ownerId: "p1",
              mash: [
                { instanceId: "r-12", resource: "cask", specialtyId: null },
              ],
            },
          ],
        },
      ],
    };
    recoverInstanceCounter(restoredState);

    // The first new id must NOT collide with any existing id (max suffix was 110).
    expect(mintInstanceId("inv")).toBe("inv-111");
    expect(mintInstanceId("barrel")).toBe("barrel-112");
  });

  it("recoverInstanceCounter handles a state with no ids (fresh new game)", () => {
    resetInstanceCounter(50);
    recoverInstanceCounter({});
    // No ids found → max=-1, counter set to 0.
    expect(mintInstanceId("inv")).toBe("inv-0");
  });

  it("recoverInstanceCounter is robust to circular references", () => {
    resetInstanceCounter(0);
    type Node = { id: string; child?: Node };
    const a: Node = { id: "inv-3" };
    const b: Node = { id: "inv-9", child: a };
    a.child = b; // cycle
    expect(() => recoverInstanceCounter(a)).not.toThrow();
    expect(mintInstanceId("inv")).toBe("inv-10");
  });
});
