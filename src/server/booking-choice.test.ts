import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zonedTimeToUtc } from "../lib/clinic-time.ts";
import {
  bookingRefusal,
  expectedOpenStart,
  type OpenSlotChoice,
} from "./booking-choice.ts";

function at(day: number, minute: number) {
  return zonedTimeToUtc(2026, 10, day, minute);
}

function slot(
  day: number,
  minute: number,
  weekday: string,
  time: string,
): OpenSlotChoice {
  return { start: at(day, minute), weekday, time };
}

const usual = { weekday: "Wednesday", time: "8:30 AM" };
const wednesdayExact = slot(21, 8 * 60 + 30, "Wednesday", "8:30 AM");
const wednesdayLater = slot(21, 10 * 60, "Wednesday", "10:00 AM");
const wednesdayEarlier = slot(21, 8 * 60, "Wednesday", "8:00 AM");
const thursday = slot(22, 8 * 60, "Thursday", "8:00 AM");

describe("expectedOpenStart", () => {
  it("prefers the usual weekday and time when that start is open", () => {
    const chosen = expectedOpenStart({
      slots: [thursday, wednesdayLater, wednesdayExact],
      usual,
    });
    assert.equal(chosen?.getTime(), wednesdayExact.start.getTime());
  });

  it("picks the nearest open start on the usual weekday", () => {
    const chosen = expectedOpenStart({
      slots: [wednesdayEarlier, wednesdayLater, thursday],
      usual,
    });
    assert.equal(chosen?.getTime(), wednesdayEarlier.start.getTime());
  });

  it("picks the earliest opening when the usual weekday is closed", () => {
    const chosen = expectedOpenStart({
      slots: [thursday, slot(26, 9 * 60, "Monday", "9:00 AM")],
      usual,
    });
    assert.equal(chosen?.getTime(), thursday.start.getTime());
  });

  it("does not choose a start on a clinic day that already has a visit", () => {
    const chosen = expectedOpenStart({
      slots: [wednesdayExact, thursday],
      usual,
      otherScheduled: [{ scheduledAt: at(21, 15 * 60) }],
    });
    assert.equal(chosen?.getTime(), thursday.start.getTime());
  });

  it("skips the start being moved", () => {
    const chosen = expectedOpenStart({
      slots: [wednesdayExact, thursday],
      usual,
      excludeStart: wednesdayExact.start,
    });
    assert.equal(chosen?.getTime(), thursday.start.getTime());
  });
});

describe("bookingRefusal", () => {
  const now = at(17, 12 * 60);

  it("blocks a new booking when a future visit already exists", () => {
    assert.equal(
      bookingRefusal(
        [{ scheduledAt: at(28, 8 * 60 + 30) }],
        thursday.start,
        false,
        now,
      ),
      "upcoming",
    );
  });

  it("allows a move when the only future visit is the one being moved", () => {
    assert.equal(bookingRefusal([], thursday.start, true, now), null);
  });

  it("rejects a second visit on the same clinic day", () => {
    assert.equal(
      bookingRefusal(
        [{ scheduledAt: at(21, 15 * 60) }],
        wednesdayLater.start,
        true,
        now,
      ),
      "same-day",
    );
  });
});
