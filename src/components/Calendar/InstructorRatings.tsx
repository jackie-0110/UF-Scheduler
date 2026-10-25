import { Instructor, websiteURL } from "../CourseUI/CourseTypes";

const ratingTone = (rating: number) =>
  rating <= 2 ? "low" : rating < 4 ? "mid" : "high";

// Low difficulty is good, so it uses the reverse scale
const difficultyTone = (difficulty: number) =>
  difficulty <= 2 ? "high" : difficulty < 4 ? "mid" : "low";

const InstructorRatings: React.FC<{ instructors?: Instructor[] }> = ({
  instructors,
}) => {
  const named = (instructors ?? []).filter((i) => i?.name?.trim());
  if (!named.length) return null;
  return (
    <ul className="instructor-ratings">
      {named.map((instructor) => (
        <li key={`${instructor.name}-${instructor.professorID}`}>
          <span>{instructor.name}</span>
          {instructor.avgRating ? (
            <a
              href={`${websiteURL}${instructor.professorID}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Rating on RateMyProfessors"
            >
              <b className={ratingTone(instructor.avgRating)}>
                {instructor.avgRating.toFixed(1)}
              </b>{" "}
              rating
              {instructor.avgDifficulty ? (
                <>
                  {" · "}
                  <b className={difficultyTone(instructor.avgDifficulty)}>
                    {instructor.avgDifficulty.toFixed(1)}
                  </b>{" "}
                  difficulty
                </>
              ) : null}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

export default InstructorRatings;
