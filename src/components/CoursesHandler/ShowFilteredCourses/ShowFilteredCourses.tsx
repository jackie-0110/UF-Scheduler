import React, { useState, useMemo, useEffect, useRef } from "react";
import { Course } from "../../CourseUI/CourseTypes";
import CourseDropdown from "../../CourseUI/CourseDropdown/CourseDropdown";
import { ShowFilteredCoursesClasses } from "./ShowFilteredCoursesClasses";
import InfiniteScroll from "react-infinite-scroller";
import axios from "axios";
import {
  PiPlusBold,
  PiMinusBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiVideoCameraSlashBold,
  PiPencilBold
} from "react-icons/pi";
import "./ShowFilteredCourses.css";
import { API_URLS, BACKEND_URLS, getAuthHeaders } from "../../../config/api";
import { useAuth } from "react-oidc-context";

interface ShowFilteredCoursesProps {
  debouncedSearchTerm: string;
  selectedCourses: Course[];
  setSelectedCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  term: string;
  year: string;
  searchTrigger: boolean;
  selectedValue: string;
}

const groupByCourseCodeAndName = (courses: Course[]) => {
  return courses.reduce((grouped: { [key: string]: Course[] }, course) => {
    const key = `${course.code}|${course.name}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(course);
    return grouped;
  }, {});
};

const ShowFilteredCourses: React.FC<ShowFilteredCoursesProps> = ({
  debouncedSearchTerm,
  selectedCourses,
  setSelectedCourses,
  setLoaded,
  term,
  year,
  searchTrigger,
  selectedValue
}) => {
  const auth = useAuth();
  const [openCourseCode, setOpenCourseCode] = useState<string[] | null>();
  const [courseAnimation, setCourseAnimation] = useState<{
    [key: string]: boolean;
  }>({});

  const [animationKey, setAnimationKey] = useState<string>(debouncedSearchTerm);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { courseCard } = ShowFilteredCoursesClasses;

  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [noCoursesFound, setNoCoursesFound] = useState<boolean>(false);
  const [searchFailed, setSearchFailed] = useState<boolean>(false);

  const handleCourseCardClick = (event: React.MouseEvent, course: Course) => {
    toggleCourseDropdown(`${course.code}|${course.name}`);
  };

  const toggleCourseDropdown = (courseCode: string) => {
    setOpenCourseCode((prevOpenCourseCodes = []) => {
      if (prevOpenCourseCodes === null) {
        return [courseCode];
      } else {
        const isOpen = prevOpenCourseCodes.includes(courseCode);
        setCourseAnimation((prevCourseAnimation) => ({
          ...prevCourseAnimation,
          [courseCode]: !isOpen,
        }));
        if (!isOpen) {
          return [...prevOpenCourseCodes, courseCode];
        } else {
          return prevOpenCourseCodes.filter((code) => code !== courseCode);
        }
      }
    });
  };

  const toggleCourseSelected = (course: Course) => {
    setLoaded(true);
    const isSelected = selectedCourses.some(
      (selectedCourse) =>
        selectedCourse.code === course.code &&
        selectedCourse.name === course.name
    );

    if (isSelected) {
      setSelectedCourses((prevSelectedCourses) =>
        prevSelectedCourses.filter(
          (selectedCourse) =>
            selectedCourse.code !== course.code ||
            selectedCourse.name !== course.name
        )
      );
    } else {
      setSelectedCourses((prevSelectedCourses) => [
        ...prevSelectedCourses,
        course,
      ]);

      sendCourseMetrics(course);
    }
  };

  // New function to add only non-online sections
  const toggleNonOnlineSections = (course: Course) => {
    setLoaded(true);

    const nonOnlineSections = course.sections.filter(
      (section) => section.meetTimes && section.meetTimes.length > 0
    );

    const selectedNonOnline = {
      ...course,
      sections: nonOnlineSections,
      inPerson: true,
    };

    // const isSelected = selectedCourses.some(
    //   (selectedCourse) =>
    //     selectedCourse.code === course.code &&
    //     selectedCourse.name === course.name &&
    //     selectedCourse.sections.length === selectedNonOnline.sections.length
    // );

    // if (isSelected) {
    //   setSelectedCourses((prevSelectedCourses) =>
    //     prevSelectedCourses.filter(
    //       (selectedCourse) =>
    //         selectedCourse.code !== course.code ||
    //         selectedCourse.name !== course.name
    //     )
    //   );
    // } else {
      setSelectedCourses((prevSelectedCourses) => [
        ...prevSelectedCourses,
        selectedNonOnline,
      ]);
    // }
  };

  const itemsPerPage = 20;
  const [hasMore, setHasMore] = useState(true);
  const [records, setRecords] = useState(itemsPerPage);

  const groupedFilteredCourses = useMemo(() => {
    return groupByCourseCodeAndName(filteredCourses);
  }, [filteredCourses]);

  useMemo(() => {
    setHasMore(true);
    setRecords(itemsPerPage);
    setAnimationKey(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [debouncedSearchTerm]);

  const loadMore = async () => {
    if (filteredCourses.length < 20) {
      return;
    }

    try {
      const response = await axios.post(API_URLS.GET_COURSES, {
        searchTerm: debouncedSearchTerm,
        itemsPerPage: itemsPerPage,
        startFrom: records,
        term,
        year
      });

      setFilteredCourses((prevCourses) => [...prevCourses, ...response.data]);
      setRecords(records + itemsPerPage);
    } catch (error) {
      // Data load failed silently
    }

    if (records >= 2 * itemsPerPage + filteredCourses.length) {
      setHasMore(false);
    }
  };

  const sendCourseMetrics = async (course: Course) => {
    try {
      await axios.post(
        BACKEND_URLS.COURSE_METRICS,
        { code: course.code, name: course.name },
        { headers: getAuthHeaders(auth) }
      );
    } catch (error) {
      // Metrics send failed silently
    }
  };

  useEffect(() => {
    if (debouncedSearchTerm.trim() === "") {
      setFilteredCourses([]);
      setNoCoursesFound(false);
      setSearchFailed(false);
      return;
    }
    // Ignore responses from searches that a newer keystroke has replaced
    let stale = false;
    const fetchData = async () => {
      try {
        const response = await axios.post(API_URLS.GET_COURSES, {
          searchTerm: debouncedSearchTerm,
          itemsPerPage: itemsPerPage,
          startFrom: 0,
          term,
          year
        });
        if (stale) return;
        setSearchFailed(false);
        if (response.data.length > 0) {
          setNoCoursesFound(false);
          setFilteredCourses(response.data.map((course: Course) => ({
            ...course,
            creditsEditable: course.sections[0].credits === "VAR"
          })));
        }
        else {
          setNoCoursesFound(true);
          setFilteredCourses([]);
        }
      } catch (error) {
        if (stale) return;
        setSearchFailed(true);
        setNoCoursesFound(false);
        setFilteredCourses([]);
      }
    };
    fetchData();
    setOpenCourseCode(null);
    return () => {
      stale = true;
    };
  }, [searchTrigger, selectedValue]);

  const handleCreditsChange = (courseCode: string, courseName: string, newCredits: number) => {
    setFilteredCourses((prevCourses) =>
      prevCourses.map((course) => {
        if (course.code === courseCode && course.name === courseName) {
          return {
            ...course,
            sections: course.sections.map((section) => ({
              ...section,
              credits: newCredits,
            })),
          };
        }
        return course;
      })
    );
  };

  return (
    <div
      ref={containerRef}
      className="filtered-courses-container overflow-y-scroll mt-3"
    >
      <InfiniteScroll
        pageStart={0}
        loadMore={loadMore}
        hasMore={hasMore}
        useWindow={false}
      >
        {Object.keys(groupedFilteredCourses).length > 0 ? (
          Object.keys(groupedFilteredCourses).map((key, index) => {
            const courses = groupedFilteredCourses[key];
            const firstCourse = courses[0];
            const isCourseSelected = selectedCourses.some(
              (selectedCourse) =>
                selectedCourse.code === firstCourse.code &&
                selectedCourse.name === firstCourse.name
            );
            const isOpen = openCourseCode?.includes(
              `${firstCourse.code}|${firstCourse.name}`
            );
            const currentBatchIndex = index % itemsPerPage;

            return (
              <React.Fragment key={index}>
                <div
                  key={`${animationKey}`}
                  className="flex items-center w-full justify-between fade-in-wave"
                  style={{ animationDelay: `${currentBatchIndex * 35}ms` }}
                >
                  <div className={`${courseCard}`}>
                    <div
                      className="cursor-pointer"
                      onClick={(e) => handleCourseCardClick(e, firstCourse)}
                    >
                      <div className="flex flex-row text-black font-semibold items-center justify-between w-full h-6 p-1 m-0">
                        {firstCourse.termInd !== " " &&
                        firstCourse.termInd !== "C" ? (
                          <>
                            <div className="mr-auto h-6 whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                              {firstCourse.code.replace(/([A-Z]+)/g, "$1 ")} -{" "}
                              {firstCourse.termInd}
                            </div>
                          </>
                        ) : (
                          <div className="mr-auto h-6  whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                            {firstCourse.code.replace(/([A-Z]+)/g, "$1 ")}
                          </div>
                        )}
                        <div className="flex items-center text-sm font-normal text-gray-500 mr-2 h-5 mb-[0.3rem] whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                          Credits:{" "}
                          {(firstCourse.creditsEditable || editingCredits === `${firstCourse.code}|${firstCourse.name}`) ? (
                            editingCredits === `${firstCourse.code}|${firstCourse.name}` ? (
                              <input
                                type="number"
                                min="0"
                                className="credits-input ml-1"
                                style={{
                                  backgroundColor: 'transparent',
                                  color: 'var(--csu-ink)',
                                  outline: 'none',
                                  borderBottom: '1px solid var(--csu-blue)',
                                  width: '3ch',
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleCreditsChange(
                                    firstCourse.code, firstCourse.name,
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                onBlur={() => setEditingCredits(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setEditingCredits(null);
                                  }
                                }}
                              />
                            ) : (
                              <div className="ml-1 flex items-center">
                                {firstCourse.sections[0].credits}
                                <PiPencilBold
                                  className="ml-1 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCredits(`${firstCourse.code}|${firstCourse.name}`);
                                  }}
                                />
                              </div>
                            )
                          ) : (
                            firstCourse.sections[0].credits
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-light text-gray-600 mx-1 line-clamp-2 overflow-ellipsis overflow-hidden">
                        {firstCourse.name}
                      </div>
                      <div className="course-actions">
                        <button
                          type="button"
                          className={`course-action${
                            isCourseSelected ? " remove" : " primary"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseSelected(firstCourse);
                          }}
                          title={
                            isCourseSelected
                              ? "Remove this course from your schedule"
                              : "Add this course with all of its sections"
                          }
                        >
                          {isCourseSelected ? <PiMinusBold /> : <PiPlusBold />}
                          {isCourseSelected ? "Remove" : "Add"}
                        </button>
                        {!isCourseSelected && (
                          <button
                            type="button"
                            className="course-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNonOnlineSections(firstCourse);
                            }}
                            title="Add this course, leaving out online sections"
                          >
                            <PiVideoCameraSlashBold />
                            In-person only
                          </button>
                        )}
                        <button
                          type="button"
                          className="course-action sections"
                          aria-expanded={!!isOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseDropdown(
                              `${firstCourse.code}|${firstCourse.name}`
                            );
                          }}
                        >
                          {firstCourse.sections.length} section
                          {firstCourse.sections.length === 1 ? "" : "s"}
                          {isOpen ? <PiCaretUpBold /> : <PiCaretDownBold />}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div>
                        <div className={`mt-2 mb-0 mx-1 text-sm text-gray-700 `}>
                          <hr
                            style={{
                              border: "none",
                              borderTop: "2px solid var(--csu-line)",
                              marginBottom: "4px",
                            }}
                          />
                          <strong>Description: </strong>
                          {firstCourse.description
                            ? firstCourse.description.replace("(P)", "").trim()
                            : "N/A"}
                          <br />
                          <strong> Prerequisites: </strong>
                          {firstCourse.prerequisites
                            ? firstCourse.prerequisites
                                .replace("Prereq: ", "")
                                .trim()
                            : "N/A"}
                        </div>
                        <div>
                          <div className="w-[100%] opacity-100 visible transition-opacity my-1">
                            <CourseDropdown
                              course={firstCourse}
                              selectedCourses={selectedCourses}
                              setSelectedCourses={setSelectedCourses}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        ) : (
          <div className="search-status fade-text-in">
            {searchFailed ? (
              <>
                <strong>Search is unavailable right now.</strong>
                <span>Check your connection and try again.</span>
              </>
            ) : noCoursesFound ? (
              <>
                <strong>No courses match “{debouncedSearchTerm}”.</strong>
                <span>Try a course code like COP 3502, a title keyword, or a different term.</span>
              </>
            ) : debouncedSearchTerm.trim() === "" ? (
              <>
                <strong>Find your courses</strong>
                <span>Search by course code (COP 3502), title (calculus), or instructor.</span>
              </>
            ) : null}
          </div>
        )}
      </InfiniteScroll>
    </div>
  );
};

export default ShowFilteredCourses;
