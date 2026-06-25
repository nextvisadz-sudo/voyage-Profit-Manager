import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

async function inspectPdf(filename) {
  const filePath = path.join("C:/Users/DELL/Downloads", filename);
  console.log(`\n=================== INSPECTING: ${filename} ===================`);
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist!");
    return;
  }
  const buffer = fs.readFileSync(filePath);
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    console.log("Raw Extracted Text:\n", text);
    
    // Write text to a log file
    const logPath = `./extracted-${filename.replace(/\s+/g, "_")}.txt`;
    fs.writeFileSync(logPath, text);
    console.log(`\nSaved text to ${logPath}`);
  } catch (err) {
    console.error("Error parsing PDF:", err);
  }
}

async function run() {
  await inspectPdf("Racapitulatif de réservation numéro_183442.pdf");
  await inspectPdf("Racapitulatif de réservation numéro_183356.pdf");
}

run();
