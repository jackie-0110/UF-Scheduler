import React from "react";
import { COURSE_CODE, splitPrereqs } from "./prereqText";

// Course codes become buttons that search for that course
const withCodeLinks = (text: string, onCode?: (code: string) => void) => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of Array.from(text.matchAll(COURSE_CODE))) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const code = `${match[1]} ${match[2]}`;
    nodes.push(
      onCode ? (
        <button
          key={index}
          type="button"
          className="prereq-code"
          onClick={(e) => {
            e.stopPropagation();
            onCode(code);
          }}
          title={`Search for ${code}`}
        >
          {code}
        </button>
      ) : (
        <strong key={index}>{code}</strong>
      )
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

const PrerequisiteList: React.FC<{
  prerequisites?: string;
  onCourseCode?: (code: string) => void;
}> = ({ prerequisites, onCourseCode }) => {
  const parts = splitPrereqs(prerequisites);
  if (!parts.length) {
    return <span className="prereq-none">None listed</span>;
  }
  return (
    <ul className="prereq-list">
      {parts.map((part, i) => (
        <li key={i}>{withCodeLinks(part, onCourseCode)}</li>
      ))}
    </ul>
  );
};

export default PrerequisiteList;
