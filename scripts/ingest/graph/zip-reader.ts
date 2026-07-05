/**
 * zip-reader.ts — minimal streaming ZIP/ZIP64 reader (central directory + per-
 * entry inflate) so the 1.4 GB best-collection-xml.zip can be walked without
 * adm-zip's whole-file Buffer (which fails allocation on this machine under any
 * memory pressure). Pure Node (fs + zlib), no new dependencies, TypeScript per
 * docs/CLAUDE.md §14 (no new PowerShell ingest helpers).
 *
 * Supports what TNA's zips actually use: stored (0) and deflate (8) entries,
 * ZIP64 EOCD (entry count >65,535), ZIP64 extra fields. No encryption, no
 * spanned archives.
 */
import fs from 'fs'
import zlib from 'zlib'

export type ZipEntryMeta = {
  name: string
  compressedSize: number
  uncompressedSize: number
  method: number
  localHeaderOffset: number
}

const EOCD_SIG = 0x06054b50
const EOCD64_LOCATOR_SIG = 0x07064b50
const EOCD64_SIG = 0x06064b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50

function readAt(fd: number, position: number, length: number): Buffer {
  const buf = Buffer.alloc(length)
  let done = 0
  while (done < length) {
    const n = fs.readSync(fd, buf, done, length - done, position + done)
    if (n === 0) throw new Error(`unexpected EOF at ${position + done}`)
    done += n
  }
  return buf
}

export class ZipReader {
  private fd: number
  readonly entries: ZipEntryMeta[]

  constructor(path: string) {
    this.fd = fs.openSync(path, 'r')
    const fileSize = fs.fstatSync(this.fd).size

    // 1. find EOCD in the last 64KB+22
    const tailLen = Math.min(fileSize, 65_557)
    const tail = readAt(this.fd, fileSize - tailLen, tailLen)
    let eocdPos = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) { eocdPos = i; break }
    }
    if (eocdPos < 0) throw new Error('EOCD not found — not a zip?')

    let count: number = tail.readUInt16LE(eocdPos + 10)
    let cenSize: number = tail.readUInt32LE(eocdPos + 12)
    let cenOffset: number = tail.readUInt32LE(eocdPos + 16)

    // 2. ZIP64: sentinel values → locate the ZIP64 EOCD
    if (count === 0xffff || cenSize === 0xffffffff || cenOffset === 0xffffffff) {
      const locAbs = fileSize - tailLen + eocdPos - 20
      const loc = readAt(this.fd, locAbs, 20)
      if (loc.readUInt32LE(0) !== EOCD64_LOCATOR_SIG) throw new Error('ZIP64 EOCD locator not found')
      const eocd64Off = Number(loc.readBigUInt64LE(8))
      const eocd64 = readAt(this.fd, eocd64Off, 56)
      if (eocd64.readUInt32LE(0) !== EOCD64_SIG) throw new Error('ZIP64 EOCD not found')
      count = Number(eocd64.readBigUInt64LE(32))
      cenSize = Number(eocd64.readBigUInt64LE(40))
      cenOffset = Number(eocd64.readBigUInt64LE(48))
    }

    // 3. read the whole central directory (tens of MB, fine) and parse records
    const cen = readAt(this.fd, cenOffset, cenSize)
    this.entries = []
    let p = 0
    for (let i = 0; i < count; i++) {
      if (cen.readUInt32LE(p) !== CEN_SIG) throw new Error(`bad central-directory record at ${p} (entry ${i})`)
      const method = cen.readUInt16LE(p + 10)
      let compressedSize: number = cen.readUInt32LE(p + 20)
      let uncompressedSize: number = cen.readUInt32LE(p + 24)
      const nameLen = cen.readUInt16LE(p + 28)
      const extraLen = cen.readUInt16LE(p + 30)
      const commentLen = cen.readUInt16LE(p + 32)
      let localHeaderOffset: number = cen.readUInt32LE(p + 42)
      const name = cen.subarray(p + 46, p + 46 + nameLen).toString('utf8')

      // ZIP64 extra field (id 0x0001): 8-byte values replace 0xFFFFFFFF ones, in order
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
        let e = p + 46 + nameLen
        const eEnd = e + extraLen
        while (e + 4 <= eEnd) {
          const id = cen.readUInt16LE(e)
          const sz = cen.readUInt16LE(e + 2)
          if (id === 0x0001) {
            let f = e + 4
            if (uncompressedSize === 0xffffffff) { uncompressedSize = Number(cen.readBigUInt64LE(f)); f += 8 }
            if (compressedSize === 0xffffffff) { compressedSize = Number(cen.readBigUInt64LE(f)); f += 8 }
            if (localHeaderOffset === 0xffffffff) { localHeaderOffset = Number(cen.readBigUInt64LE(f)); f += 8 }
            break
          }
          e += 4 + sz
        }
      }
      this.entries.push({ name, compressedSize, uncompressedSize, method, localHeaderOffset })
      p += 46 + nameLen + extraLen + commentLen
    }
  }

  /** Decompressed entry content. Reads only this entry's bytes from disk. */
  read(entry: ZipEntryMeta): Buffer {
    const loc = readAt(this.fd, entry.localHeaderOffset, 30)
    if (loc.readUInt32LE(0) !== LOC_SIG) throw new Error(`bad local header for ${entry.name}`)
    const nameLen = loc.readUInt16LE(26)
    const extraLen = loc.readUInt16LE(28)
    const dataStart = entry.localHeaderOffset + 30 + nameLen + extraLen
    const raw = readAt(this.fd, dataStart, entry.compressedSize)
    if (entry.method === 0) return raw
    if (entry.method === 8) return zlib.inflateRawSync(raw)
    throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`)
  }

  readText(entry: ZipEntryMeta): string {
    return this.read(entry).toString('utf8')
  }

  close() { fs.closeSync(this.fd) }
}
