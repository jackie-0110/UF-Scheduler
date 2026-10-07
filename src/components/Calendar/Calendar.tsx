import { Course, Section } from "../CourseUI/CourseTypes";
import "./CalendarStyle.css";
import { useEffect, useState, useMemo, useRef } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { addDays, format, startOfWeek } from "date-fns";
import IntervalTree, { Interval } from "@flatten-js/interval-tree";
import CustomAppointmentForm from "./CustomAppointments/customAppointmentForm";
import WeekGrid from "./WeekGrid";

const today = new Date();
const isWeekend = today.getDay() === 6; // 6 is Saturday, 0 is Sunday

const getDayDate = (dayIndex: number) => {
  const start = isWeekend
    ? startOfWeek(addDays(new Date(), 7))
    : startOfWeek(new Date());
  const targetDate = addDays(start, dayIndex);
  return format(targetDate, "yyyy-MM-dd");
};

const dayMapping = new Map([
  ["M", getDayDate(1)],
  ["T", getDayDate(2)],
  ["W", getDayDate(3)],
  ["R", getDayDate(4)],
  ["F", getDayDate(5)],
]);

function areAppointmentsEqual(appointments1?: any[], appointments2?: any[]) {
  if (!appointments1 || !appointments2) return false;
  if (appointments1.length !== appointments2.length) return false;
  for (let i = 0; i < appointments1.length; i++) {
    if (JSON.stringify(appointments1[i]) !== JSON.stringify(appointments2[i])) {
      return false;
    }
  }
  return true;
}

const generateICSContent = (appointments: any[]) => {
  let icsContent =
    "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nPRODID:-//YourCompany//YourApp//EN\n";

  for (let appointment of appointments) {
    // Parse the firstDay and lastDay dates (MM/DD/YYYY format)
    const firstDayParts = appointment.firstDay?.split('/') || [];
    const lastDayParts = appointment.lastDay?.split('/') || [];
    
    // If we don't have valid first/last day data, skip this appointment
    if (firstDayParts.length !== 3 || lastDayParts.length !== 3) {
      continue;
    }
    
    // Create Date objects for first and last day
    // Note: month is 0-indexed in JavaScript Date
    const firstDay = new Date(
      parseInt(firstDayParts[2]), // year
      parseInt(firstDayParts[0]) - 1, // month (0-indexed)
      parseInt(firstDayParts[1]) // day
    );
    
    const lastDay = new Date(
      parseInt(lastDayParts[2]), // year
      parseInt(lastDayParts[0]) - 1, // month (0-indexed)
      parseInt(lastDayParts[1]) // day
    );
    
    // Get the day of week (0-6) from the startDate
    const dayOfWeek = new Date(appointment.startDate).getDay();
    
    // Find the first occurrence of this day of week on or after firstDay
    let eventStartDate = new Date(firstDay);
    while (eventStartDate.getDay() !== dayOfWeek) {
      eventStartDate.setDate(eventStartDate.getDate() + 1);
    }
    
    // Extract time parts from startDate and endDate
    const startTimePart = appointment.startDate.split('T')[1];
    const endTimePart = appointment.endDate.split('T')[1];
    
    // Format the last day for the UNTIL part of RRULE
    const untilDate = new Date(lastDay);
    // Format as YYYYMMDD
    const untilDateFormatted = untilDate.getFullYear().toString() +
      (untilDate.getMonth() + 1).toString().padStart(2, '0') +
      untilDate.getDate().toString().padStart(2, '0');
    
    // Format the event start and end dates with the correct times
    const eventStartFormatted = eventStartDate.getFullYear().toString() +
      (eventStartDate.getMonth() + 1).toString().padStart(2, '0') +
      eventStartDate.getDate().toString().padStart(2, '0') +
      'T' + startTimePart.replace(/[:-]/g, '');
    
    const eventEndFormatted = eventStartDate.getFullYear().toString() +
      (eventStartDate.getMonth() + 1).toString().padStart(2, '0') +
      eventStartDate.getDate().toString().padStart(2, '0') +
      'T' + endTimePart.replace(/[:-]/g, '');
    
    icsContent += "BEGIN:VEVENT\n";
    icsContent += `DTSTART:${eventStartFormatted}00\n`; // Append "00" for seconds
    icsContent += `DTEND:${eventEndFormatted}00\n`; // Append "00" for seconds
    icsContent += `RRULE:FREQ=WEEKLY;UNTIL=${untilDateFormatted}T235959Z\n`;
    icsContent += `UID:${appointment.id.replace(" ", "")}@ufscheduler.com\n`;
    icsContent += `SUMMARY:${appointment.title}\n`;
    icsContent += `LOCATION:${appointment.location}\n`;
    icsContent += "END:VEVENT\n";
  }

  icsContent += "END:VCALENDAR";
  return icsContent;
};

