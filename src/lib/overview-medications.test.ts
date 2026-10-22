import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { overviewMedications } from "./overview-medications.ts";

const onChart = ["Escitalopram", "escitalopram"];

describe("overviewMedications", () => {
  it("allows a formulary name that is on the chart", () => {
    const result = overviewMedications(
      "Continues escitalopram each morning.",
      onChart,
    );
    assert.deepEqual(result.unmatched, []);
    assert.equal(
      result.spans.some(
        (span) => span.text === "escitalopram" && span.unmatched,
      ),
      false,
    );
  });

  it("flags a formulary name that is not on the chart", () => {
    const result = overviewMedications(
      "Start sertraline and continue escitalopram.",
      onChart,
    );
    assert.deepEqual(result.unmatched, ["Sertraline"]);
    const marked = result.spans.find((span) => span.unmatched);
    assert.equal(marked?.text, "sertraline");
  });

  it("matches the longer formulary name", () => {
    const result = overviewMedications("Consider Bupropion XL.", []);
    assert.deepEqual(result.unmatched, ["Bupropion XL"]);
    assert.equal(
      result.spans.some((span) => span.text.toLowerCase() === "bupropion"),
      false,
    );
  });

  it("does not match a name glued inside another word", () => {
    const result = overviewMedications(
      "propranololisnot a medication line.",
      [],
    );
    assert.deepEqual(result.unmatched, []);
  });

  it("leaves an unknown token unmarked", () => {
    const result = overviewMedications(
      "Add Poisonol, 99 mg to the list.",
      onChart,
    );
    assert.deepEqual(result.unmatched, []);
    assert.equal(
      result.spans.some((span) => span.unmatched),
      false,
    );
  });
});
