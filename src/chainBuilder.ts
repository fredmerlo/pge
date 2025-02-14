import { IncomingMessage } from "http";
import { Writable } from "node:stream";
import * as Chain from 'stream-chain';
import { Parser } from 'stream-json';
import Pick from 'stream-json/filters/Pick';
import StreamArray from 'stream-json/streamers/StreamArray';
import { CsvTransform } from "./csvTransform";
import { pipeline } from "node:stream/promises";

export class ChainBuilder {
  inputStream: IncomingMessage;
  outputStream: Writable;
  basePipe: Array<any>;

  constructor(inputStream: IncomingMessage, outputStream: Writable) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
    this.basePipe = [
      this.inputStream,
      new Parser({ streamValues: false }),
      new Pick({ streamValues: false, filter: 'data.stations' }),
      new StreamArray(),
    ];
  }

  createCSVTransform(stations: {capacity: number, count: number}): CsvTransform {
    return new CsvTransform({
      readableObjectMode: false,
      writableObjectMode: true,
      encoding: 'utf8',
      station: stations,      
    });
  }

  public getChain(stations: {capacity: number, count: number}): any {
    const csv = this.createCSVTransform(stations);

    this.basePipe.push(csv);
    this.basePipe.push(this.outputStream);

    return {chain: Chain.chain(this.basePipe), csv: csv};
  }

  public async getPipeline(stations: {capacity: number, count: number}): Promise<any> {
    const csv = this.createCSVTransform(stations);

    this.basePipe.push(csv);
    this.basePipe.push(this.outputStream);

    return await pipeline(this.basePipe);
  }

  public getPipelineRaw(stations: {capacity: number, count: number}): any[] {
    const csv = this.createCSVTransform(stations);

    this.basePipe.push(csv);
    this.basePipe.push(this.outputStream);

    return this.basePipe;
  }
}
