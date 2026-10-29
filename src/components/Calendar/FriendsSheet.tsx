import { useEffect, useMemo, useState } from "react";
import { IoCheckmark, IoChevronBack, IoClose, IoCopyOutline, IoLinkOutline, IoQrCodeOutline, IoShareOutline, IoTrashOutline } from "react-icons/io5";
import { QRCodeSVG } from "qrcode.react";
import { Section } from "../CourseUI/CourseTypes";
import {
  Block,
  busyByDay,
  classBlocksByDay,
  ClassBlock,
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
import { useWide } from "./useWide";

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

const hourLabel = (hour: number) => `${hour % 12 || 12}${hour >= 12 ? "pm" : "am"}`;

// Desktop: both weeks side by side in each day, shared free time shaded
const FriendWeek: React.FC<{
  name: string;
  mine: ClassBlock[][];
  theirs: ClassBlock[][];
  free: Block[][];
}> = ({ name, mine, theirs, free }) => {
  const all = [...mine.flat(), ...theirs.flat()];
  const first = Math.min(DAY_START / 60, ...all.map((b) => Math.floor(b.start / 60)));
  const last = Math.max(DAY_END / 60, ...all.map((b) => Math.ceil(b.end / 60)));
  const top = first * 60;
  const span = (last - first) * 60;
  const pos = (b: Block) => ({
    top: `${((b.start - top) / span) * 100}%`,
    height: `${((b.end - b.start) / span) * 100}%`,
  });
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div className="friend-week">
      <div className="friend-week-head">
        <span />
        {DAY_NAMES.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="friend-week-body" style={{ height: (last - first) * 40 }}>
        <div className="friend-week-hours">
          {hours.map((h) => (
            <span key={h} style={{ top: `${((h * 60 - top) / span) * 100}%` }}>
              {hourLabel(h)}
            </span>
          ))}
        </div>
        {DAY_NAMES.map((day, i) => (
          <div key={day} className="friend-week-day">
            {hours.map((h) => (
              <span key={h} className="friend-week-line" style={{ top: `${((h * 60 - top) / span) * 100}%` }} />
            ))}
            {free[i].map((b) => (
              <div key={`f${b.start}`} className="friend-week-free" style={pos(b)}>
                <span>{formatBlock(b)}</span>
              </div>
            ))}
            {mine[i].map((b) => (
              <div key={`m${b.start}${b.code}`} className="friend-week-class me" style={pos(b)} title={`You: ${b.code} ${b.place}`}>
                <strong>{b.code}</strong>
                <span>{b.place}</span>
              </div>
            ))}
            {theirs[i].map((b) => (
              <div key={`t${b.start}${b.code}`} className="friend-week-class them" style={pos(b)} title={`${name}: ${b.code} ${b.place}`}>
                <strong>{b.code}</strong>
                <span>{b.place}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

type CopyResult = { copied: number; missing: string[] };

// "Use Alex's schedule": their courses, each locked to their section
const CopyFriend: React.FC<{
  friend: SharedSchedule;
  term: string;
  year: string;
  myCourseCount: number;
  onCopy: (friend: SharedSchedule) => Promise<CopyResult>;
}> = ({ friend, term, year, myCourseCount, onCopy }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const otherTerm = friend.term !== term || friend.year !== year;
  const count = friend.classes.filter((c) => c.code).length;

  const run = async () => {
    setBusy(true);
    setConfirming(false);
    try {
      setResult(await onCopy(friend));
    } finally {
      setBusy(false);
    }
  };

  if (!count) return null;
  if (result) {
    return (
      <p className={`friend-copy-note${result.copied ? " good" : ""}`}>
        {result.copied
          ? `Copied ${result.copied} ${result.copied === 1 ? "class" : "classes"} with ${friend.name}'s sections.`
          : "Couldn't find their classes."}
        {result.missing.length > 0 && ` Not found: ${result.missing.map(spacedCode).join(", ")}.`}
      </p>
    );
  }
  if (otherTerm) {
    return <p className="friend-copy-note">Switch to {termLabel(friend)} to copy their classes.</p>;
  }
  if (confirming) {
    return (
      <div className="friend-copy confirm">
        <span>Replace your {myCourseCount} {myCourseCount === 1 ? "course" : "courses"} with {friend.name}'s?</span>
        <button type="button" className="friend-copy-go" onClick={run}>
          Replace
        </button>
        <button type="button" className="friend-copy-cancel" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="friend-copy">
      <button
        type="button"
        className="friend-copy-go"
        disabled={busy}
        onClick={() => (myCourseCount ? setConfirming(true) : run())}
      >
        <IoCopyOutline size={16} />
        {busy ? "Copying…" : `Use ${friend.name}'s schedule`}
      </button>
      <span>Adds their {count} classes, locked to their sections.</span>
    </div>
  );
};

const Compare: React.FC<{ friend: SharedSchedule; mine: SharedSchedule | null; wide: boolean }> = ({
  friend,
  mine,
  wide,
}) => {
  const result = useMemo(() => {
    if (!mine) return null;
    const myBusy = busyByDay(mine.classes);
    const theirBusy = busyByDay(friend.classes);
    return {
      courses: sharedCourses(mine.classes, friend.classes),
      myClasses: classBlocksByDay(mine.classes),
      theirClasses: classBlocksByDay(friend.classes),
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
      {wide ? (
        <>
          <div className="friend-legend">
            <span className="me">You</span>
            <span className="them">{friend.name}</span>
            <span className="free">Both free</span>
          </div>
          <FriendWeek
            name={friend.name}
            mine={result.myClasses}
            theirs={result.theirClasses}
            free={result.days.map((d) => d.free)}
          />
        </>
      ) : (
      <>
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
      )}
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
  myCourseCount: number;
  onCopy: (friend: SharedSchedule) => Promise<CopyResult>;
  onClose: () => void;
}> = ({
  combination,
  term,
  year,
  friends,
  comparing,
  setComparing,
  onRemoveFriend,
  myCourseCount,
  onCopy,
  onClose,
}) => {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const wide = useWide();

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

  const sharePanel = (
    <>
      <label className="friend-name">
        <span className="csu-label">Your name</span>
        <input value={name} onChange={(e) => saveName(e.target.value)} placeholder="So friends know it's you" maxLength={40} />
      </label>
      {mine ? (
        <>
          <div className="friend-share-row">
            <button type="button" className="friend-share" onClick={share}>
              {copied ? <IoCheckmark size={18} /> : canShare ? <IoShareOutline size={18} /> : <IoLinkOutline size={18} />}
              {copied ? "Link copied" : canShare ? "Share my schedule" : "Copy my schedule link"}
            </button>
            <button
              type="button"
              className={`friend-qr-toggle${showQr ? " on" : ""}`}
              onClick={() => setShowQr((v) => !v)}
              aria-label={showQr ? "Hide QR code" : "Show QR code"}
              aria-pressed={showQr}
              title="QR code"
            >
              <IoQrCodeOutline size={20} />
            </button>
          </div>
          {showQr && (
            <div className="friend-qr">
              <QRCodeSVG value={link} size={232} level="L" marginSize={2} />
              <span>Have a friend scan this with their phone camera.</span>
            </div>
          )}
        </>
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
            <li key={`${f.name}-${f.term}-${f.year}`} className={f === comparing ? "active" : ""}>
              <button type="button" className="friend-open" onClick={() => setComparing(f)}>
                <strong>{f.name}</strong>
                <span>
                  {termLabel(f)} · {f.classes.filter((c) => c.code).length} classes
                </span>
              </button>
              <button
                type="button"
                className="cart-close"
                onClick={() => {
                  if (f === comparing) setComparing(null);
                  onRemoveFriend(f);
                }}
                aria-label={`Remove ${f.name}`}
              >
                <IoTrashOutline size={17} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="friend-empty">Open a friend's link and they'll show up here.</p>
      )}
    </>
  );

  if (wide) {
    return (
      <div className="cart-backdrop" onClick={onClose}>
        <div className="cart-sheet friend-sheet wide" role="dialog" aria-label="Friends" onClick={(e) => e.stopPropagation()}>
          <div className="cart-head">
            <div>
              <h2>{comparing ? `You & ${comparing.name}` : "Friends"}</h2>
              <p>
                {comparing
                  ? `Their ${termLabel(comparing)} schedule next to the one you're viewing.`
                  : "Send your schedule to a friend. When they send theirs back, see your classes together and when you're both free."}
              </p>
            </div>
            <button type="button" className="cart-close" onClick={onClose} aria-label="Close">
              <IoClose size={20} />
            </button>
          </div>
          <div className="friend-split">
            <aside className="friend-body">{sharePanel}</aside>
            <section className="friend-body friend-main">
              {comparing ? (
                <>
                  <CopyFriend key={comparing.name + comparing.term} friend={comparing} term={term} year={year} myCourseCount={myCourseCount} onCopy={onCopy} />
                  <Compare friend={comparing} mine={mine} wide />
                </>
              ) : (
                <div className="friend-placeholder">
                  <strong>{friends.length ? "Pick a friend to compare" : "No friends yet"}</strong>
                  <span>
                    {friends.length
                      ? "You'll see the classes you share and a week view of when you're both free."
                      : "Share your link. When a friend opens it and sends theirs back, they show up on the left."}
                  </span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="friend-body">{comparing ? (
            <>
              <CopyFriend key={comparing.name + comparing.term} friend={comparing} term={term} year={year} myCourseCount={myCourseCount} onCopy={onCopy} />
              <Compare friend={comparing} mine={mine} wide={false} />
            </>
          ) : (
            sharePanel
          )}</div>
      </div>
    </div>
  );
};

export default FriendsSheet;
