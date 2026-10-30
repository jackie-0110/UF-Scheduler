import { useEffect, useState } from "react";
import { IoCheckmark, IoClose, IoCopyOutline, IoDownloadOutline, IoLogoApple, IoLogoGoogle, IoLogoMicrosoft } from "react-icons/io5";
import { feedLinks, resetFeed } from "./calendarFeed";
import { GOOGLE_CLIENT_ID, GoogleButton, useAccount } from "../../account/account";

export type FeedStatus = "idle" | "syncing" | "synced" | "error";

const CalendarSheet: React.FC<{
  status: FeedStatus;
  classCount: number;
  termName: string;
  onRetry: () => void;
  onDownload: () => void;
  onClose: () => void;
}> = ({ status, classCount, termName, onRetry, onDownload, onClose }) => {
  const { user, session, setFeed } = useAccount();
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const links = user ? feedLinks(user.feed) : null;

  const newLink = async () => {
    if (!session) return;
    if (!window.confirm("Make a new link? Calendars subscribed to the old one stop updating, so you'd add the new one again.")) return;
    setResetting(true);
    try {
      setFeed(await resetFeed(session));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="cart-backdrop" onClick={onClose}>
      <div
        className="cart-sheet feed-sheet"
        role="dialog"
        aria-label="Add to calendar"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-head">
          <div>
            <h2>Add to your calendar</h2>
            <p>
              Subscribe once and your classes stay up to date. Change your schedule here and your
              calendar picks it up on its next refresh (Google can take up to a day).
            </p>
          </div>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        {!links ? (
          <div className="feed-signin">
            {GOOGLE_CLIENT_ID ? (
              <>
                <p>Sign in so your calendar link stays the same on every device.</p>
                <GoogleButton />
              </>
            ) : (
              <p>Calendar sync isn't available yet. You can still download the file below.</p>
            )}
          </div>
        ) : (
          <>
            <p className={`feed-status ${status}`} aria-live="polite">
              {status === "syncing" && "Saving your schedule…"}
              {status === "synced" &&
                `${classCount} ${classCount === 1 ? "class" : "classes"} for ${termName} in your calendar feed.`}
              {status === "error" && (
                <>
                  Couldn't save your schedule.{" "}
                  <button type="button" className="schedule-card-link" onClick={onRetry}>
                    Try again
                  </button>
                </>
              )}
            </p>

            <div className="feed-options">
              <a className="feed-option" href={links.google} target="_blank" rel="noreferrer">
                <IoLogoGoogle size={18} aria-hidden />
                Google Calendar
              </a>
              <a className="feed-option" href={links.webcal}>
                <IoLogoApple size={18} aria-hidden />
                Apple Calendar
              </a>
              <a className="feed-option" href={links.outlook} target="_blank" rel="noreferrer">
                <IoLogoMicrosoft size={18} aria-hidden />
                Outlook
              </a>
            </div>

            <div className="feed-link">
              <span className="csu-label">Or paste this link into any calendar app</span>
              <div className="feed-link-row">
                <input readOnly value={links.https} onFocus={(event) => event.target.select()} aria-label="Calendar link" />
                <button
                  type="button"
                  className={`cart-copy${copied ? " copied" : ""}`}
                  onClick={() => navigator.clipboard?.writeText(links.https).then(() => setCopied(true))}
                >
                  {copied ? <IoCheckmark size={15} /> : <IoCopyOutline size={15} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="feed-note">
                Anyone with this link can see your class times.{" "}
                <button type="button" className="schedule-card-link" onClick={newLink} disabled={resetting}>
                  Make a new link
                </button>
              </p>
            </div>
          </>
        )}

        <div className="feed-foot">
          <button type="button" className="schedule-card-link" onClick={onDownload}>
            <IoDownloadOutline size={14} aria-hidden /> Download a one-time .ics file instead
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSheet;
