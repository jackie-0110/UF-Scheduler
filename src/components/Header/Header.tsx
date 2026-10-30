import "./HeaderStyles.css";
import { useEffect, useState } from "react";
import { AiOutlineCalendar, AiOutlineSchedule } from "react-icons/ai";
import { IoGridOutline } from "react-icons/io5";
import { PiGraphFill } from "react-icons/pi";
import { BiLogOut } from "react-icons/bi";
import { Course } from "../CourseUI/CourseTypes";
import { GoogleButton, useAccount } from "../../account/account";
import { TERMS } from "../../config/terms";

type View = "calendar" | "graph" | "map" | "plan" | "planner";

interface HeaderProps {
  showView: (view: View) => void;
  currentView: string;
  selectedCourses: Course[];
  windowWidth: number;
  selectedValue: string;
  handleTermChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const Header: React.FC<HeaderProps> = ({
  showView,
  currentView,
  selectedCourses,
  windowWidth,
  selectedValue,
  handleTermChange,
}) => {
  const { user, checking, signOut } = useAccount();
  const [totalCredits, setTotalCredits] = useState(0);

  const userEmail = user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "?";
  const userPicture = user?.picture || undefined;

  useEffect(() => {
    const sumCredits = selectedCourses.reduce((totalCredits, course) => {
      if (course.excludedFromSchedule) return totalCredits;
      // Check if credits is a number
      if (typeof course.sections[0]?.credits === "number") {
        return totalCredits + course.sections[0].credits;
      }
      // If it's not a number, just return the accumulated total so far
      return totalCredits;
    }, 0);

    setTotalCredits(sumCredits);
  }, [selectedCourses]);

  const tabs: { view: View; label: string; icon: JSX.Element }[] = [
    { view: "calendar", label: "Scheduler", icon: <AiOutlineCalendar size={18} /> },
    { view: "graph", label: "Prerequisites", icon: <PiGraphFill size={18} /> },
    { view: "planner", label: "Planner", icon: <IoGridOutline size={18} /> },
    { view: "plan", label: "Model Plans", icon: <AiOutlineSchedule size={18} /> },
  ];
  const isDesktop = windowWidth >= 1001;

  const tabButtons = (
    <nav className="button-container" aria-label="Views">
      {tabs.map(({ view, label, icon }) => (
        <button
          key={view}
          className={`Button ${currentView === view ? "show" : "grayed"}`}
          onClick={() => showView(view)}
          aria-current={currentView === view ? "page" : undefined}
        >
          {isDesktop && icon}
          <span className="label">{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="header-container">
      <div className="header">
        <div className="header-left">
          <a href="/" className="brand">
            <img src="/csu_logo.svg" alt="UF CSU" className="brand-logo" />
            <span className="title">UF Scheduler</span>
          </a>
          <select
            value={selectedValue}
            onChange={handleTermChange}
            className="term-select"
            aria-label="Term"
          >
            {TERMS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {isDesktop && tabButtons}
        <div className="header-right">
          <div className="credits-container">
            <span className="credits-label">Credits</span>
            <span className="credits-value">{totalCredits}</span>
          </div>
          <div className="auth-section">
            {user ? (
              <>
                <div className="auth-avatar" title={userEmail}>
                  {userPicture ? (
                    <img
                      src={userPicture}
                      alt={userInitial}
                      className="auth-avatar-img"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    userInitial
                  )}
                </div>
                {isDesktop && <span className="auth-email">{userEmail}</span>}
                <button
                  className="auth-signout-btn"
                  onClick={signOut}
                  title="Sign out"
                >
                  {isDesktop ? "Sign Out" : <BiLogOut size={18} />}
                </button>
              </>
            ) : (
              !checking && <GoogleButton compact={windowWidth <= 500} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
