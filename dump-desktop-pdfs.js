import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

async function dumpPdf(filename) {
  const filePath = path.join("c:/Users/DELL/Desktop", filename);
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    const logPath = `./dump-desktop-${filename.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    fs.writeFileSync(logPath, text);
    console.log(`Dumped ${filename} (${text.length} chars) to ${logPath}`);
    if (text.toLowerCase().includes("mezri") || text.toLowerCase().includes("douadi")) {
      console.log(`>>> MATCH FOUND IN ${filename}`);
    }
  } catch (err) {
    console.log(`Failed to dump ${filename}:`, err.message);
  }
}

async function run() {
  const files = fs.readdirSync("c:/Users/DELL/Desktop");
  for (const file of files) {
    if (file.toLowerCase().endsWith(".pdf")) {
      await dumpPdf(file);
    }
  }
}

run();
