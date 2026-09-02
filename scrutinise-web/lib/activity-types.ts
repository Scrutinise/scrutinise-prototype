/**
 * The offline activities a member can claim points for.
 *
 * ⚠⚠ WHY THIS FILE EXISTS AND WHY IT IS PURE. The list lived in
 * `lib/central-points.ts` (which imports `prisma`) and the form in
 * `LogActivity.tsx` therefore could not import it — so it RESTATED the list,
 * with its own copy of the labels and the point values. Two lists, one rule.
 * Taking an activity off the form and leaving it in the server's list, or the
 * other way round, is a one-line change that looks correct in either file.
 * There is now one list, and both sides import it.
 *
 * ⚠ CENTRAL 25-C §4c — `selfLoggable` IS THE THING THE FORM READS. `GAVE_TRAINING`
 * is still a real activity with a real tariff — a training session that happens
 * through the training exchange still pays the person who gave it — but it may
 * no longer be SELF-LOGGED. The training flow already requires both parties to
 * agree that it happened; self-logging walks straight past that agreement, and
 * **40 of the 64 points in the database exist because of it**, from two claims
 * on Charlie's own accounts with no evidence attached.
 */

export type ActivityTypeDef = {
  key: string
  label: string
  tariffKey: string
  /** The current tariff's starter value, shown on the form. */
  points: number
  /**
   * May a member claim this for themselves, unaided?
   *
   * ⚠ FALSE IS NOT "DISABLED". A false here means the points are earned through
   * a flow that has another party in it — not that the activity has stopped
   * paying. `createActivityClaim` refuses it; `TrainingMatch` still awards it.
   */
  selfLoggable: boolean
}

export const ACTIVITY_TYPES: readonly ActivityTypeDef[] = [
  {
    key: 'CANVASSING_SESSION',
    label: 'Canvassing session',
    tariffKey: 'CLAIM_CANVASSING_SESSION',
    points: 24,
    selfLoggable: true,
  },
  {
    key: 'RAN_EVENT',
    label: 'Organised & ran an event',
    tariffKey: 'CLAIM_RAN_EVENT',
    points: 60,
    selfLoggable: true,
  },
  {
    // ⚠ 25-C §4c — NOT SELF-LOGGABLE. See the file header.
    key: 'GAVE_TRAINING',
    label: 'Gave a training session',
    tariffKey: 'CLAIM_GAVE_TRAINING',
    points: 40,
    selfLoggable: false,
  },
  {
    key: 'COMPLETED_TRAINING',
    label: 'Completed training as a trainee',
    tariffKey: 'CLAIM_COMPLETED_TRAINING',
    points: 20,
    selfLoggable: true,
  },
] as const

export type ActivityTypeKey = (typeof ACTIVITY_TYPES)[number]['key']

/** What the "Log offline activity" form offers. ⚠ DERIVED, never restated. */
export const SELF_LOGGABLE_ACTIVITIES = ACTIVITY_TYPES.filter((a) => a.selfLoggable)
