import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

async function searchInPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    if (text.toLowerCase().includes("douadi")) {
      console.log(`\n=================== FOUND MATCH IN PDF: ${filePath} ===================`);
      console.log("Length of text:", text.length);
      console.log("Matched content:\n");
      const idx = text.toLowerCase().indexOf("douadi");
      const start = Math.max(0, idx - 300);
      const end = Math.min(text.length, idx + 1000);
      console.log(text.slice(start, end));
      
      fs.writeFileSync("./found-download-voucher-text-recursive.txt", text);
    }
  } catch (err) {
    // ignore
  }
}

async function scan(dir) {
  let list;
  try { list = fs.readdirSync(dir); } catch(e) { return; }
  for (const file of list) {
    const fullPath = path.join(dir, file);
    let stat;
    try { stat = fs.statSync(fullPath); } catch(e) { continue; }
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        await scan(fullPath);
      }
    } else if (file.toLowerCase().endsWith(".pdf")) {
      await searchInPdf(fullPath);
    }
  }
}

async function run() {
  console.log("Scanning Downloads recursively...");
  await scan("C:/Users/DELL/Downloads");
  console.log("Done.");
}

run();
