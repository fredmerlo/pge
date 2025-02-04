
import { json2csv } from "json-2-csv";
import { promises as fs } from "fs";
import { S3Client, PutObjectCommand, GetObjectCommand  } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const FILE_OUTPUT = process.env.FILE_OUTPUT || "LOCAL";
export class CsvData {
  async convert(data: any) {

    const csv = await new Promise<string>((resolve, reject) => {
      try {
        resolve(json2csv(data));
      } catch (error) {
        reject(error);
      }
    });

    console.log(`CSV bytes: ${csv.length}`);

    if (FILE_OUTPUT === "LOCAL") {
      await fs.writeFile("/processed/data.csv", csv);
    } else {
      const s3 = new S3Client();

      console.log("PutObject to S3");
      await s3.send(new PutObjectCommand({
        Bucket: FILE_OUTPUT,
        Key: "data.csv",
        Body: csv,
      }));

      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: FILE_OUTPUT,
        Key: "data.csv",
      }), { expiresIn: 300 });

      return url;
    }

    return csv;
  }
}