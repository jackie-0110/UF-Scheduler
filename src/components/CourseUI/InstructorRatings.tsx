import { Instructor, websiteURL } from "./CourseTypes";
import "./InstructorRatings.css";

const ratingTone = (rating: number) =>
  rating <= 2 ? "bad" : rating < 4 ? "ok" : "good";

// Low difficulty is good, so it uses the reverse scale
const difficultyTone = (difficulty: number) =>
  difficulty <= 2 ? "good" : difficulty < 4 ? "ok" : "bad";

// `bare` drops the "Instructor" heading where the context makes it obvious
const InstructorRatings: React.FC<{ instructors?: Instructor[]; bare?: boolean }> = ({
  instructors,
  bare,
}) => {
  const named = (instructors ?? []).filter((i) => i?.name?.trim());
  if (!named.length) return null;
  return (
    <div className={`instructor-ratings${bare ? " bare" : ""}`}>
      {!bare && (
        <span className="csu-label">
          {named.length > 1 ? "Instructors" : "Instructor"}
        </span>
      )}
      <ul>
        {named.map((instructor) => (
          <li key={`${instructor.name}-${instructor.professorID}`}>
            <span className="instructor-name">{instructor.name}</span>
            {instructor.avgRating ? (
              <a
                className="instructor-scores"
                href={`${websiteURL}${instructor.professorID}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open on RateMyProfessors"
              >
                <span className={`score ${ratingTone(instructor.avgRating)}`}>
                  ★ {instructor.avgRating.toFixed(1)}
                </span>
                {instructor.avgDifficulty ? (
                  <span
                    className={`score ${difficultyTone(instructor.avgDifficulty)}`}
                  >
                    Difficulty {instructor.avgDifficulty.toFixed(1)}
                  </span>
                ) : null}
              </a>
            ) : (
              <span className="instructor-scores none">No ratings</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InstructorRatings;
