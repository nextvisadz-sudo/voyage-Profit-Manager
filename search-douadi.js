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
      console.log("Matched content around DOUADI:\n");
      const idx = text.toLowerCase().indexOf("douadi");
      const start = Math.max(0, idx - 300);
      const end = Math.min(text.length, idx + 1000);
      console.log(text.slice(start, end));
      
      // Save full text to inspect
      fs.writeFileSync("./found-voucher-text.txt", text);
      console.log("\nFull text saved to ./found-voucher-text.txt");
    }
  } catch (err) {
    // ignore
  }
}

async function scan(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    let stat;
    try { stat = fs.statSync(fullPath); } catch(e) { continue; }
    if (stat.isDirectory()) {
      await scan(fullPath);
    } else if (file.toLowerCase().endsWith(".pdf")) {
      await searchInPdf(fullPath);
    }
  }
}

async function run() {
  console.log("Scanning clients visa tourstique for DOUADI...");
  await scan("c:/Users/DELL/Desktop/clients visa tourstique");
  console.log("Done.");
}

run();
