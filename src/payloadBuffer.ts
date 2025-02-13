
export class PayloadBuffer {
  public offset: number = 0;
  public buffer: Buffer;
  public contentLength: number;

  constructor() {
    this.buffer = Buffer.concat([]);
    this.contentLength = 0;
  }

  public getChunk(size: number): Buffer {
    if (this.offset === undefined) {
      this.offset = 0;
    }
    const chunk = this.buffer.subarray(this.offset, this.offset + size);
    this.offset += chunk.length;
    return chunk;
  }

  public putChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.contentLength += chunk.length;
  }
}
