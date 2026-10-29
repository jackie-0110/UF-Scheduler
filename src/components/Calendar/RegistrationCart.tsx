import { useEffect, useMemo, useState } from "react";
import { IoCheckmark, IoClose, IoCopyOutline } from "react-icons/io5";
import { Course, Section } from "../CourseUI/CourseTypes";
import { buildCart, meetingSummary } from "./registration";
import { sectionRating } from "./scheduleSort";
import { useWide } from "./useWide";

const spacedCode = (code: string) => code.replace(/([A-Z]+)/g, "$1 ").trim();

const CopyButton: React.FC<{ text: string; label: string; display?: string }> = ({
  text,
  label,
  display,
}) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={`cart-copy${copied ? " copied" : ""}`}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      aria-label={`Copy ${label}`}
    >
      {copied ? <IoCheckmark size={15} /> : <IoCopyOutline size={15} />}
      {copied ? "Copied" : display ?? text}
    </button>
  );
};

const SectionLine: React.FC<{ section: Section; compareTo?: Section }> = ({
  section,
  compareTo,
}) => {
  const rating = sectionRating(section);
  const lead = section.instructors?.find((i) => i?.name?.trim());
  const waitlist = section.waitList?.total ?? 0;
  return (
    <span className="cart-meta">
      {meetingSummary(section, compareTo)}
      {lead && (
        <>
          {" · "}
          {lead.name}
          {rating > 0 && <span className="cart-rating"> ★ {rating.toFixed(1)}</span>}
        </>
      )}
      {waitlist > 0 && <span className="cart-waitlist"> · {waitlist} on waitlist</span>}
    </span>
  );
};

const Instructor: React.FC<{ section: Section }> = ({ section }) => {
  const rating = sectionRating(section);
  const lead = section.instructors?.find((i) => i?.name?.trim());
  const waitlist = section.waitList?.total ?? 0;
  return (
    <span className="cart-meta">
      {lead ? lead.name : "Staff"}
      {rating > 0 && <span className="cart-rating"> ★ {rating.toFixed(1)}</span>}
      {waitlist > 0 && <span className="cart-waitlist"> · {waitlist} on waitlist</span>}
    </span>
  );
};

// Desktop: the whole plan, backups included, in one table
const CartTable: React.FC<{ rows: ReturnType<typeof buildCart> }> = ({ rows }) => (
  <table className="cart-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Course</th>
        <th>When & where</th>
        <th>Instructor</th>
        <th>Class #</th>
        <th>Backups that still fit</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(({ section, backups, fits }, index) => (
        <tr key={section.classNumber}>
          <td className="cart-order">{index + 1}</td>
          <td>
            <div className="cart-course">
              <span className="cart-dot" style={{ background: section.color }} />
              <div>
                <strong>{spacedCode(section.courseCode)}</strong>
                <span className="cart-name">{section.courseName}</span>
              </div>
            </div>
          </td>
          <td className="cart-meta cart-when">
            {meetingSummary(section)
              .split(", ")
              .map((line) => (
                <div key={line}>{line}</div>
              ))}
          </td>
          <td>
            <Instructor section={section} />
          </td>
          <td>
            <CopyButton text={String(section.classNumber)} label="class number" />
          </td>
          <td>
            {backups.length ? (
              <ul className="cart-table-backups">
                {backups.map((backup) => (
                  <li key={backup.classNumber}>
                    <CopyButton text={String(backup.classNumber)} label="backup class number" />
                    <span className="cart-meta">
                      {meetingSummary(backup, section)}
                      {" · "}
                      <Instructor section={backup} />
                    </span>
                  </li>
                ))}
                {fits > backups.length && (
                  <li className="cart-more">+{fits - backups.length} more fit</li>
                )}
              </ul>
            ) : (
              <span className="cart-no-backup">None fit. Register for this one first.</span>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// What to type into ONE.UF on registration day, with fallbacks ready
const RegistrationCart: React.FC<{
  combination: Section[];
  courses: Course[];
  onClose: () => void;
}> = ({ combination, courses, onClose }) => {
  const rows = useMemo(() => buildCart(combination, courses), [combination, courses]);
  const allNumbers = rows.map((row) => row.section.classNumber).join("\n");
  const wide = useWide();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cart-backdrop" onClick={onClose}>
      <div
        className={`cart-sheet${wide ? " cart-wide" : ""}`}
        role="dialog"
        aria-label="Registration cart"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-head">
          <div>
            <h2>Registration cart</h2>
            <p>
              Enter these class numbers in ONE.UF. Courses with the fewest backups are listed
              first, so grab those seats first.
            </p>
          </div>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>
        {wide ? (
          <CartTable rows={rows} />
        ) : (
        <ol className="cart-list">
          {rows.map(({ section, backups, fits }) => (
            <li key={section.classNumber}>
              <div className="cart-row">
                <span className="cart-dot" style={{ background: section.color }} />
                <div className="cart-main">
                  <strong>{spacedCode(section.courseCode)}</strong>
                  <span className="cart-name">{section.courseName}</span>
                  <SectionLine section={section} />
                </div>
                <CopyButton text={section.classNumber} label="class number" />
              </div>
              {backups.length > 0 ? (
                <details className="cart-backups">
                  <summary>
                    {fits} backup {fits === 1 ? "section fits" : "sections fit"} this schedule
                  </summary>
                  <ul>
                    {backups.map((backup) => (
                      <li key={backup.classNumber}>
                        <SectionLine section={backup} compareTo={section} />
                        <CopyButton text={backup.classNumber} label="backup class number" />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <span className="cart-no-backup">No other section fits. Register for this one first.</span>
              )}
            </li>
          ))}
        </ol>
        )}
        {rows.length > 1 && (
          <div className="cart-foot">
            <CopyButton text={allNumbers} label="all class numbers" display="Copy all" />
            <span>copies every class number, one per line</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationCart;
