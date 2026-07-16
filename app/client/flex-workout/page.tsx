import FlexWorkoutClientPage from './FlexWorkoutClientPage'

export default function FlexWorkoutPage({
  searchParams,
}: {
  searchParams?: { sessionId?: string; sourceWorkoutId?: string }
}) {
  return (
    <FlexWorkoutClientPage
      initialSessionId={searchParams?.sessionId ?? null}
      plannedWorkoutId={searchParams?.sourceWorkoutId ?? null}
    />
  )
}
