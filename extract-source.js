import { PDFParse } from "pdf-parse";
import fs from "fs";

async function run() {
  const filePath = "C:/Users/DELL/Downloads/Documents/voucher-E087E6340A1F4881FB28D5555A386EACB83E603717651136436057.pdf";
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  const text = textResult.text;
  fs.writeFileSync("./source-voucher-text.txt", text);
  console.log("Successfully extracted source text to ./source-voucher-text.txt");
}

run();
