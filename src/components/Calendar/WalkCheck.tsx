import { useMemo } from "react";
import { FaPersonWalking } from "react-icons/fa6";
import { IoAlertCircleOutline } from "react-icons/io5";
import { Section } from "../CourseUI/CourseTypes";
import { directionsUrl, findWalks } from "./walks";

const to12h = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`;
};

// Back-to-back classes in different buildings, with a warning when the walk
// barely fits in the break
const WalkCheck: React.FC<{ combination: Section[] }> = ({ combination }) => {
  const walks = useMemo(() => findWalks(combination), [combination]);
  if (!walks.length) return null;
  const tight = walks.filter((walk) => walk.tight).length;

  return (
    <details className="walk-check" open={tight > 0}>
      <summary>
        <FaPersonWalking aria-hidden />
        <span>
          {walks.length} {walks.length === 1 ? "walk" : "walks"} between classes
        </span>
        {tight > 0 && (
          <span className="walk-tight-count">
            <IoAlertCircleOutline aria-hidden /> {tight} tight
          </span>
        )}
      </summary>
      <ul>
        {walks.map((walk) => (
          <li
            key={`${walk.from.course}-${walk.from.end}-${walk.to.course}`}
            className={walk.tight ? "tight" : undefined}
          >
            <span className="walk-days">{walk.days.join("")}</span>
            <span className="walk-route">
              <strong>{walk.from.course}</strong> {walk.from.building}
              <span className="faint"> {to12h(walk.from.end)}</span>
              {" → "}
              <strong>{walk.to.course}</strong> {walk.to.building}
              <span className="faint"> {to12h(walk.to.begin)}</span>
            </span>
            <span className="walk-time">
              ~{walk.minutes} min walk · {walk.gap} min break
              {walk.tight && <span className="walk-flag">Tight</span>}
            </span>
            <a
              href={directionsUrl(walk.from.place, walk.to.place)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${walk.from.place.name} to ${walk.to.place.name}`}
            >
              Route
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
};

export default WalkCheck;
