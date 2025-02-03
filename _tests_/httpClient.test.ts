import { HttpClient } from '../src/httpClient';
import * as wreck from '@hapi/wreck';

jest.mock('@hapi/wreck');

describe('HttpClient', () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient();
  });

  it('should fetch data from the given URL', async () => {
    const mockPayload = 'mock data';
    (wreck.get as jest.Mock).mockResolvedValue({
      res: {},
      payload: mockPayload
    });

    const url = 'https://example.com/data';
    const result = await httpClient.get(url);

    expect(wreck.get).toHaveBeenCalledWith(url);
    expect(result).toBe(mockPayload);
  });

  it('should log the correct messages', async () => {
    const mockPayload = 'mock data';
    (wreck.get as jest.Mock).mockResolvedValue({
      res: {},
      payload: mockPayload
    });

    const url = 'https://example.com/data';
    console.log = jest.fn();

    await httpClient.get(url);

    expect(console.log).toHaveBeenCalledWith(`Fetching data from ${url}`);
    expect(console.log).toHaveBeenCalledWith(`Received data ${mockPayload.length} bytes from ${url}`);
  });
});