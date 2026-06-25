import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

function parseVoucherText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = text;

  let hotelName = "Hôtel";
  let destination = "Tunis, Tunisie";
  let checkin = "";
  let checkout = "";
  let nights = 0;
  let adults = 2;
  let children = 0;
  let guests = [];
  let roomCategory = "Chambre Standard";
  let boardType = "Petit Déjeuner";
  let price = 0;

  // 1. Hotel Name
  const hotelRegexes = [
    /(?:Hôtel|Hotel|Establishment|Nom de l'établissement|Name)\s*:\s*([^\r\n]+)/i,
    /(?:Hôtel|Hotel)\s+([^\r\n]+)/i
  ];
  for (const rx of hotelRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      hotelName = match[1].trim();
      break;
    }
  }
  if (hotelName === "Hôtel") {
    const idx = lines.findIndex(l => /^(Hôtel|Hotel|Establishment)$/i.test(l));
    if (idx !== -1 && lines[idx+1]) {
      hotelName = lines[idx+1];
    } else {
      const line = lines.find(l => /hotel/i.test(l) && !/policy|conditions|voucher/i.test(l));
      if (line) {
        hotelName = line.replace(/hotel\s*:\s*/i, "").trim();
      }
    }
  }

  // 2. Destination / Address
  const addrRegexes = [
    /(?:Adresse|Address|Lieu|City|Ville|Destination)\s*:\s*([^\r\n]+)/i,
    /Adresse\s+([^\r\n]+)/i
  ];
  for (const rx of addrRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      destination = match[1].trim();
      break;
    }
  }
  if (destination === "Tunis, Tunisie") {
    const line = lines.find(l => /adresse|address/i.test(l) && !/email|website/i.test(l));
    if (line) {
      destination = line.replace(/adresse\s*:\s*/i, "").trim();
    }
  }

  // 3. Dates
  // Robust check-in date extraction: search for lines containing checkin/arrivée but NOT cancellation keywords
  checkin = "";
  checkout = "";
  nights = 0;

  const cleanLines = lines.filter(l => !/annulation|no show|prématuré|%|frais|conditions|politique/i.test(l));

  // Find checkin
  const checkinLine = cleanLines.find(l => /arrivée|check-in|checkin|du\b/i.test(l));
  if (checkinLine) {
    const match = checkinLine.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    if (match) {
      checkin = match[1];
    }
  }

  // Fallback for checkin if not found via clean search
  if (!checkin) {
    const checkinRegexes = [
      /(?:Check-in|Check in|Arrivée|Arrival|Date d'arrivée|Du|From)\s*:\s*([0-9\-\.\/\sA-Za-z]+)/i,
      /(?:Check-in|Check in|Arrivée|Arrival|Du|From)\s+([0-9\-\.\/\sA-Za-z]+)/i
    ];
    for (const rx of checkinRegexes) {
      const match = fullText.match(rx);
      if (match && match[1]) {
        if (!/annulation|no show|prématuré|%/i.test(match[0])) {
          checkin = match[1].trim();
          break;
        }
      }
    }
  }

  // Find checkout
  const checkoutLine = cleanLines.find(l => /départ|check-out|checkout|au\b/i.test(l));
  if (checkoutLine) {
    const match = checkoutLine.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    if (match) {
      checkout = match[1];
    }
  }

  // Fallback for checkout
  if (!checkout) {
    const checkoutRegexes = [
      /(?:Check-out|Check out|Départ|Departure|Date de départ|Au|To)\s*:\s*([0-9\-\.\/\sA-Za-z]+)/i,
      /(?:Check-out|Check out|Départ|Departure|Au|To)\s+([0-9\-\.\/\sA-Za-z]+)/i
    ];
    for (const rx of checkoutRegexes) {
      const match = fullText.match(rx);
      if (match && match[1]) {
        if (!/annulation|no show|prématuré|%/i.test(match[0])) {
          checkout = match[1].trim();
          break;
        }
      }
    }
  }

  // Find nights
  const durationLine = cleanLines.find(l => /durée|nuit/i.test(l));
  if (durationLine) {
    const match = durationLine.match(/(\d+)/);
    if (match) {
      nights = parseInt(match[1]);
    }
  }

  // Fallback for nights
  if (!nights) {
    const nightsRegexes = [
      /(?:Nuits|Nights|Durée|Nbr de nuits)\s*:\s*([0-9]+)/i,
      /([0-9]+)\s*(?:Nuits|Nights)/i
    ];
    for (const rx of nightsRegexes) {
      const match = fullText.match(rx);
      if (match && match[1]) {
        nights = parseInt(match[1].trim());
        break;
      }
    }
  }

  const parseDateStr = (str) => {
    if (!str) return null;
    const cleanStr = str.replace(/[A-Za-z\s]+,?\s*/g, " ").trim();
    const slashMatch = cleanStr.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
    if (slashMatch) {
      const [, d, m, y] = slashMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const isoMatch = cleanStr.match(/(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    try {
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    } catch(e) {}
    return str;
  };

  const cleanCheckin = parseDateStr(checkin) || checkin;
  const cleanCheckout = parseDateStr(checkout) || checkout;

  if (!nights && cleanCheckin && cleanCheckout) {
    try {
      const d1 = new Date(cleanCheckin);
      const d2 = new Date(cleanCheckout);
      const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
      if (diff > 0) nights = diff;
    } catch(e) {}
  }
  if (!nights) nights = 1;

  // 4. Room Category & Board Type
  // Search for standard board type keywords first
  if (/demi\s*pension/i.test(fullText)) boardType = "Demi pension";
  else if (/pension\s*compl/i.test(fullText)) boardType = "Pension complète";
  else if (/petit\s*d/i.test(fullText) || /breakfast/i.test(fullText)) boardType = "Petit Déjeuner";
  else if (/logement\s*seul|room\s*only/i.test(fullText)) boardType = "Logement seul";
  else if (/logement\s*simple/i.test(fullText)) boardType = "Logement simple";
  else if (/soft\s*all\s*in/i.test(fullText)) boardType = "Soft All Inclusive";
  else if (/all\s*in/i.test(fullText)) boardType = "All Inclusive";
  else {
    // Fallback regex
    const boardRegexes = [
      /(?:Pension|Board|Meal|Meal Plan|Formule|Régime|Régime de pension)\s*:\s*([^\r\n]+)/i,
      /Pension\s+([^\r\n]+)/i,
      /Formule\s+([^\r\n]+)/i
    ];
    for (const rx of boardRegexes) {
      const match = fullText.match(rx);
      if (match && match[1] && !/total chambre|client|voyageur|%/i.test(match[0])) {
        boardType = match[1].trim();
        break;
      }
    }
  }

  // Search for standard room category keywords first
  if (/chambre\s+standard/i.test(fullText)) roomCategory = "Chambre Standard";
  else if (/chambre\s+double/i.test(fullText)) roomCategory = "Chambre Double";
  else if (/chambre\s+triple/i.test(fullText)) roomCategory = "Chambre Triple";
  else if (/chambre\s+quad/i.test(fullText)) roomCategory = "Chambre Quadruple";
  else if (/chambre\s+fam/i.test(fullText)) roomCategory = "Chambre Familiale";
  else if (/chambre\s+ind/i.test(fullText)) roomCategory = "Chambre Individuelle";
  else if (/suite/i.test(fullText)) roomCategory = "Suite";
  else if (/deluxe/i.test(fullText)) roomCategory = "Chambre Deluxe";
  else if (/super/i.test(fullText)) roomCategory = "Chambre Supérieure";
  else {
    // Fallback regex
    const roomRegexes = [
      /(?:Chambre|Room|Room Type|Category|Type de chambre)\s*:\s*([^\r\n]+)/i,
      /Chambre\s+([^\r\n]+)/i
    ];
    for (const rx of roomRegexes) {
      const match = fullText.match(rx);
      if (match && match[1] && !/total chambre|client|voyageur|%/i.test(match[0])) {
        roomCategory = match[1].trim();
        break;
      }
    }
  }

  // 5. Travelers Details
  const adultRegexes = [
    /(?:Adultes|Adults|Pax|Adt)\s*:\s*([0-9]+)/i,
    /([0-9]+)\s*(?:Adultes|Adults|Adt)/i
  ];
  for (const rx of adultRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      adults = parseInt(match[1].trim());
      break;
    }
  }

  const childRegexes = [
    /(?:Enfants|Children|Child|Chd)\s*:\s*([0-9]+)/i,
    /([0-9]+)\s*(?:Enfants|Children|Chd)/i
  ];
  for (const rx of childRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      children = parseInt(match[1].trim());
      break;
    }
  }

  // Look for total count in lines like: "Total Chambre : 1 (Adultes: 2, Enfants: 0, Bébé: 0)"
  const totalChambreLine = lines.find(l => /total chambre/i.test(l));
  if (totalChambreLine) {
    const adMatch = totalChambreLine.match(/Adultes\s*:\s*(\d+)/i);
    if (adMatch) adults = parseInt(adMatch[1]);
    const chMatch = totalChambreLine.match(/Enfants\s*:\s*(\d+)/i);
    if (chMatch) children = parseInt(chMatch[1]);
  }

  const expectedGuestsCount = adults + children;

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const guestsIdx = lines.findIndex(l => 
    (/type de chambre/i.test(l) || /nom client/i.test(l) || /voyageur/i.test(l) || /passager/i.test(l) || /nom\s+client/i.test(l) || /client/i.test(l)) && 
    !/email|phone|address|tél|agence/i.test(l)
  );

  if (guestsIdx !== -1) {
    let cursor = guestsIdx + 1;
    while (cursor < lines.length && guests.length < expectedGuestsCount) {
      let line = lines[cursor].trim();
      
      // Stop condition
      if (/total chambre|conditions|tél|email|site web|agence|conditions d’annulation/i.test(line)) {
        break;
      }
      
      // Clean line
      // Remove prefix numbers like "1-", "2.", etc.
      line = line.replace(/^\d+[-.\s]*/, "");
      
      // Remove room categories and board types if they exist on the line
      if (roomCategory && roomCategory !== "Chambre Standard") {
        line = line.replace(new RegExp(escapeRegExp(roomCategory), "gi"), "");
      }
      if (boardType && boardType !== "Petit Déjeuner") {
        line = line.replace(new RegExp(escapeRegExp(boardType), "gi"), "");
      }
      
      // Remove standard words
      line = line.replace(/chambre|standard|double|single|triple|quadruple|suite|deluxe|supérieure|vue\s+mer|vue\s+lac/gi, "");
      line = line.replace(/demi pension|pension complète|petit déjeuner|logement seul|logement simple|all inclusive|soft all inclusive|board|arrangement/gi, "");
      line = line.replace(/[-·:•]/g, "");
      
      const cleanName = line.replace(/\s+/g, " ").trim();
      if (cleanName && cleanName.length > 2 && !cleanName.includes("@") && !/booking|page|ref/i.test(cleanName)) {
        guests.push(cleanName);
      }
      cursor++;
    }
  }

  // Fallback to searching lines with Mr/Mrs
  if (guests.length === 0) {
    const linesWithMr = lines.filter(l => /^(mr|mrs|ms|mme|mle)\.?\s+/i.test(l));
    if (linesWithMr.length > 0) {
      guests = linesWithMr.slice(0, expectedGuestsCount).map(l => l.trim());
    }
  }

  if (guests.length === 0) {
    guests.push("M. Client Principal");
  }

  // 6. Price
  const priceRegexes = [
    /(?:Prix|Price|Total|Montant|Tarif|Amount)\s*:\s*([0-9\s]+)\s*(?:DA|DZD|EUR|USD)/i,
    /(?:Prix|Price|Total|Montant|Tarif|Amount)\s*([0-9\s]+)\s*(?:DA|DZD|EUR|USD)/i,
    /([0-9\s\u00A0\.,]+)\s*(?:DA|DZD)/i
  ];
  for (const rx of priceRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      const val = match[1].replace(/[\s\u00A0\.,]/g, "").trim();
      const p = parseInt(val);
      if (p > 0) {
        price = p;
        break;
      }
    }
  }

  if (!price) {
    const line = lines.find(l => /(da|dzd)/i.test(l) && /[0-9]/.test(l));
    if (line) {
      const match = line.match(/([0-9\s\.,]+)/);
      if (match) {
        const val = match[1].replace(/[\s\u00A0\.,]/g, "").trim();
        const p = parseInt(val);
        if (p > 0) price = p;
      }
    }
  }
  if (!price) price = 30000;

  return {
    hotelName,
    destination,
    checkin: cleanCheckin || "2026-07-01",
    checkout: cleanCheckout || "2026-07-05",
    nights,
    adults,
    children,
    guests,
    roomCategory,
    boardType,
    price,
  };
}

async function run() {
  const text = fs.readFileSync("./source-voucher-text.txt", "utf8");
  const extracted = parseVoucherText(text);
  console.log("Extracted Data:", JSON.stringify(extracted, null, 2));
}

run();
