import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

async function checkPdf(filename) {
  const filePath = path.join("C:/Users/DELL/Downloads", filename);
  if (!fs.existsSync(filePath)) return;
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    if (text.toLowerCase().includes("douadi") || text.toLowerCase().includes("nuitée") || text.toLowerCase().includes("arrivée")) {
      console.log(`\n=================== MATCH FOUND: ${filename} ===================`);
      console.log("Length of text:", text.length);
      console.log("First 1000 characters:\n", text.slice(0, 1000));
      // Write full text to a file so we can view it
      fs.writeFileSync(`./extracted-${filename.replace(/\s+/g, "_")}.txt`, text);
    }
  } catch (err) {
    // console.error(err);
  }
}

async function run() {
  const files = fs.readdirSync("C:/Users/DELL/Downloads");
  for (const file of files) {
    if (file.toLowerCase().endsWith(".pdf")) {
      await checkPdf(file);
    }
  }
}

run();
