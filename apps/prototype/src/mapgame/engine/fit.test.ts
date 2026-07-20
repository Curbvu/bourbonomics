import { describe, expect, it } from "vitest";
import { fit } from "./fit";
import { age, bonded, premium, rye, singleBarrel, smallBatch, wheat } from "./tags";

describe("fit — brief §3 worked examples", () => {
  it("[RYE] vs [RYE] -> 1", () => {
    expect(fit([rye()], [rye()])).toBe(1);
  });

  it("[RYE,RYE] vs [RYE,RYE] -> 2 (depth pays on a doubled tile)", () => {
    expect(fit([rye(), rye()], [rye(), rye()])).toBe(2);
  });

  it("[RYE,RYE] vs [RYE] -> 1 (tile presents one slot)", () => {
    expect(fit([rye(), rye()], [rye()])).toBe(1);
  });

  it("[RYE] vs [RYE,RYE] -> 1 (bourbon supplies one)", () => {
    expect(fit([rye()], [rye(), rye()])).toBe(1);
  });
});

describe("fit — thresholds are meet-or-exceed", () => {
  it("AGE 20 satisfies AGE 8", () => {
    expect(fit([age(20)], [age(8)])).toBe(1);
  });

  it("AGE 20 does NOT satisfy AGE 23", () => {
    expect(fit([age(20)], [age(23)])).toBe(0);
  });

  it("AGE 8 satisfies AGE 8 (boundary meets)", () => {
    expect(fit([age(8)], [age(8)])).toBe(1);
  });

  it("BONDED matches independently of AGE", () => {
    expect(fit([bonded(), age(6)], [bonded(), age(4)])).toBe(2);
  });

  it("one high value cannot cover two separate demands", () => {
    // supply AGE 20 only; tile wants AGE 8 and AGE 12 -> one match
    expect(fit([age(20)], [age(8), age(12)])).toBe(1);
  });

  it("two supplies cover two demands, greedily optimal", () => {
    // supply AGE 12, AGE 20; demands AGE 8, AGE 20 -> both fill (12->8, 20->20)
    expect(fit([age(12), age(20)], [age(8), age(20)])).toBe(2);
  });
});

describe("fit — pure addition, no penalties", () => {
  it("sums across slot kinds", () => {
    expect(fit([rye(), bonded(), age(10)], [rye(), bonded(), age(8)])).toBe(3);
  });

  it("tags the tile does not present contribute 0, never negative", () => {
    expect(fit([wheat(), premium(), bonded()], [rye()])).toBe(0);
  });

  it("extra bourbon tags beyond the tile's demand are ignored", () => {
    expect(fit([rye(), smallBatch(), singleBarrel(), premium()], [rye()])).toBe(1);
  });

  it("empty tile demand -> 0", () => {
    expect(fit([rye(), bonded()], [])).toBe(0);
  });

  it("exact tags require value match, not just kind", () => {
    // both GRAIN, different value -> no match
    expect(fit([wheat()], [rye()])).toBe(0);
    // both BATCH, different value -> no match
    expect(fit([smallBatch()], [singleBarrel()])).toBe(0);
  });
});
