import * as wreck from '@hapi/wreck';

export class HttpClient {
  async get(url: string) {

    console.log(`Fetching data from ${url}`);

    const {res, payload } = await wreck.get<string>(url);

    console.log(`Received data ${payload.length} bytes from ${url}`);

    return payload;
  }
}
