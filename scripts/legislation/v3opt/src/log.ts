export function log(
  workerId: number | null,
  level: 'info' | 'warn' | 'error',
  msg: string,
  meta?: Record<string, unknown>,
): void {
  const prefix = workerId !== null ? `[W${workerId}]` : '[MAIN]'
  const ts = new Date().toISOString()
  const line = meta
    ? `${ts} ${prefix} ${level.toUpperCase()} ${msg} ${JSON.stringify(meta)}`
    : `${ts} ${prefix} ${level.toUpperCase()} ${msg}`
  if (level === 'error') console.error(line)
  else console.log(line)
}
