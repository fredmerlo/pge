import * as wreck from '@hapi/wreck';

export interface ICachedData {
  data: string;
  lastModified?: string;
  etag?: string;
}

export class HttpClient {
  private localData: ICachedData = {
    data: '',
    lastModified: undefined,
    etag: undefined,
  };

  async get(url: string) {

    const { lastModified, etag } = await this.head(url);

    if(lastModified !== this.localData.lastModified || etag !== this.localData.etag) {
      console.log(`Fetching data from ${url}`);
      const {res, payload } = await wreck.get<string>(url);
      console.log(`Received data ${payload.length} bytes from ${url}`);
      return payload;
    }

    console.log('Data not modified');
    return this.localData.data;
  }

  async head(url: string) {
    const head = await wreck.request('head', url);
    const headers = head.headersDistinct;
    const lastModified = headers['last-modified'] ? (headers['last-modified'])[0] : undefined;
    const etag = headers.etag ? headers.etag[0] : undefined;

    console.log(`Last-Modified: ${lastModified}`);
    console.log(`ETag: ${etag}`);

    return { lastModified, etag };
  }
}