type ScheduleOption = { appointments: any[]; combination: Section[] };

type ScheduleFilters = {
  startAfter: number | null; // minutes from midnight
  endBy: number | null;
  maxGap: number | null; // minutes between back-to-back classes
  daysOff: string[];
};

const NO_FILTERS: ScheduleFilters = {
  startAfter: null,
  endBy: null,
  maxGap: null,
  daysOff: [],
};

const DAY_CODES = ["M", "T", "W", "R", "F"];
const BATCH_SIZE = 20;

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Filters describe classes, so recurring events the student added are ignored
const passesFilters = (combination: Section[], filters: ScheduleFilters) => {
  const byDay: { [day: string]: [number, number][] } = {};
  for (const section of combination) {
    if (!section.courseCode) continue;
    for (const meetTime of section.meetTimes) {
      const begin = timeToMinutes(meetTime.meetTimeBegin);
      const end = timeToMinutes(meetTime.meetTimeEnd);
      if (filters.startAfter !== null && begin < filters.startAfter) return false;
      if (filters.endBy !== null && end > filters.endBy) return false;
      for (const day of meetTime.meetDays) {
        if (filters.daysOff.includes(day)) return false;
        (byDay[day] = byDay[day] || []).push([begin, end]);
      }
    }
  }
  if (filters.maxGap !== null) {
    for (const meetings of Object.values(byDay)) {
      meetings.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < meetings.length; i++) {
        if (meetings[i][0] - meetings[i - 1][1] > filters.maxGap) return false;
      }
    }
  }
  return true;
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) ||
      element.isContentEditable)
  );
};

export type SelectedCalendarType = {
  appointments: any[];
  combination: Section[];
} | null;

interface CalendarProps {
  selectedCourses: Course[];
  customAppointments: any[];
  setCustomAppointments: React.Dispatch<React.SetStateAction<any[]>>;
  term: string;
  year: string;
}

