import SubmissionCard from "~/components/SubmissionCard";
import type { Submission } from "~/types/submission";

interface Props {
  rootSubmissions: Submission[];
  byParent: Map<string | null, Submission[]>;
}

export default function SubmissionList({ rootSubmissions, byParent }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rootSubmissions.map((sub) => (
        <SubmissionCard
          key={sub.id}
          submission={sub}
          childSubmissions={byParent.get(sub.id) ?? []}
        />
      ))}
    </div>
  );
}
