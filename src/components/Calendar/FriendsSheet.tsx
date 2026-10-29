import { useEffect, useMemo, useState } from "react";
import { IoCheckmark, IoChevronBack, IoClose, IoLinkOutline, IoShareOutline, IoTrashOutline } from "react-icons/io5";
import { Section } from "../CourseUI/CourseTypes";
import {
  Block,
  busyByDay,
  DAY_END,
  DAY_NAMES,
  DAY_START,
  formatBlock,
  freeTogether,
  SharedSchedule,
  sharedCourses,
  shareLink,
  toShared,
} from "./friends";

const NAME_KEY = "shareName";
const spacedCode = (code: string) => code.replace(/([A-Z]+)/g, "$1 ").trim();
const termLabel = (s: { term: string; year: string }) =>
  `${s.term.charAt(0).toUpperCase()}${s.term.slice(1)} ${s.year}`;

const Bar: React.FC<{ blocks: Block[]; className: string }> = ({ blocks, className }) => {
  const span = DAY_END - DAY_START;
  return (
    <div className={`friend-bar ${className}`}>
      {blocks.map((b) => {
        const start = Math.max(b.start, DAY_START);
        const end = Math.min(b.end, DAY_END);
        if (end <= start) return null;
        return (
          <span
            key={b.start}
            style={{ left: `${((start - DAY_START) / span) * 100}%`, width: `${((end - start) / span) * 100}%` }}
          />
        );
      })}
    </div>
  );
};

const Compare: React.FC<{ friend: SharedSchedule; mine: SharedSchedule | null }> = ({ friend, mine }) => {
  const result = useMemo(() => {
    if (!mine) return null;
    const myBusy = busyByDay(mine.classes);
    const theirBusy = busyByDay(friend.classes);
    return {
      courses: sharedCourses(mine.classes, friend.classes),
      days: DAY_NAMES.map((name, i) => ({
        name,
        mine: myBusy[i],
        theirs: theirBusy[i],
        free: freeTogether(myBusy[i], theirBusy[i]),
      })),
    };
  }, [friend, mine]);

  if (!mine || !result) {
    return <p className="friend-empty">Build a schedule first, then you can compare it with {friend.name}'s.</p>;
  }

  return (
    <>
      {(mine.term !== friend.term || mine.year !== friend.year) && (
        <p className="friend-warn">
          Their schedule is for {termLabel(friend)} and you're looking at {termLabel(mine)}.
        </p>
      )}
      <span className="csu-label">Classes together</span>
      {result.courses.length ? (
        <ul className="friend-courses">
          {result.courses.map((c) => (
            <li key={c.code}>
              <strong>{spacedCode(c.code)}</strong>
              <span className="cart-name">{c.name}</span>
              <span className={`friend-tag${c.sameSection ? " same" : ""}`}>
                {c.sameSection ? "Same section" : `They're in #${c.classNumber}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="friend-empty">No classes in common.</p>
      )}

      <span className="csu-label">Free together, 8am–6pm</span>
      <div className="friend-legend">
        <span className="me">You</span>
        <span className="them">{friend.name}</span>
        <span className="free">Both free</span>
      </div>
      <ul className="friend-days">
        {result.days.map((day) => (
          <li key={day.name}>
            <span className="friend-day">{day.name}</span>
            <div className="friend-bars">
              <Bar blocks={day.free} className="free" />
              <Bar blocks={day.mine} className="me" />
              <Bar blocks={day.theirs} className="them" />
            </div>
            <span className="friend-free-text">
              {day.free.length ? day.free.map(formatBlock).join(", ") : "No shared gap"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
};

// Share your schedule as a link and compare with friends who sent theirs
const FriendsSheet: React.FC<{
  combination: Section[] | null;
  term: string;
  year: string;
  friends: SharedSchedule[];
  comparing: SharedSchedule | null;
  setComparing: (friend: SharedSchedule | null) => void;
  onRemoveFriend: (friend: SharedSchedule) => void;
  onClose: () => void;
}> = ({ combination, term, year, friends, comparing, setComparing, onRemoveFriend, onClose }) => {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const mine = combination ? toShared(name || "Me", term, year, combination) : null;
  const link = mine ? shareLink({ ...mine, name: name.trim() || "A friend" }) : "";
  const canShare = typeof navigator.share === "function";

  const saveName = (value: string) => {
    setName(value);
    try {
      localStorage.setItem(NAME_KEY, value);
    } catch {}
  };

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: "My UF schedule", text: `${name || "My"} schedule for ${termLabel({ term, year })}`, url: link });
        return;
      } catch {
        // cancelled: fall through to copying
      }
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  };

  return (
    <div className="cart-backdrop" onClick={onClose}>
      <div className="cart-sheet friend-sheet" role="dialog" aria-label="Friends" onClick={(e) => e.stopPropagation()}>
        <div className="cart-head">
          {comparing && friends.length > 0 && (
            <button type="button" className="cart-close" onClick={() => setComparing(null)} aria-label="Back">
              <IoChevronBack size={20} />
            </button>
          )}
          <div>
            <h2>{comparing ? `You & ${comparing.name}` : "Share & compare"}</h2>
            <p>
              {comparing
                ? `Their ${termLabel(comparing)} schedule vs the one you're viewing.`
                : "Send your schedule to a friend. When they send theirs back, see your classes together and when you're both free."}
            </p>
          </div>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="friend-body">
          {comparing ? (
            <Compare friend={comparing} mine={mine} />
          ) : (
            <>
              <label className="friend-name">
                <span className="csu-label">Your name</span>
                <input value={name} onChange={(e) => saveName(e.target.value)} placeholder="So friends know it's you" maxLength={40} />
              </label>
              {mine ? (
                <button type="button" className="friend-share" onClick={share}>
                  {copied ? <IoCheckmark size={18} /> : canShare ? <IoShareOutline size={18} /> : <IoLinkOutline size={18} />}
                  {copied ? "Link copied" : canShare ? "Share my schedule" : "Copy my schedule link"}
                </button>
              ) : (
                <p className="friend-empty">Build a schedule first to share it.</p>
              )}
              <p className="friend-note">
                The link holds your class times and sections, nothing else. Personal events show up only as "Busy".
              </p>

              <span className="csu-label">Friends</span>
              {friends.length ? (
                <ul className="friend-list">
                  {friends.map((f) => (
                    <li key={`${f.name}-${f.term}-${f.year}`}>
                      <button type="button" className="friend-open" onClick={() => setComparing(f)}>
                        <strong>{f.name}</strong>
                        <span>
                          {termLabel(f)} · {f.classes.filter((c) => c.code).length} classes
                        </span>
                      </button>
                      <button type="button" className="cart-close" onClick={() => onRemoveFriend(f)} aria-label={`Remove ${f.name}`}>
                        <IoTrashOutline size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="friend-empty">Open a friend's link and they'll show up here.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsSheet;
