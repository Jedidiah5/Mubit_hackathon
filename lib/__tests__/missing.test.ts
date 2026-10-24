import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { missingDetails, needsInfo } from "../missing";
import { followUpReply } from "../reply";

describe("missingDetails", () => {
  it("flags everything for a one-line vague enquiry", () => {
    assert.deepEqual(missingDetails("i want to host a hackathon"), [
      "guests",
      "date",
      "format",
    ]);
  });

  it("does not take a date, time, year or price for a head count", () => {
    const text =
      "Dinner on 14 June 2026 at 7pm, budget £5,000. Also June 21st works.";
    assert.deepEqual(missingDetails(text), ["guests"]);
  });

  it("accepts written-out counts", () => {
    assert.ok(!missingDetails("Drinks for about a hundred in March").includes("guests"));
    assert.ok(!missingDetails("Lunch for fifty next week").includes("guests"));
  });

  it('treats "may" as a month only with a day or "in May"', () => {
    assert.ok(missingDetails("Dinner for 40, we may want a DJ").includes("date"));
    assert.ok(!missingDetails("Dinner for 40 in May").includes("date"));
    assert.ok(!missingDetails("Dinner for 40 on 3 May").includes("date"));
  });

  it("reads a dash between numbers as a guest range, not a date", () => {
    assert.deepEqual(
      missingDetails("Meetup, usually 60-80 devs, two talks with slides"),
      ["date"],
    );
  });

  it("counts teams and knows quiz, supper, tea and mingling are formats", () => {
    assert.ok(!missingDetails("Quiz final, eight teams of five").includes("guests"));
    for (const text of [
      "Quiz night for 60",
      "Haggis supper for 100",
      "Afternoon tea for 30",
      "Launch for 200, music and mingling",
      "70 people, somewhere to gather and a bite to eat",
      "Prize-giving for 110",
    ]) {
      assert.ok(!missingDetails(text).includes("format"), text);
    }
  });

  it("finds nothing missing in a complete brief", () => {
    assert.deepEqual(
      missingDetails(
        "Wedding reception for around 120 guests on Saturday June 14. Sit-down dinner, then dancing.",
      ),
      [],
    );
  });

  it("only blocks on guests or format, not a missing date", () => {
    assert.equal(needsInfo(["date"]), false);
    assert.equal(needsInfo(["guests", "date"]), true);
    assert.equal(needsInfo(["format"]), true);
  });

  it("knows the seeded inbox emails all give a guest count and format", () => {
    const rows = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../data/inbox.json"), "utf8"),
    ) as { body: string }[];
    for (const row of rows) {
      const missing = missingDetails(row.body);
      assert.ok(!missing.includes("guests"), row.body);
      assert.ok(!missing.includes("format"), row.body);
    }
  });
});

describe("followUpReply", () => {
  it("asks one question per gap and greets a bare address politely", () => {
    const text = followUpReply(
      { from: "jedidiah@gmail.com", subject: "event query" },
      ["guests", "date"],
    );
    assert.match(text, /^Hi there,/);
    assert.match(text, /1\. Roughly how many people/);
    assert.match(text, /2\. Which date/);
    assert.doesNotMatch(text, /3\./);
  });
});
