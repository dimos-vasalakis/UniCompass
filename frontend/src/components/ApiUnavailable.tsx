export function ApiUnavailable() {
  return (
    <div className="rounded-lg border border-accent bg-accent/15 p-5">
      <p className="font-semibold">We can&apos;t load the area data right now.</p>
      <p className="mt-1 text-sm text-muted">Please try again in a minute.</p>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-3 text-sm">
          Dev: is the backend running (<code>fastapi dev app/main.py</code>), and is <code>DATABASE_URL</code> in{" "}
          <code>backend/.env</code> set to a real, seeded database? Check <code>/api/v1/hubs</code> on the API.
        </p>
      )}
    </div>
  );
}

/** The API answered, but there's no data yet (e.g. the database isn't seeded). */
export function NoAreaData() {
  return (
    <div className="rounded-lg border border-border bg-brand-light p-5">
      <p className="font-semibold">No areas have been added yet.</p>
      <p className="mt-1 text-sm text-muted">Check back soon.</p>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-3 text-sm">
          Dev: the API is up but returned no data. Load it with <code>python -m scripts.seed</code> in{" "}
          <code>backend/</code>.
        </p>
      )}
    </div>
  );
}
