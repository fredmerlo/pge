import { Transform, TransformOptions } from 'node:stream';

export class ArrayTransform extends Transform {
  constructor(opts?: TransformOptions | undefined) {
    super(opts);
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void): void {
    if (chunk.name === 'stringValue' && chunk.value && chunk.value.length) {
      const encodedChunk = chunk.value.toString(encoding);
      this.push(encodedChunk);
    }

    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.push(null);
    this.emit('end');
    callback();
  }
}
