import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-amber-50 p-6 dark:bg-amber-950/20">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
          Bourbonomics — Game Rules
        </h1>
        <p className="mb-6 text-amber-800 dark:text-amber-200">
          Full rules are in the repo at <code className="rounded bg-amber-200 px-1 dark:bg-amber-800">docs/GAME_RULES.md</code>.
        </p>
        <p className="mb-4 text-amber-800 dark:text-amber-200">
          Goal: become the Bourbon Baron of America. Manage resources, age and
          sell bourbon, pay rickhouse fees, and navigate market demand. Win by
          Triple Crown (3 Gold Awards), Last Baron Standing, or Baron of
          Kentucky (barrel in all 6 rickhouses).
        </p>
        <Link
          href="/"
          className="text-amber-700 underline dark:text-amber-300"
        >
          Back to lobby
        </Link>
      </div>
    </div>
  );
}
