import { Readable, ReadableOptions } from 'node:stream';
import { PayloadBuffer } from './payloadBuffer';

export class MemoryReader extends Readable {
  buffer: PayloadBuffer
  public readableLength: number;
  
  locked: boolean = false;

  constructor(buffer: PayloadBuffer, opts?: ReadableOptions | undefined) {
    super(opts);
    this.buffer = buffer;
    this.readableLength = buffer.contentLength;
  }

  public bodyLengthChecker: (body: any) => any = (body: any) => { 
    this.readableLength = this.buffer.contentLength;
    return this.buffer.contentLength; 
  };

  _read(size: number): void {
    const chunk = this.buffer.getChunk(size);
    this.push(chunk.length > 0 ? chunk : null);
  }

  _final(callback: (error?: Error | null) => void): void {
    this.push(null);
    this.emit('end');
    callback();
  }
}
