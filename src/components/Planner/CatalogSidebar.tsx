import React, { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { IoSearch } from "react-icons/io5";
import CourseCard from "./CourseCard";
import { PrereqInfo, PrereqMap } from "../Cytoscape/prereqs";

const MAX_RESULTS = 80;

interface CatalogSidebarProps {
  info: PrereqMap;
  placedCodes: Set<string>;
  completed: Set<string>;
  onToggleCompleted: (code: string) => void;
}

const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  info,
  placedCodes,
  completed,
  onToggleCompleted,
}) => {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: "catalog" });

  const courses = useMemo(
    () => Object.values(info).sort((a, b) => a.code.localeCompare(b.code)),
    [info]
  );
  const departments = useMemo(
    () => Array.from(new Set(courses.map((c) => c.dept).filter(Boolean))).sort(),
    [courses]
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "");
    return courses.filter((course: PrereqInfo) => {
      if (dept && course.dept !== dept) return false;
      if (!needle) return true;
      return (
        course.code.toLowerCase().includes(needle) ||
        course.name.toLowerCase().replace(/\s+/g, "").includes(needle)
      );
    });
  }, [courses, query, dept]);

  const available = matches.filter((c) => !placedCodes.has(c.code) && !completed.has(c.code));
  const done = matches.filter((c) => completed.has(c.code));
  const searching = query.trim() !== "" || dept !== "";

  return (
    <aside ref={setNodeRef} className={`planner-sidebar${isOver ? " over" : ""}`}>
      <div className="planner-sidebar-head">
        <h2>Course catalog</h2>
        <div className="planner-search">
          <IoSearch size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or title"
            aria-label="Search courses"
          />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="planner-sidebar-list">
        {!searching && (
          <p className="planner-hint">
            Search or pick a department, then drag a course into a semester. Drop a planned course
            here to take it back out.
          </p>
        )}
        {searching &&
          available.slice(0, MAX_RESULTS).map((course) => (
            <CourseCard
              key={course.code}
              dragId={`catalog:${course.code}`}
              code={course.code}
              course={course}
              onToggleCompleted={() => onToggleCompleted(course.code)}
            />
          ))}
        {searching && available.length === 0 && <p className="planner-hint">No courses found.</p>}
        {searching && available.length > MAX_RESULTS && (
          <p className="planner-hint">
            Showing {MAX_RESULTS} of {available.length}. Narrow your search to see more.
          </p>
        )}
        {done.length > 0 && (
          <>
            <h3 className="planner-section">Completed</h3>
            {done.slice(0, MAX_RESULTS).map((course) => (
              <CourseCard
                key={course.code}
                dragId={`catalog:${course.code}`}
                code={course.code}
                course={course}
                completed
                onRemove={() => onToggleCompleted(course.code)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
};

export default CatalogSidebar;
