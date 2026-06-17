import { Link } from "react-router";
import ChallengeCard from "~/components/ChallengeCard";
import { useActiveChallenges } from "~/hooks/useActiveChallenges";

export default function ChallengeFeed() {
  const { challenges, loading, error } = useActiveChallenges();

  return (
    <div className="max-w-screen-xl mx-auto py-8 px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Active Challenges
        </h1>
        <Link
          to="/challenges/new"
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-input hover:opacity-90 transition-opacity"
        >
          + New Challenge
        </Link>
      </div>

      {loading ? (
        <div className="text-text-secondary text-center py-12">
          Loading challenges…
        </div>
      ) : error ? (
        <div className="text-error text-center py-12">{error}</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-12 flex flex-col items-center gap-4">
          <p className="text-text-faint">No active challenges yet.</p>
          <Link
            to="/challenges/new"
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-input hover:opacity-90 transition-opacity"
          >
            + New Challenge
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}
    </div>
  );
}
