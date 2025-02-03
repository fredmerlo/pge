import { CsvData } from '../src/csvData';
import { json2csv } from 'json-2-csv';
import { promises as fs } from 'fs';

jest.mock('json-2-csv');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn()
  }
}));

describe('CsvData', () => {
  let csvData: CsvData;

  beforeEach(() => {
    csvData = new CsvData();
  });

  it('should convert JSON to CSV and write to a file', async () => {
    const mockData = [{ key: 'value' }];
    const mockCsv = 'key,value\nvalue';
    (json2csv as jest.Mock).mockResolvedValue(mockCsv);
    
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    const result = await csvData.convert(mockData);

    expect(json2csv).toHaveBeenCalledWith(mockData);
    expect(fs.writeFile).toHaveBeenCalledWith('/processed/data.csv', mockCsv);
    expect(result).toBe(mockCsv);
  });

  it('should handle errors during JSON to CSV conversion', async () => {
    const mockData = { key: 'value' };
    const mockError = new Error('mockError');
    (json2csv as jest.Mock).mockRejectedValue(mockError);

    await expect(csvData.convert(mockData)).rejects.toThrow('mockError');
  });

  it('should handle errors during file writing', async () => {
    const mockData = [{ key: 'value' }];
    const mockCsv = 'key,value\nvalue';
    const mockError = new Error('mockError');

    (fs.writeFile as jest.Mock).mockRejectedValue(mockError);

    await expect(csvData.convert(mockData)).rejects.toThrow('mockError');
  });
});