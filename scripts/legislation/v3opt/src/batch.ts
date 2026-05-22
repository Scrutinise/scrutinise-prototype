export interface FlushResult<T> {
  succeeded: T[]
  failed: { item: T; error: string }[]
}

export class BatchBuffer<T> {
  private readonly buffer: T[] = []

  constructor(
    private readonly maxSize: number,
    private readonly flushFn: (items: T[]) => Promise<FlushResult<T>>,
  ) {}

  async add(item: T): Promise<FlushResult<T> | null> {
    this.buffer.push(item)
    if (this.buffer.length >= this.maxSize) {
      return this.drain()
    }
    return null
  }

  async drain(): Promise<FlushResult<T> | null> {
    if (this.buffer.length === 0) return null
    const items = this.buffer.splice(0)
    return this.flushFn(items)
  }

  get size(): number {
    return this.buffer.length
  }
}
