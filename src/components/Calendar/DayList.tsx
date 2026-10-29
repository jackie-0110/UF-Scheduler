import { useMemo, useState } from "react";
import { GridAppointment } from "./WeekGrid";
import InstructorRatings from "../CourseUI/InstructorRatings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const minutesOfDay = (iso: string) => {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
};

const formatTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};

const todayIndex = () => {
  const day = new Date().getDay();
  return day >= 1 && day <= 5 ? day - 1 : 0;
};

// One day at a time as a list, for screens too narrow for the week grid
const DayList: React.FC<{ appointments: GridAppointment[] }> = ({ appointments }) => {
  const [day, setDay] = useState(todayIndex);
  const [openId, setOpenId] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const days: GridAppointment[][] = DAYS.map(() => []);
    for (const appointment of appointments) {
      const index = new Date(appointment.startDate).getDay() - 1;
      if (index >= 0 && index < DAYS.length) days[index].push(appointment);
    }
    days.forEach((list) =>
      list.sort((a, b) => minutesOfDay(a.startDate) - minutesOfDay(b.startDate))
    );
    return days;
  }, [appointments]);

  const list = byDay[day];

  return (
    <div className="day-list">
      <div className="day-list-tabs" role="tablist">
        {DAYS.map((name, index) => (
          <button
            key={name}
            role="tab"
            aria-selected={index === day}
            className={index === day ? "active" : ""}
            onClick={() => setDay(index)}
          >
            {name}
            <span className="day-list-count">{byDay[index].length || ""}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="day-list-empty">No classes on {DAYS[day]}.</p>
      ) : (
        <ol>
          {list.map((appointment, index) => {
            const begin = minutesOfDay(appointment.startDate);
            const end = minutesOfDay(appointment.endDate);
            const prevEnd = index > 0 ? minutesOfDay(list[index - 1].endDate) : null;
            const open = openId === appointment.id;
            return (
              <li key={appointment.id}>
                {prevEnd !== null && begin - prevEnd > 0 && (
                  <span className="day-list-gap">{begin - prevEnd} min break</span>
                )}
                <button
                  type="button"
                  className="day-list-item"
                  style={{ borderLeftColor: appointment.color }}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : appointment.id)}
                >
                  <span className="day-list-time">
                    {formatTime(begin)}
                    <span>{formatTime(end)}</span>
                  </span>
                  <span className="day-list-main">
                    <strong>{appointment.title}</strong>
                    {appointment.courseName && <span>{appointment.courseName}</span>}
                    {appointment.location?.trim() && (
                      <span className="day-list-where">{appointment.location}</span>
                    )}
                  </span>
                </button>
                {open && (
                  <div className="day-list-detail">
                    {appointment.classNumber && /^\d+$/.test(appointment.classNumber) && (
                      <span>Class #{appointment.classNumber}</span>
                    )}
                    {appointment.finalExam && <span>Final: {appointment.finalExam}</span>}
                    <InstructorRatings instructors={appointment.instructors} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default DayList;
