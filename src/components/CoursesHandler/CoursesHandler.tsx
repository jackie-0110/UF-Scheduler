import React, { useEffect } from "react";
import CourseSearch from "./CourseSearch/CourseSearch";
import ShowFilteredCourses from "./ShowFilteredCourses/ShowFilteredCourses";
import LikedSelectedCourses from "./LikedSelectedCourses";
import { Course } from "../CourseUI/CourseTypes";
import "./CourseHandlerStyles.css"

interface CoursesHandlerProps {
  selectedCourses: Course[];
  setSelectedCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  selectedMajor: string | null;
  setSelectedMajor: React.Dispatch<React.SetStateAction<string | null>>;
  debouncedSearchTerm: string;
  setDebouncedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  hasBeenLoaded: boolean;
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  customAppointments: any[];
  setCustomAppointments: React.Dispatch<React.SetStateAction<any[]>>;
  term: string;
  year: string;
  selectedValue: string;
  searchTrigger: boolean;
  setSearchTrigger: React.Dispatch<React.SetStateAction<boolean>>;
}

const CoursesHandler: React.FC<CoursesHandlerProps> = (
  {
    selectedCourses,
    setSelectedCourses,
    selectedMajor,
    setSelectedMajor,
    debouncedSearchTerm,
    setDebouncedSearchTerm,
    searchTerm,
    setSearchTerm,
    hasBeenLoaded,
    setLoaded,
    customAppointments,
    setCustomAppointments,
    term,
    year,
    selectedValue,
    searchTrigger,
    setSearchTrigger
  }
) => {

  useEffect(() => {
    if (selectedMajor){
      localStorage.setItem("selectedMajor", selectedMajor);
    }
    else {
      localStorage.removeItem("selectedMajor");
    }
  }, [selectedMajor]);

  return (
    <div className="course-handler">
      {/* <MajorSelect 
        selectedMajor={selectedMajor}
        setSelectedMajor={setSelectedMajor}
      /> */}
      <CourseSearch
        setDebouncedSearchTerm={setDebouncedSearchTerm}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchTrigger={searchTrigger}
        setSearchTrigger={setSearchTrigger}
      />
      <LikedSelectedCourses
        selectedCourses={selectedCourses}
        setSelectedCourses={setSelectedCourses}
        setLoaded={setLoaded}
        customAppointments={customAppointments}
        setCustomAppointments={setCustomAppointments}
        setSearchTerm={setSearchTerm}
        setDebouncedSearchTerm={setDebouncedSearchTerm}
        setSearchTrigger={setSearchTrigger}
      />
      <ShowFilteredCourses
        debouncedSearchTerm={debouncedSearchTerm}
        selectedCourses={selectedCourses}
        setSelectedCourses={setSelectedCourses}
        setLoaded={setLoaded}
        term={term}
        year={year}
        searchTrigger={searchTrigger}
        selectedValue={selectedValue}
      />
    </div>
  );
};

export default CoursesHandler;