const Calendar: React.FC<CalendarProps> = ({
  selectedCourses,
  customAppointments,
  setCustomAppointments,
  term,
  year,
}) => {
  const [currentCalendars, setCurrentCalendars] = useState<ScheduleOption[]>(
    []
  );
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [isAppointmentFormVisible, setIsAppointmentFormVisible] =
    useState(false);
  const [lastIndex, setLastIndex] = useState(0);
  const [sortValue, setSortValue] = useState("");
  const [isLoadingSort, setIsLoadingSort] = useState(false);
  const [filters, setFilters] = useState<ScheduleFilters>(NO_FILTERS);
  // Which schedule the pager is showing (index into `options` below)
  const [position, setPosition] = useState(0);
  const prevSelectedCoursesRef = useRef<Course[]>();
  const prevCustomAppointmentsRef = useRef<any[]>();

  const getCurrentWeekDayDate = (dayIndex: number) => {
    const today = new Date();
    const isSaturday = today.getDay() === 6;
    const start = startOfWeek(today, { weekStartsOn: 0 });
  
    // If it's Saturday, adjust the start to the next week
    const adjustedStart = isSaturday ? addDays(start, 7) : start;
    return addDays(adjustedStart, dayIndex);
  };
  
  const adjustAppointmentsToCurrentWeek = (appointments: any[]) => {
    return appointments.map((appointment) => {
      const dayOfWeek = new Date(appointment.startDate).getDay();
      const currentWeekDate = getCurrentWeekDayDate(dayOfWeek);
      const startTime = appointment.startDate.split("T")[1];
      const endTime = appointment.endDate.split("T")[1];
      
      const newStartDate = `${currentWeekDate.toISOString().split("T")[0]}T${startTime}`;
      const newEndDate = `${currentWeekDate.toISOString().split("T")[0]}T${endTime}`;
  
      return {
        ...appointment,
        startDate: newStartDate,
        endDate: newEndDate,
      };
    });
  };
  
  const [selectedCalendar, setSelectedCalendar] = useState<SelectedCalendarType>(() => {
    const storedValue = localStorage.getItem(`selectedCalendar_${term}_${year}`);
    if (storedValue) {
      try {
        const parsedValue: SelectedCalendarType = JSON.parse(storedValue);
        if (
          parsedValue &&
          Array.isArray(parsedValue.appointments) &&
          Array.isArray(parsedValue.combination)
        ) {
          const adjustedAppointments = adjustAppointmentsToCurrentWeek(parsedValue.appointments);
          return { appointments: adjustedAppointments, combination: parsedValue.combination };
        }
      } catch (error) {
        return null;
      }
    }
    return null;
  });
  


  const sortOptions = [
    { value: "earliestStart", label: "Earliest Start" },
    { value: "latestStart", label: "Latest Start" },
    { value: "earliestEnd", label: "Earliest End" },
    { value: "latestEnd", label: "Latest End" },
    { value: "mostCompact", label: "Most Compact" },
  ];

  useEffect(() => {
    if (selectedCalendar !== undefined) {
      localStorage.setItem(
        `selectedCalendar_${term}_${year}`,
        JSON.stringify(selectedCalendar)
      );
    }
  }, [selectedCalendar, term, year]);

  // Reset calendar when term changes
  useEffect(() => {
    // Load the selectedCalendar from localStorage for this term
    const storedCalendar = localStorage.getItem(`selectedCalendar_${term}_${year}`);
    if (storedCalendar) {
      try {
        const parsedCalendar: SelectedCalendarType = JSON.parse(storedCalendar);
        if (
          parsedCalendar &&
          Array.isArray(parsedCalendar.appointments) &&
          Array.isArray(parsedCalendar.combination)
        ) {
          const adjustedAppointments = adjustAppointmentsToCurrentWeek(parsedCalendar.appointments);
          setSelectedCalendar({ 
            appointments: adjustedAppointments, 
            combination: parsedCalendar.combination 
          });
        } else {
          setSelectedCalendar(null);
        }
      } catch (error) {
        setSelectedCalendar(null);
      }
    } else {
      setSelectedCalendar(null);
    }
  }, [term, year]);

  // Step 1: Identify selected sections
  const getAllSelectedSections = () => {
    return selectedCourses.map((course) => {
      const selectedSection = course.sections.find(
        (section) => section.selected === true
      );
      if (selectedSection) {
        selectedSection.courseName = course.name;
        selectedSection.courseCode = course.code;
        return [selectedSection];
      } else {
        course.sections.forEach((section) => {
          section.courseName = course.name;
          section.courseCode = course.code;
        });

        let allowedNoMeetTimeSection = true;

        return course.sections.filter((section) => {
          if (section.meetTimes && section.meetTimes.length > 0) {
            return true;
          } else if (allowedNoMeetTimeSection) {
            allowedNoMeetTimeSection = false;
            return true;
          }
          return false;
        });
      }
    });
  };

  // Step 2: Generate all possible combinations
  const generateAllCombinations = (arrays: Section[][]) => {
    arrays = [...arrays, ...customAppointments.map((item) => [item])];
    return arrays.reduce<Section[][]>(
      (acc, curr) =>
        acc.flatMap((c: Section[]) =>
          curr.map((n: Section) => ([] as Section[]).concat(c, [n]))
        ),
      [[]]
    );
  };

  const allSelectedSections = useMemo(
    () => getAllSelectedSections(),
    [selectedCourses]
  );

  const [allCombinations, setAllCombinations] = useState<Section[][]>(() =>
    generateAllCombinations(allSelectedSections)
  );

  useEffect(() => {
    const newCombinations = generateAllCombinations(allSelectedSections);
    setAllCombinations(newCombinations);
  }, [allSelectedSections, customAppointments]);

  // Step 3: Create calendars
  const createCalendars = (startIndex: number, numRequested: number) => {
    let generatedCalendars: ScheduleOption[] = [];
    let index = startIndex;

    while (
      generatedCalendars.length < numRequested &&
      index < allCombinations.length
    ) {
      const combination = allCombinations[index];
      index++;
      if (!passesFilters(combination, filters)) continue;

      let appointments = [];
      let isValidCombination = true;
      const intervalTree = new IntervalTree();

      combinationLoop: for (let section of combination) {
        const title = section.courseCode
          ? `${section.courseCode}`
          : `${section.courseName}`;
        const { color, meetTimes } = section;

        for (let {
          meetDays,
          meetTimeBegin,
          meetTimeEnd,
          meetBuilding,
          meetRoom,
        } of meetTimes) {
          for (let day of meetDays) {
            const date = dayMapping.get(day);
            const startDate = `${date}T${meetTimeBegin}`;
            const endDate = `${date}T${meetTimeEnd}`;
            const id = `${section.courseName}-${startDate}-${date}`;
            const classNumber =
              section.classNumber !== ""
                ? `${section.classNumber}`
                : `${section.courseName}-${section.color}`;

            // Creating an interval using the Interval class
            const interval = new Interval(
              new Date(startDate).valueOf(),
              new Date(endDate).valueOf()
            );

            // Checking for overlapping appointments using the interval tree
            if (intervalTree.search(interval).length > 0) {
              isValidCombination = false;
              break combinationLoop;
            }

            // Adding the current appointment to the interval tree
            intervalTree.insert(interval);
            appointments.push({
              startDate,
              endDate,
              id,
              classNumber,
              title,
              color,
              finalExam: section.finalExam,
              location: `${meetBuilding} ${meetRoom}`,
              firstDay: section.startDate,
              lastDay: section.endDate,
            });
          }
        }
      }
      if (isValidCombination) {
        generatedCalendars.push({ appointments, combination });
      }
    }
    return { calendars: generatedCalendars, nextIndex: index };
  };

  // Rebuild the option list whenever the courses, sort order or filters change
  useEffect(() => {
    const { calendars, nextIndex } = createCalendars(0, BATCH_SIZE);
    setCurrentCalendars(calendars);
    setLastIndex(nextIndex);
    setHasMoreItems(nextIndex < allCombinations.length);
    setPosition(0);
  }, [allCombinations, filters]);

  const loadMoreCalendars = () => {
    const { calendars, nextIndex } = createCalendars(lastIndex, BATCH_SIZE);
    setCurrentCalendars((prev) => [...prev, ...calendars]);
    setLastIndex(nextIndex);
    setHasMoreItems(nextIndex < allCombinations.length);
  };

  // Step 4: The pager's list — the pinned schedule first, then every other option
  const otherOptions = selectedCalendar
    ? currentCalendars.filter(
        (calendar) =>
          !areAppointmentsEqual(
            selectedCalendar.appointments,
            calendar.appointments
          )
      )
    : currentCalendars;
  const options: (ScheduleOption & { pinned?: boolean })[] = selectedCalendar
    ? [{ ...selectedCalendar, pinned: true }, ...otherOptions]
    : otherOptions;
  const current = options[Math.min(position, options.length - 1)];
  const currentPosition = Math.max(0, Math.min(position, options.length - 1));

  const goTo = (next: number) =>
    setPosition(Math.max(0, Math.min(next, options.length - 1)));

  // Keep a few options loaded ahead of the pager
  useEffect(() => {
    if (hasMoreItems && currentPosition >= options.length - 3) {
      loadMoreCalendars();
    }
  }, [currentPosition, options.length, hasMoreItems]);

  // Left / right arrow keys page through the options
  const pagerRef = useRef({ currentPosition, count: options.length });
  pagerRef.current = { currentPosition, count: options.length };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      const { currentPosition, count } = pagerRef.current;
      const next = currentPosition + (event.key === "ArrowRight" ? 1 : -1);
      if (next < 0 || next >= count) return;
      event.preventDefault();
      setPosition(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const downloadICS = (appointments: any[]) => {
    const blob = new Blob([generateICSContent(appointments)], {
      type: "text/calendar",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getOnlineMessage = (combination: Section[]) => {
    const onlineSectionNames = combination
      .filter((section) => !section.meetTimes || section.meetTimes.length === 0)
      .map((section) => section.courseName);
    if (onlineSectionNames.length > 1) {
      return `${onlineSectionNames
        .slice(0, -1)
        .join(", ")} and ${onlineSectionNames.slice(-1)} are online`;
    }
    return onlineSectionNames.length === 1
      ? `${onlineSectionNames[0]} is online`
      : "";
  };

  const getTimes = (combination: any, key: string) => {
    const times = [];
    for (let section of combination) {
      for (let time of section.meetTimes) {
        times.push(timeToMinutes(time[key]));
      }
    }
    return times;
  };

  const getEarliestAndLatestTimes = (combination: any) => {
    const startTimes = getTimes(combination, "meetTimeBegin");
    const endTimes = getTimes(combination, "meetTimeEnd");
    return [Math.min(...startTimes), Math.max(...endTimes)];
  };

  const sortCombinations = (selectedOption: any) => {
    return [...allCombinations].sort((a, b) => {
      if (selectedOption.value === "mostCompact") {
        const [aStart, aEnd] = getEarliestAndLatestTimes(a);
        const [bStart, bEnd] = getEarliestAndLatestTimes(b);
        return aEnd - aStart - (bEnd - bStart);
      } else {
        const aTimes = getTimes(a, selectedOption.key);
        const bTimes = getTimes(b, selectedOption.key);
        const aValue = selectedOption.operation(...aTimes);
        const bValue = selectedOption.operation(...bTimes);
        return selectedOption.direction * (aValue - bValue);
      }
    });
  };

  const handleSortChange = (value: string) => {
    setSortValue(value);
    if (!value) return;
    setIsLoadingSort(true); // Set loading state to true at the start

    setTimeout(() => {
      const sortOptions: any = {
        earliestStart: {
          key: "meetTimeBegin",
          operation: Math.min,
          direction: 1,
        },
        latestStart: {
          key: "meetTimeBegin",
          operation: Math.min,
          direction: -1,
        },
        earliestEnd: { key: "meetTimeEnd", operation: Math.max, direction: 1 },
        latestEnd: { key: "meetTimeEnd", operation: Math.max, direction: -1 },
      };

      setAllCombinations(
        sortCombinations({ ...sortOptions[value], value })
      );
      setIsLoadingSort(false); // Set loading state to false at the end
    }, 0);
  };

  useEffect(() => {
    // A new course list starts from the default order again
    if (
      JSON.stringify(prevSelectedCoursesRef.current) !==
        JSON.stringify(selectedCourses) ||
      JSON.stringify(prevCustomAppointmentsRef.current) !==
        JSON.stringify(customAppointments)
    ) {
      setSortValue("");
    }
    prevSelectedCoursesRef.current = selectedCourses;
    prevCustomAppointmentsRef.current = customAppointments;
  }, [selectedCourses, customAppointments]);

  const filtersActive =
    filters.startAfter !== null ||
    filters.endBy !== null ||
    filters.maxGap !== null ||
    filters.daysOff.length > 0;
  const hasCourses = selectedCourses.length > 0 || customAppointments.length > 0;
  const hourOptions = (hours: number[]) =>
    hours.map((hour) => (
      <option key={hour} value={hour * 60}>
        {hour % 12 === 0 ? 12 : hour % 12} {hour >= 12 ? "PM" : "AM"}
      </option>
    ));
  const numberOrNull = (value: string) => (value === "" ? null : Number(value));

  const optionNumber = current
    ? currentPosition - (selectedCalendar ? 1 : 0) + 1
    : 0;
  const optionTotal = `${otherOptions.length}${hasMoreItems ? "+" : ""}`;
  const onlineMessage = current ? getOnlineMessage(current.combination) : "";

  return (
    <div className="calendar-container-2">
      {isLoadingSort && <div className="spinner"></div>}
      <div className="calendar-display">
        {isAppointmentFormVisible && (
          <CustomAppointmentForm
            customAppointments={customAppointments}
            setCustomAppointments={setCustomAppointments}
            setIsAppointmentFormVisible={setIsAppointmentFormVisible}
            term={term}
            year={year}
            style={{
              transform: "translateX(-50%)",
              position: "fixed",
              top: "50%",
              left: "50%",
              width: "auto",
              height: "auto",
              zIndex: 999,
              marginLeft: "0%", // Adjust to center horizontally
              marginTop: "-15%", // Adjust to center vertically
            }}
          ></CustomAppointmentForm>
        )}
        <div className="schedule-toolbar">
          <label className="schedule-filter">
            Start after
            <select
              value={filters.startAfter ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, startAfter: numberOrNull(e.target.value) })
              }
            >
              <option value="">Any</option>
              {hourOptions([8, 9, 10, 11, 12, 13])}
            </select>
          </label>
          <label className="schedule-filter">
            End by
            <select
              value={filters.endBy ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, endBy: numberOrNull(e.target.value) })
              }
            >
              <option value="">Any</option>
              {hourOptions([13, 14, 15, 16, 17, 18])}
            </select>
          </label>
          <label className="schedule-filter">
            Max gap
            <select
              value={filters.maxGap ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, maxGap: numberOrNull(e.target.value) })
              }
            >
              <option value="">Any</option>
              <option value={60}>1 hr</option>
              <option value={120}>2 hr</option>
              <option value={180}>3 hr</option>
            </select>
          </label>
          <div className="schedule-filter" role="group" aria-label="Days off">
            Days off
            {DAY_CODES.map((day) => {
              const isOff = filters.daysOff.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`day-toggle${isOff ? " on" : ""}`}
                  aria-pressed={isOff}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      daysOff: isOff
                        ? filters.daysOff.filter((d) => d !== day)
                        : [...filters.daysOff, day],
                    })
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
          {filtersActive && (
            <button
              type="button"
              className="schedule-card-link"
              onClick={() => setFilters(NO_FILTERS)}
            >
              Clear filters
            </button>
          )}
          <div className="schedule-toolbar-end">
            <label className="schedule-filter">
              Sort
              <select
                value={sortValue}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="">Default</option>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="schedule-add-event"
              onClick={() => setIsAppointmentFormVisible((prev) => !prev)}
            >
              Add event
            </button>
          </div>
        </div>

        <div
          className={`header-and-calendar${
            current?.pinned ? " selected-schedule" : ""
          }`}
        >
          <div className="schedule-card-header">
            {current ? (
              <div className="schedule-pager">
                <button
                  type="button"
                  aria-label="Previous schedule"
                  title="Previous (←)"
                  disabled={currentPosition === 0}
                  onClick={() => goTo(currentPosition - 1)}
                >
                  <IoChevronBack size={16} />
                </button>
                <span className="schedule-card-title" aria-live="polite">
                  {current.pinned
                    ? "Your schedule"
                    : `Option ${optionNumber} of ${optionTotal}`}
                </span>
                <button
                  type="button"
                  aria-label="Next schedule"
                  title="Next (→)"
                  disabled={currentPosition >= options.length - 1}
                  onClick={() => goTo(currentPosition + 1)}
                >
                  <IoChevronForward size={16} />
                </button>
              </div>
            ) : (
              <span className="schedule-card-title">Your week</span>
            )}
            {onlineMessage && (
              <span className="online-section-message">{onlineMessage}</span>
            )}
            {current && current.appointments.length > 0 && (
              <div className="schedule-card-actions">
                <button
                  className="schedule-card-link"
                  onClick={() => downloadICS(current.appointments)}
                >
                  Download ICS
                </button>
                <button
                  className={`schedule-card-select${
                    current.pinned ? " selected" : ""
                  }`}
                  onClick={() => {
                    if (current.pinned) {
                      setSelectedCalendar(null);
                    } else {
                      setSelectedCalendar({
                        appointments: current.appointments,
                        combination: current.combination,
                      });
                    }
                    setPosition(0);
                  }}
                >
                  {current.pinned ? "Deselect" : "Select"}
                </button>
              </div>
            )}
          </div>
          {!current && hasCourses ? (
            <div className="schedule-empty">
              <strong>No schedule fits.</strong>
              {filtersActive ? (
                <>
                  <span>Your filters rule out every combination of sections.</span>
                  <button
                    type="button"
                    className="schedule-card-select"
                    onClick={() => setFilters(NO_FILTERS)}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <span>
                  These courses have no combination of sections without a time
                  conflict.
                </span>
              )}
            </div>
          ) : (
            <WeekGrid appointments={current ? current.appointments : []} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
