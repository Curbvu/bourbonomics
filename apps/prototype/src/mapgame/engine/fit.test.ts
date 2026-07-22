import { describe, expect, it } from "vitest";
import { fit } from "./fit";
import { age, anyBatch, anyGrain, bonded, premium, rye, singleBarrel, smallBatch, traditional, wheat } from "./tags";

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

describe("fit — tile wildcards ANYGRAIN / ANYBATCH (brief §3, the combat floor)", () => {
  it("ANYGRAIN is filled by any bourbon that has a grain", () => {
    expect(fit([rye()], [anyGrain()])).toBe(1);
    expect(fit([wheat()], [anyGrain()])).toBe(1);
    expect(fit([traditional()], [anyGrain()])).toBe(1);
  });

  it("ANYGRAIN scores 0 for a bourbon with no grain", () => {
    expect(fit([bonded(), age(10)], [anyGrain()])).toBe(0);
  });

  it("ANYBATCH is filled by any bourbon that has a batch, else 0", () => {
    expect(fit([singleBarrel()], [anyBatch()])).toBe(1);
    expect(fit([smallBatch()], [anyBatch()])).toBe(1);
    expect(fit([rye(), age(8)], [anyBatch()])).toBe(0);
  });

  it("a wildcard does not double-count a doubled grain (capped at the tile's one slot)", () => {
    expect(fit([rye(), rye()], [anyGrain()])).toBe(1);
  });

  it("wildcards stack additively with exact + threshold slots", () => {
    // tile: ANYGRAIN + ANYBATCH + AGE 4; bourbon: rye single-barrel age 8 -> 3
    expect(fit([rye(), singleBarrel(), age(8)], [anyGrain(), anyBatch(), age(4)])).toBe(3);
  });

  it("an ANYGRAIN tile is unlocked even by an off-grain bourbon (participation floor)", () => {
    // a wheat bourbon still contributes on a rye-flavoured wildcard demand
    expect(fit([wheat(), age(6)], [anyGrain(), age(4)])).toBe(2);
  });
});
