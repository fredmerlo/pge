import { Writable, WritableOptions } from 'node:stream';
import { PayloadBuffer } from './payloadBuffer';

export class MemoryWriter extends Writable {
  buffer: PayloadBuffer;
  locked: boolean = false;

  constructor(buffer: PayloadBuffer, opts?: WritableOptions | undefined) {
    super(opts);
    this.buffer = buffer;
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (chunk && chunk.length) {
      this.buffer.putChunk(chunk);
    }

    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.emit('end');
    callback();
  }
}
