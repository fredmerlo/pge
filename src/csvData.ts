
import { json2csv } from "json-2-csv";
import { promises as fs } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export class CsvData {
  async convert(data: any) {
    const FILE_OUTPUT = process.env.FILE_OUTPUT || "LOCAL";
    const csv = await new Promise<string>((resolve, reject) => {
      try {
        resolve(json2csv(data));
      } catch (error) {
        reject(error);
      }
    });

    console.log(`CSV bytes: ${csv.length}`);

    if (FILE_OUTPUT === "LOCAL") {
      await fs.writeFile("/tmp/data.csv", csv);
      await fs.writeFile("/processed/data.csv", csv);
    } else {
      const s3 = new S3Client();

      console.log("PutObject to S3");
      await s3.send(new PutObjectCommand({
        Bucket: FILE_OUTPUT,
        Key: "data.csv",
        Body: csv,
      }));
    }

    return csv;
  }

  async getFile() {
    const csv = await fs.readFile("/tmp/data.csv", "utf8");
    return csv;
  }
}
