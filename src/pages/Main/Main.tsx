import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import CoursesHandler from "../../components/CoursesHandler/CoursesHandler";
import "./MainStyles.css";
import { Course } from "../../components/CourseUI/CourseTypes";
import Calendar from "../../components/Calendar/Calendar";
import Header from "../../components/Header/Header";
import { AiOutlineMessage, AiOutlineCalendar } from "react-icons/ai";
import { IoClose, IoSearch } from "react-icons/io5";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import Footer from "../../components/Footer/Footer";
import MapBox from "../../components/MapBox/Map";
import Chat from "../../components/Chat/LiveChat";
import AIChat from "../../components/Chat/AIChat";
import ModelPlan from "../../components/ModelPlan/ModelPlan";
import Graph from "../../components/Cytoscape/Graph";
import { ChangeEvent } from "react";
import { useAIActionStore } from "../../store/aiActionStore";
import { API_URLS, BACKEND_URLS } from "../../config/api";

const Main = () => {
  const [selectedMajor, setSelectedMajor] = useState<string | null>(() => {
    const storedSelectedMajor = localStorage.getItem("selectedMajor");
    if (storedSelectedMajor) {
      return storedSelectedMajor;
    } else {
      return null;
    }
  });

  const [term, setTerm] = useState<string>(() => {
    return localStorage.getItem("selectedTerm") ?? "summer";
  });
  const [year, setYear] = useState<string>(() => {
    return localStorage.getItem("selectedYear") ?? "26";
  });
  const [selectedValue, setSelectedValue] = useState<string>(() => {
    return localStorage.getItem("selectedTermValue") ?? "summer 26";
  });
  const [calendarResetKey, setCalendarResetKey] = useState<string>(
    `${term}_${year}`
  );

  // Initialize selectedCourses based on the current term/year
  const [selectedCourses, setSelectedCourses] = useState<Course[]>(() => {
    const storedSelectedCourses = localStorage.getItem(
      `selectedCourses_${term}_${year}`
    );
    if (storedSelectedCourses) {
      return JSON.parse(storedSelectedCourses);
    } else {
      return [];
    }
  });

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTrigger, setSearchTrigger] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<
    "calendar" | "graph" | "map" | "plan" | ""
  >("");
  const [hasBeenLoaded, setLoaded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  // On small screens only one of the two panes is visible at a time
  const [mobilePane, setMobilePane] = useState<"courses" | "view">("courses");

  // Live chat and the AI assistant share one panel, closed until asked for
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<"live" | "ai">("live");
  const isChatVisible = isChatOpen && chatTab === "live";
  
  const [hasNewMessage, setHasNewMessage] = useState<boolean>(false);

  const [customAppointments, setCustomAppointments] = useState<any[]>(() => {
    const storedCustomAppointment = localStorage.getItem(
      `customAppointments_${term}_${year}`
    );
    if (storedCustomAppointment) {
      return JSON.parse(storedCustomAppointment);
    } else {
      return [];
    }
  });

  const [activeUsers, setActiveUsers] = useState<number>(0);

  const showView = useCallback(
    (view: "calendar" | "graph" | "map" | "plan") => {
      setCurrentView(view);
      setMobilePane("view");
    },
    []
  );

  useEffect(() => {
    setCurrentView("calendar");
  }, []);

  useEffect(() => {
    const unsub = useAIActionStore.subscribe((state) => {
      const confirmed = state.actions.filter((a) => a.status === "confirmed");
      for (const action of confirmed) {
        switch (action.name) {
          case "add_course_to_scheduler": {
            const code = action.arguments.course_code as string;
            const currentTerm = localStorage.getItem("selectedTerm") || term;
            const currentYear = localStorage.getItem("selectedYear") || year;
            axios.post(API_URLS.GET_COURSES, {
              searchTerm: code,
              itemsPerPage: 20,
              startFrom: 0,
              term: currentTerm,
              year: currentYear,
            }).then((response) => {
              if (response.data.length > 0) {
                const course = response.data[0];
                setSelectedCourses((prev) => {
                  if (prev.some((c) => c.code === course.code && c.name === course.name)) return prev;
                  return [...prev, { ...course, creditsEditable: course.sections[0]?.credits === "VAR" }];
                });
                setLoaded(true);
              }
            });
            break;
          }
          case "switch_scheduler_view":
            if (action.arguments.view === "ai") {
              setChatTab("ai");
              setIsChatOpen(true);
            } else {
              showView(
                action.arguments.view as "calendar" | "graph" | "map" | "plan"
              );
            }
            break;
          case "remove_course_from_scheduler": {
            const code = action.arguments.course_code as string;
            setSelectedCourses((prev) =>
              prev.filter((c) => c.code !== code)
            );
            break;
          }
        }
      }
      if (confirmed.length > 0) {
        useAIActionStore.getState().clearProcessed();
      }
    });
    return unsub;
  }, []);

  // ADJUST HERE FOR LOCAL STORAGE RESET
  const version = JSON.parse(localStorage.getItem("version") || "0");
  if (version === 0) {
    localStorage.clear();
    localStorage.setItem("version", JSON.stringify(1));
  }

  useEffect(() => {
    localStorage.removeItem("hasShownInstructions");
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Save selectedCourses when they change, using term-specific key
  useEffect(() => {
    if (selectedCourses.length > 0 || hasBeenLoaded) {
      localStorage.setItem(
        `selectedCourses_${term}_${year}`,
        JSON.stringify(selectedCourses)
      );
    }
  }, [selectedCourses, hasBeenLoaded, term, year]);

  // Save customAppointments when they change, using term-specific key
  useEffect(() => {
    localStorage.setItem(
      `customAppointments_${term}_${year}`,
      JSON.stringify(customAppointments)
    );
  }, [customAppointments, term, year]);

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  const handleNewMessage = useCallback(() => {
    if (!isChatVisible) {
      setHasNewMessage(true);
    }
  }, [isChatVisible]);

  const openChat = (tab: "live" | "ai") => {
    setChatTab(tab);
    setIsChatOpen(true);
    if (tab === "live") {
      setHasNewMessage(false);
      localStorage.setItem("lastReadTimestamp", new Date().toISOString());
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEventSource(BACKEND_URLS.ACTIVE_USERS_STREAM, {
      signal: controller.signal,
      onmessage(ev) {
        if (ev.event === "active_users") {
          const { active_users } = JSON.parse(ev.data);
          setActiveUsers(active_users);
        }
      },
      onerror() {},
    });
    return () => controller.abort();
  }, []);

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const [selectedTerm, selectedYear] = event.target.value.split(" ");
    const newTerm = selectedTerm.toLowerCase();
    const newYear = selectedYear;

    // Save current state before switching terms
    localStorage.setItem(
      `selectedCourses_${term}_${year}`,
      JSON.stringify(selectedCourses)
    );
    localStorage.setItem(
      `customAppointments_${term}_${year}`,
      JSON.stringify(customAppointments)
    );

    // Update the term and year state
    setSelectedValue(event.target.value);
    setTerm(newTerm);
    setYear(newYear);
    localStorage.setItem("selectedTerm", newTerm);
    localStorage.setItem("selectedYear", newYear);
    localStorage.setItem("selectedTermValue", event.target.value);

    // Create a new reset key to trigger the Calendar component to reload with the new term
    setCalendarResetKey(`${newTerm}_${newYear}`);

    // Load the saved state for the new term
    const storedSelectedCourses = localStorage.getItem(
      `selectedCourses_${newTerm}_${newYear}`
    );
    if (storedSelectedCourses) {
      setSelectedCourses(JSON.parse(storedSelectedCourses));
    } else {
      setSelectedCourses([]);
    }

    const storedCustomAppointments = localStorage.getItem(
      `customAppointments_${newTerm}_${newYear}`
    );
    if (storedCustomAppointments) {
      setCustomAppointments(JSON.parse(storedCustomAppointments));
    } else {
      setCustomAppointments([]);
    }

  };

  const viewLabels = {
    calendar: "Schedule",
    graph: "Prerequisites",
    plan: "Model Plans",
    map: "Map",
    "": "Schedule",
  };

  return (
    <div className={`sora-unique scheduler-app show-${mobilePane}`}>
      <div className={`chat-dock ${isChatOpen ? "open" : ""}`}>
        <div className="chat-dock-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={chatTab === "live"}
            className={chatTab === "live" ? "active" : ""}
            onClick={() => openChat("live")}
          >
            Live chat
            {hasNewMessage && <span className="badge"></span>}
          </button>
          <button
            role="tab"
            aria-selected={chatTab === "ai"}
            className={chatTab === "ai" ? "active" : ""}
            onClick={() => openChat("ai")}
          >
            AI assistant
          </button>
          <button
            className="chat-dock-close"
            aria-label="Close chat"
            onClick={() => setIsChatOpen(false)}
          >
            <IoClose size={20} />
          </button>
        </div>
        <div className="chat-dock-pane" hidden={chatTab !== "live"}>
          <Chat
            isChatVisible={isChatVisible}
            setIsChatVisible={setIsChatOpen}
            handleNewMessage={handleNewMessage}
          />
        </div>
        <div className="chat-dock-pane" hidden={chatTab !== "ai"}>
          <AIChat />
        </div>
      </div>
      <button
        className={`chat-toggle-button ${isChatOpen ? "hide" : "visible"} ${
          hasNewMessage ? "wiggle" : ""
        }`}
        onClick={() => openChat(chatTab)}
        aria-label="Open chat"
      >
        <AiOutlineMessage size={28} style={{ transform: "scaleX(-1)" }} />
        {hasNewMessage && <span className="badge"></span>}
      </button>
      <Header
        showView={showView}
        currentView={currentView}
        selectedCourses={selectedCourses}
        windowWidth={windowWidth}
        selectedValue={selectedValue}
        handleTermChange={handleTermChange}
      />
      <div className="content-wrapper">
        <div className="course-display">
          <div className="courses-pane">
            <CoursesHandler
              selectedCourses={selectedCourses}
              setSelectedCourses={setSelectedCourses}
              selectedMajor={selectedMajor}
              setSelectedMajor={setSelectedMajor}
              debouncedSearchTerm={debouncedSearchTerm}
              setDebouncedSearchTerm={setDebouncedSearchTerm}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              hasBeenLoaded={hasBeenLoaded}
              setLoaded={setLoaded}
              customAppointments={customAppointments}
              setCustomAppointments={setCustomAppointments}
              term={term}
              year={year}
              selectedValue={selectedValue}
              searchTrigger={searchTrigger}
              setSearchTrigger={setSearchTrigger}
            />
          </div>
          <div className="view-pane">
            {currentView === "graph" && (
              <Graph
                setDebouncedSearchTerm={setDebouncedSearchTerm}
                setSearchTerm={setSearchTerm}
                setSearchTrigger={setSearchTrigger}
                searchTrigger={searchTrigger}
                isMobile={isMobile}
                selectedCourses={selectedCourses}
                selectedMajor={selectedMajor}
                setSelectedMajor={setSelectedMajor}
                term={term}
                year={year}
              />
            )}
            {currentView === "calendar" && (
              <Calendar
                selectedCourses={selectedCourses}
                customAppointments={customAppointments}
                setCustomAppointments={setCustomAppointments}
                term={term}
                year={year}
                key={calendarResetKey}
              />
            )}
            {currentView === "map" && (
              <div className="map-container">
                <MapBox term={term} year={year} />
              </div>
            )}
            {currentView === "plan" && <ModelPlan />}
          </div>
        </div>
      </div>
      <nav className="bottom-bar" aria-label="Panes">
        <button
          className={mobilePane === "courses" ? "active" : ""}
          onClick={() => setMobilePane("courses")}
        >
          <IoSearch size={20} />
          Courses
          {selectedCourses.length > 0 && (
            <span className="bottom-bar-count">{selectedCourses.length}</span>
          )}
        </button>
        <button
          className={mobilePane === "view" ? "active" : ""}
          onClick={() => setMobilePane("view")}
        >
          <AiOutlineCalendar size={20} />
          {viewLabels[currentView]}
        </button>
      </nav>
      <Footer />
      <div className="floating-text">
        <div className="green-circle"></div>
        {activeUsers} online
      </div>
    </div>
  );
};

export default Main;
