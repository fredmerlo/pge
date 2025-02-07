import { CsvData } from '../src/csvData';
import { json2csv } from 'json-2-csv';
import { promises as fs } from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

jest.mock('json-2-csv');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn()
  }
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
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
  it('should upload CSV to S3 when FILE_OUTPUT is set', async () => {
    process.env.FILE_OUTPUT = 'S3_BUCKET_NAME';
    const mockData = [{ key: 'value' }];
    const mockCsv = 'key,value\nvalue';
    const csvPutObjectCommand = new PutObjectCommand({ Bucket: process.env.FILE_OUTPUT, Key: 'data.csv', Body: mockCsv });
    
    const mockPut = jest.fn().mockResolvedValue(csvPutObjectCommand);
    
    (json2csv as jest.Mock).mockResolvedValue(mockCsv);
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockPut
    }));
    (getSignedUrl as jest.Mock).mockResolvedValue('mockSignedUrl');

    const result = await csvData.convert(mockData);

    expect(json2csv).toHaveBeenCalledWith(mockData);
    expect(mockPut).toHaveBeenCalledWith(csvPutObjectCommand);

  });
  it('should get CSV from S3 return a signed url', async () => {
    process.env.FILE_OUTPUT = 'S3_BUCKET_NAME';
    const mockUrl = 'mockurl';
    
    (S3Client as jest.Mock).mockReturnThis();
    const s3 = new S3Client();

    (getSignedUrl as jest.Mock).mockImplementation(() => {
      getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.FILE_OUTPUT, Key: 'data.csv' }), { expiresIn: 300 });
    }).mockResolvedValue(mockUrl);

    const result = await csvData.s3Url();

    expect(getSignedUrl).toHaveBeenCalledWith(s3, new GetObjectCommand({ Bucket: process.env.FILE_OUTPUT, Key: 'data.csv' }), { expiresIn: 300 });
    expect(result).toBe(mockUrl);
  });
});
