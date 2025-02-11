import { Readable, ReadableOptions } from 'node:stream';

export class MemoryReader extends Readable {
  public offset: number = 0;
  public buffer: Buffer = Buffer.concat([]);
  public contentLength: number = 0;
  public readableLength: number = this.contentLength;
  locked: boolean = false;

  constructor(opts?: ReadableOptions | undefined) {
    super(opts);
  }

  public bodyLengthChecker: (body: any) => any = (body: any) => { return this.contentLength; };

  _read(size: number): void {
    if (this.offset === undefined) {
      this.offset = 0;
    }
    const chunk = this.buffer.subarray(this.offset, this.offset + size);
    this.offset += chunk.length;
    this.push(chunk.length > 0 ? chunk : null);
  }

  _final(callback: (error?: Error | null) => void): void {
    this.push(null);
    this.emit('end');
    callback();
  }
}
