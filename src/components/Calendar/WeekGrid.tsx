import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";

export type GridAppointment = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  classNumber?: string;
  location?: string;
  finalExam?: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOUR_HEIGHT = 48; // px per hour
// The grid always covers a full class day and scrolls; earlier or later
// meetings extend it.
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const SCROLL_TO_HOUR = 8; // where an empty grid opens

const minutesOfDay = (iso: string) => {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
};

const formatTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};

const formatHour = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? "PM" : "AM"}`;

// Black or white text, whichever reads better on the course color
const contrastText = (hex: string) => {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#000000" : "#ffffff";
};

const WeekGrid: React.FC<{ appointments: GridAppointment[] }> = ({
  appointments,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const close = (event: MouseEvent) => {
      if (!gridRef.current?.contains(event.target as Node)) setOpenId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openId]);

  const events = appointments.map((appointment) => ({
    ...appointment,
    day: new Date(appointment.startDate).getDay() - 1, // Mon = 0
    start: minutesOfDay(appointment.startDate),
    end: minutesOfDay(appointment.endDate),
  }));

  const startHour = events.length
    ? Math.min(DEFAULT_START_HOUR, ...events.map((e) => Math.floor(e.start / 60)))
    : DEFAULT_START_HOUR;
  const endHour = events.length
    ? Math.max(DEFAULT_END_HOUR, ...events.map((e) => Math.ceil(e.end / 60)))
    : DEFAULT_END_HOUR;
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );
  const toPx = (minutes: number) =>
    ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  // Open the grid at the first class of the week instead of at 7 AM
  const firstStart = events.length
    ? Math.min(...events.map((e) => e.start))
    : SCROLL_TO_HOUR * 60;
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, toPx(firstStart) - 16);
    }
  }, [firstStart, startHour]);

  return (
    <div className="week-grid" ref={gridRef}>
      <div className="week-grid-scroll" ref={scrollRef} tabIndex={0}>
      <div className="week-grid-head">
        <div />
        {DAYS.map((day) => (
          <div key={day} className="week-grid-dayname">
            {day}
          </div>
        ))}
      </div>
      <div
        className="week-grid-body"
        style={{ height: hours.length * HOUR_HEIGHT }}
      >
        <div className="week-grid-times">
          {hours.map((hour) => (
            <span key={hour} style={{ top: toPx(hour * 60) }}>
              {formatHour(hour)}
            </span>
          ))}
        </div>
        {DAYS.map((day, dayIndex) => (
          <div
            key={day}
            className="week-grid-day"
            style={{ backgroundSize: `100% ${HOUR_HEIGHT}px` }}
          >
            {events
              .filter((event) => event.day === dayIndex)
              .map((event) => {
                const isOpen = openId === event.id;
                const isShort = event.end - event.start < 60;
                const hasClassNumber = /^\d+$/.test(event.classNumber ?? "");
                const location = event.location?.trim();
                return (
                  <div key={event.id}>
                    <button
                      type="button"
                      className={`week-grid-event${isShort ? " short" : ""}`}
                      style={{
                        top: toPx(event.start),
                        height: toPx(event.end) - toPx(event.start),
                        backgroundColor: event.color,
                        color: contrastText(event.color),
                      }}
                      onClick={() => setOpenId(isOpen ? null : event.id)}
                      aria-expanded={isOpen}
                    >
                      <strong>{event.title}</strong>
                      <span>
                        {formatTime(event.start)} – {formatTime(event.end)}
                      </span>
                      {location && <span>{location}</span>}
                    </button>
                    {isOpen && (
                      <div
                        className={`week-grid-popover${
                          dayIndex >= 3 ? " left" : ""
                        }`}
                        style={{ top: toPx(event.start) }}
                        role="dialog"
                        aria-label={`${event.title} details`}
                      >
                        <button
                          type="button"
                          className="week-grid-popover-close"
                          onClick={() => setOpenId(null)}
                          aria-label="Close"
                        >
                          <IoClose size={16} />
                        </button>
                        <div className="week-grid-popover-title">
                          <i style={{ backgroundColor: event.color }} />
                          {event.title}
                        </div>
                        <dl>
                          <dt>Time</dt>
                          <dd>
                            {DAYS[dayIndex]} {formatTime(event.start)} –{" "}
                            {formatTime(event.end)}
                          </dd>
                          {hasClassNumber && (
                            <>
                              <dt>Class #</dt>
                              <dd>{event.classNumber}</dd>
                            </>
                          )}
                          {location && (
                            <>
                              <dt>Location</dt>
                              <dd>{location}</dd>
                            </>
                          )}
                          {event.finalExam && (
                            <>
                              <dt>Final</dt>
                              <dd>{event.finalExam}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

export default WeekGrid;
