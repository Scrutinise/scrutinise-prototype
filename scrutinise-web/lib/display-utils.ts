export function stageToLabel(stage: string): string {
  const map: Record<string, string> = {
    STAGE_1: 'Stage 1',
    STAGE_2: 'Stage 2',
    STAGE_3: 'Stage 3',
    STAGE_4: 'Stage 4',
    STAGE_5: 'Stage 5',
    ARCHIVED: 'Archived',
    WITHDRAWN: 'Withdrawn',
  }
  return map[stage] ?? stage
}
