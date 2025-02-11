import { Writable, WritableOptions } from 'node:stream';
import { MemoryReader } from './memoryReader';

export class MemoryWriter extends Writable {
  locked: boolean = false;
  reader: MemoryReader;

  constructor(reader: MemoryReader, opts?: WritableOptions | undefined) {
    super(opts);
    this.reader = reader;
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (chunk && chunk.length) {
      this.reader.buffer = Buffer.concat([this.reader.buffer, chunk]);
      this.reader.contentLength += chunk.length;
    }

    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.emit('end');
    callback();
  }
}
