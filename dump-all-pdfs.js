import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

async function dumpPdf(filename) {
  const filePath = path.join("C:/Users/DELL/Downloads", filename);
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    const logPath = `./dump-${filename.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    fs.writeFileSync(logPath, text);
    console.log(`Dumped ${filename} (${text.length} chars) to ${logPath}`);
  } catch (err) {
    console.log(`Failed to dump ${filename}:`, err.message);
  }
}

async function run() {
  const files = fs.readdirSync("C:/Users/DELL/Downloads");
  for (const file of files) {
    if (file.toLowerCase().endsWith(".pdf")) {
      await dumpPdf(file);
    }
  }
}

run();
