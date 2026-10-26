import React from "react";
import { COURSE_CODE, splitPrereqs } from "./prereqText";

// Connecting text between codes. Inner parentheses stay, since they carry
// the grouping in "A or (B and C)", but sit snug against the codes.
const textNode = (key: string, text: string) =>
  text
    .replace(/\s+/g, " ")
    .split(/([()])/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece, i) =>
      piece === "(" || piece === ")" ? (
        <span
          key={`${key}-${i}`}
          className={`prereq-paren ${piece === "(" ? "open" : "close"}`}
        >
          {piece}
        </span>
      ) : (
        <span key={`${key}-${i}`} className="prereq-text">
          {piece}
        </span>
      )
    );

// Course codes become buttons that search for that course

const withCodeLinks = (text: string, onCode?: (code: string) => void) => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of Array.from(text.matchAll(COURSE_CODE))) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(...textNode(`t${index}`, text.slice(last, index)));
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
        <strong key={index} className="prereq-code">{code}</strong>
      )
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(...textNode("tail", text.slice(last)));
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
