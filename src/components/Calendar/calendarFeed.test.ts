import { toFeedEvents } from "./calendarFeed";

// how the week grid builds them: dates in whatever week is showing
const block = (date: string, begin: string, end: string, extra: object = {}) => ({
  title: "COP3530",
  courseName: "Data Structures",
  location: "CSE E119",
  startDate: `${date}T${begin}`,
  endDate: `${date}T${end}`,
  firstDay: "08/20/2026",
  lastDay: "12/02/2026",
  ...extra,
});

describe("toFeedEvents", () => {
  it("folds a MWF class into one weekly event starting on the first real class day", () => {
    const events = toFeedEvents(
      [block("2026-11-02", "09:35", "10:25"), block("2026-11-04", "09:35", "10:25"), block("2026-11-06", "09:35", "10:25")],
      "26fall"
    );
    expect(events).toHaveLength(1);
    // Aug 20 2026 is a Thursday, so the first MWF meeting is Friday the 21st
    expect(events[0]).toMatchObject({
      title: "COP3530 Data Structures",
      start: "20260821T093500",
      end: "20260821T102500",
      until: "20261202",
      days: "MO,WE,FR",
    });
  });

  it("keeps different meeting times apart, like a lab on another day", () => {
    const events = toFeedEvents(
      [block("2026-11-03", "08:30", "09:20"), block("2026-11-05", "13:55", "16:55", { location: "CSE E211" })],
      "26fall"
    );
    expect(events.map((e) => e.days)).toEqual(["TU", "TH"]);
    expect(events[1].location).toBe("CSE E211");
  });

  it("gives the same id no matter which week the grid was showing", () => {
    const a = toFeedEvents([block("2026-11-02", "09:35", "10:25")], "26fall");
    const b = toFeedEvents([block("2027-02-08", "09:35", "10:25")], "26fall");
    expect(a[0].uid).toBe(b[0].uid);
  });

  it("uses a custom event's name as is and skips ones without dates", () => {
    const events = toFeedEvents(
      [
        block("2026-11-02", "17:00", "18:00", { title: "Work", courseName: undefined, location: " " }),
        block("2026-11-03", "17:00", "18:00", { firstDay: undefined }),
      ],
      "26fall"
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: "Work", location: "" });
  });
});
