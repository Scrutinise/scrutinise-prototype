import { describe, it, expect, vi } from 'vitest'
import { BatchBuffer } from '../../src/batch'

type Item = string
type Result = { succeeded: Item[]; failed: { item: Item; error: string }[] }

function makeFlush(results?: Partial<Result>): (items: Item[]) => Promise<Result> {
  return vi.fn((items: Item[]) => Promise.resolve({
    succeeded: results?.succeeded ?? items,
    failed: results?.failed ?? [],
  }))
}

describe('BatchBuffer', () => {
  it('accumulates items without flushing below maxSize', async () => {
    const flush = makeFlush()
    const buf = new BatchBuffer<Item>(3, flush)
    await buf.add('a')
    await buf.add('b')
    expect(buf.size).toBe(2)
    expect(flush).not.toHaveBeenCalled()
  })

  it('flushes exactly when maxSize is reached', async () => {
    const flushed: Item[][] = []
    const flush = vi.fn((items: Item[]) => {
      flushed.push([...items])
      return Promise.resolve({ succeeded: items, failed: [] })
    })
    const buf = new BatchBuffer<Item>(3, flush)
    await buf.add('a')
    await buf.add('b')
    const result = await buf.add('c')
    expect(flush).toHaveBeenCalledOnce()
    expect(flushed[0]).toEqual(['a', 'b', 'c'])
    expect(buf.size).toBe(0)
    expect(result?.succeeded).toEqual(['a', 'b', 'c'])
  })

  it('returns null when add does not trigger flush', async () => {
    const buf = new BatchBuffer<Item>(50, makeFlush())
    const result = await buf.add('x')
    expect(result).toBeNull()
  })

  it('drain flushes remaining items', async () => {
    const flush = makeFlush()
    const buf = new BatchBuffer<Item>(50, flush)
    await buf.add('x')
    await buf.add('y')
    const result = await buf.drain()
    expect(flush).toHaveBeenCalledOnce()
    expect(result?.succeeded).toEqual(['x', 'y'])
    expect(buf.size).toBe(0)
  })

  it('drain on empty buffer returns null without calling flushFn', async () => {
    const flush = vi.fn()
    const buf = new BatchBuffer<Item>(50, flush as any)
    const result = await buf.drain()
    expect(result).toBeNull()
    expect(flush).not.toHaveBeenCalled()
  })

  it('drain clears buffer so second drain is a no-op', async () => {
    const flush = makeFlush()
    const buf = new BatchBuffer<Item>(50, flush)
    await buf.add('x')
    await buf.drain()
    const second = await buf.drain()
    expect(second).toBeNull()
    expect(flush).toHaveBeenCalledOnce()
  })

  it('exposes failed items from flushFn result', async () => {
    const flush = vi.fn((items: Item[]) => Promise.resolve({
      succeeded: [items[0]],
      failed: [{ item: items[1], error: 'network timeout' }],
    }))
    const buf = new BatchBuffer<Item>(2, flush)
    await buf.add('ok')
    const result = await buf.add('bad')
    expect(result?.failed).toHaveLength(1)
    expect(result?.failed[0]).toEqual({ item: 'bad', error: 'network timeout' })
  })

  it('second batch starts fresh after first flush', async () => {
    const flushed: Item[][] = []
    const flush = vi.fn((items: Item[]) => {
      flushed.push([...items])
      return Promise.resolve({ succeeded: items, failed: [] })
    })
    const buf = new BatchBuffer<Item>(2, flush)
    await buf.add('a'); await buf.add('b') // flush 1
    await buf.add('c'); await buf.add('d') // flush 2
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flushed[0]).toEqual(['a', 'b'])
    expect(flushed[1]).toEqual(['c', 'd'])
  })
})
