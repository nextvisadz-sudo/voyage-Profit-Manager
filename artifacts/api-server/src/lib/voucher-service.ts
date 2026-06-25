import { PDFParse } from "pdf-parse";
import PDFDocument from "pdfkit";
import { Writable } from "stream";

export interface VoucherData {
  hotelName: string;
  destination: string;
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  children: number;
  guests: string[];
  roomCategory: string;
  boardType: string;
  price: number;
  markedUpPrice?: number;
  reference?: string;
}

export async function parseVoucherPdf(buffer: Buffer): Promise<VoucherData> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  const text = textResult.text;
  return parseVoucherText(text);
}

export function parseVoucherText(text: string): VoucherData {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = text;

  let hotelName = "Hôtel";
  let destination = "Tunis, Tunisie";
  let checkin = "";
  let checkout = "";
  let nights = 0;
  let adults = 2;
  let children = 0;
  let guests: string[] = [];
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

  // 2. Destination / Address (Search sequentially to match the hotel address first, avoiding the agency address)
  const addrLine = lines.find(l => 
    /^(?:Adresse|Address|Lieu|City|Ville|Destination)\b/i.test(l) && 
    !/email|website|site web|phone|tél|agence/i.test(l)
  );
  if (addrLine) {
    destination = addrLine.replace(/^(?:Adresse|Address|Lieu|City|Ville|Destination)\s*:?\s*/i, "").trim();
  } else {
    const addrRegexes = [
      /(?:Adresse|Address|Lieu|City|Ville|Destination)\s*:\s*([^\r\n]+)/i,
      /Adresse\s+([^\r\n]+)/i
    ];
    for (const rx of addrRegexes) {
      const match = fullText.match(rx);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (!/batna/i.test(candidate)) {
          destination = candidate;
          break;
        }
      }
    }
  }

  // 3. Dates & Duration (Robust Extraction)
  const cleanLines = lines.filter(l => !/annulation|no show|prématuré|%|frais|conditions|politique/i.test(l));

  // Find checkin
  const checkinLine = cleanLines.find(l => /arrivée|check-in|checkin|du\b/i.test(l) && !/réservation/i.test(l));
  if (checkinLine) {
    const match = checkinLine.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    if (match) {
      checkin = match[1];
    }
  }
  if (!checkin) {
    const rxCheckin = /(?:Check-in|Check in|Arrivée|Arrival|Date d[’']arrivée|Du|From)\s*[:\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/i;
    const match = fullText.match(rxCheckin);
    if (match) {
      checkin = match[1].trim();
    }
  }

  // Find checkout
  const checkoutLine = cleanLines.find(l => /départ|check-out|checkout|au\b/i.test(l) && !/réservation/i.test(l));
  if (checkoutLine) {
    const match = checkoutLine.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    if (match) {
      checkout = match[1];
    }
  }
  if (!checkout) {
    const rxCheckout = /(?:Check-out|Check out|Départ|Departure|Date de départ|Au|To)\s*[:\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/i;
    const match = fullText.match(rxCheckout);
    if (match) {
      checkout = match[1].trim();
    }
  }

  // Find nights from duration line
  const durationLine = cleanLines.find(l => /durée|nuit/i.test(l));
  if (durationLine) {
    const match = durationLine.match(/(\d+)/);
    if (match) {
      nights = parseInt(match[1]);
    }
  }
  if (!nights) {
    const nightsRegexes = [
      /(?:Nuits|Nights|Durée|Nbr de nuits)\s*:\s*([0-9]+)/i,
      /([0-9]+)\s*(?:Nuits|Nights|nuitée)/i
    ];
    for (const rx of nightsRegexes) {
      const match = fullText.match(rx);
      if (match && match[1]) {
        nights = parseInt(match[1].trim());
        break;
      }
    }
  }

  const parseDateStr = (str: string) => {
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

  // Calculate nights from dates difference if both are valid
  if (cleanCheckin && cleanCheckout) {
    try {
      const d1 = new Date(cleanCheckin);
      const d2 = new Date(cleanCheckout);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
        if (diff > 0) nights = diff;
      }
    } catch(e) {}
  }
  if (!nights) nights = 1;

  // 4. Room Category & Board Type (Keyword matching first, then fallback)
  if (/demi\s*pension/i.test(fullText)) boardType = "Demi pension";
  else if (/pension\s*compl/i.test(fullText)) boardType = "Pension complète";
  else if (/petit\s*d/i.test(fullText) || /breakfast/i.test(fullText)) boardType = "Petit Déjeuner";
  else if (/logement\s*seul|room\s*only/i.test(fullText)) boardType = "Logement seul";
  else if (/logement\s*simple/i.test(fullText)) boardType = "Logement simple";
  else if (/soft\s*all\s*in/i.test(fullText)) boardType = "Soft All Inclusive";
  else if (/all\s*in/i.test(fullText)) boardType = "All Inclusive";
  else {
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

  const totalChambreLine = lines.find(l => /total chambre/i.test(l));
  if (totalChambreLine) {
    const adMatch = totalChambreLine.match(/Adultes\s*:\s*(\d+)/i);
    if (adMatch) adults = parseInt(adMatch[1]);
    const chMatch = totalChambreLine.match(/Enfants\s*:\s*(\d+)/i);
    if (chMatch) children = parseInt(chMatch[1]);
  }

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const guestsIdx = lines.findIndex(l => 
    (/type de chambre/i.test(l) || /nom client/i.test(l) || /voyageur/i.test(l) || /passager/i.test(l) || /nom\s+client/i.test(l) || /client/i.test(l)) && 
    !/email|phone|address|tél|agence/i.test(l)
  );

  if (guestsIdx !== -1) {
    let cursor = guestsIdx + 1;
    // Loop continues without expectedGuestsCount limit to capture ALL passenger name strings in the block
    while (cursor < lines.length) {
      let line = lines[cursor].trim();
      
      if (/total chambre|conditions|tél|email|site web|agence|conditions d’annulation/i.test(line)) {
        break;
      }
      
      line = line.replace(/^\d+[-.\s]*/, "");
      if (roomCategory && roomCategory !== "Chambre Standard") {
        line = line.replace(new RegExp(escapeRegExp(roomCategory), "gi"), "");
      }
      if (boardType && boardType !== "Petit Déjeuner") {
        line = line.replace(new RegExp(escapeRegExp(boardType), "gi"), "");
      }
      
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

  if (guests.length === 0) {
    const linesWithMr = lines.filter(l => /^(mr|mrs|ms|mme|mle)\.?\s+/i.test(l));
    if (linesWithMr.length > 0) {
      guests = linesWithMr.map(l => l.trim());
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

function formatPrice(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function generateVoucherPdf(data: Required<VoucherData>, stream: Writable) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(stream);

  const primaryColor = "#126070"; 
  const lightBg = "#f8fafc";       
  const borderLight = "#e2e8f0";   
  const textDark = "#1e293b";      
  const textMuted = "#64748b";     
  const successColor = "#22c55e";  

  // Header Banner
  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);

  doc.fillColor("#ffffff")
     .font("Helvetica-Bold")
     .fontSize(20)
     .text("Next Visa Travel", 40, 30);
     
  doc.fontSize(10)
     .font("Helvetica")
     .fillColor("rgba(255,255,255,0.7)")
     .text("Agence de voyage officielle", 40, 55);

  const refNum = data.reference;
  const issueDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric"
  });
  
  doc.fillColor("#ffffff")
     .font("Helvetica-Bold")
     .fontSize(10)
     .text("BON DE RÉSERVATION", 350, 25, { align: "right", width: 200 })
     .fontSize(16)
     .text(refNum, 350, 40, { align: "right", width: 200 })
     .fontSize(9)
     .fillColor("rgba(255,255,255,0.7)")
     .text(`Émis le ${issueDate}`, 350, 60, { align: "right", width: 200 });

  // Status Ribbon
  doc.rect(0, 100, doc.page.width, 30).fill(successColor);
  doc.fillColor("#ffffff")
     .font("Helvetica-Bold")
     .fontSize(11)
     .text("Voucher de confirmation", 40, 108);

  // Hotel Info Box
  doc.rect(40, 150, 515, 60).fill("#1e293b");
  doc.fillColor("#ffffff")
     .font("Helvetica-Bold")
     .fontSize(18)
     .text(data.hotelName, 55, 162);
     
  doc.fontSize(10)
     .font("Helvetica")
     .fillColor("rgba(255,255,255,0.8)")
     .text(`Adresse: ${data.destination}`, 55, 185);

  // Stay info
  doc.fillColor(textMuted)
     .font("Helvetica-Bold")
     .fontSize(10)
     .text("DATES DU SÉJOUR", 40, 230);
     
  doc.rect(40, 245, 245, 95).fill(lightBg).stroke(borderLight);
  
  doc.fillColor(textMuted).fontSize(8).text("ARRIVÉE", 55, 255);
  doc.fillColor(textDark).font("Helvetica-Bold").fontSize(11).text(data.checkin, 55, 268);
  doc.fillColor(textMuted).font("Helvetica").fontSize(8).text("A partir de 14h00", 55, 283);
  
  doc.fillColor(textMuted).fontSize(8).text("DÉPART", 180, 255);
  doc.fillColor(textDark).font("Helvetica-Bold").fontSize(11).text(data.checkout, 180, 268);
  doc.fillColor(textMuted).font("Helvetica").fontSize(8).text("Avant 12h00", 180, 283);
  
  doc.rect(55, 305, 215, 1).fill(borderLight);
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(`Durée du séjour : ${data.nights} nuit(s)`, 55, 315, { align: "center", width: 215 });

  // Guests info
  doc.fillColor(textMuted)
     .font("Helvetica-Bold")
     .fontSize(10)
     .text("VOYAGEURS & CHAMBRES", 310, 230);
     
  doc.rect(310, 245, 245, 95).fill(lightBg).stroke(borderLight);
  
  doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Adultes", 325, 260);
  doc.fillColor(textDark).font("Helvetica-Bold").text(String(data.adults), 480, 260, { align: "right", width: 60 });
  doc.rect(325, 275, 215, 1).fill(borderLight);
  
  doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Enfants", 325, 285);
  doc.fillColor(textDark).font("Helvetica-Bold").text(String(data.children), 480, 285, { align: "right", width: 60 });
  doc.rect(325, 300, 215, 1).fill(borderLight);
  
  doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Voyageurs", 325, 310);
  doc.fillColor(textDark).font("Helvetica-Bold").fontSize(8).text(data.guests.join(", "), 400, 310, { align: "right", width: 140 });

  // Selected Formula Banner
  doc.fillColor(textMuted)
     .font("Helvetica-Bold")
     .fontSize(10)
     .text("FORMULE RÉSERVÉE", 40, 360);
     
  doc.rect(40, 375, 515, 70).fill("rgba(18,96,112,0.05)").stroke(primaryColor);
  doc.fillColor(textDark).font("Helvetica-Bold").fontSize(14).text(data.boardType, 55, 390);
  doc.fillColor(textMuted).font("Helvetica").fontSize(10).text(`${data.roomCategory} · ${data.hotelName}`, 55, 410);
  
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(16).text(`${formatPrice(data.markedUpPrice)} DA`, 380, 390, { align: "right", width: 160 });
  doc.fillColor(textMuted).font("Helvetica").fontSize(8).text("Toutes taxes incluses", 380, 412, { align: "right", width: 160 });
  doc.fontSize(8).text(`≈ ${formatPrice(Math.round(data.markedUpPrice / data.nights))} DA / nuit`, 380, 424, { align: "right", width: 160 });

  // Conditions Amber Box
  doc.fillColor("#78350f") 
     .rect(40, 465, 515, 100)
     .fill("#fffbeb") 
     .stroke("#fef3c7"); 
     
  doc.fillColor("#92400e")
     .font("Helvetica-Bold")
     .fontSize(10)
     .text("Conditions importantes", 55, 480);
     
  doc.fillColor("#b45309")
     .font("Helvetica")
     .fontSize(8)
     .text("• Ce bon de réservation doit être présenté à l'hôtel lors du check-in.", 55, 498)
     .text("• Les tarifs indiqués sont en dinars algériens (DA), toutes taxes et commissions incluses.", 55, 510)
     .text("• En cas d'annulation, veuillez contacter votre agence au minimum 48h avant la date d'arrivée.", 55, 522)
     .text("• Des pièces d'identité valides seront demandées pour tous les voyageurs à l'arrivée.", 55, 534)
     .text("• L'heure de check-in est à partir de 14h00. L'heure de check-out est avant 12h00.", 55, 546);

  // Agency Contact section
  doc.rect(40, 585, 515, 1).fill(borderLight);
  
  doc.fillColor(textMuted).font("Helvetica-Bold").fontSize(8).text("TÉLÉPHONE", 40, 600);
  doc.fillColor(textDark).fontSize(9).text("+213675009373", 40, 612);
  
  doc.fillColor(textMuted).font("Helvetica-Bold").fontSize(8).text("EMAIL", 220, 600);
  doc.fillColor(textDark).fontSize(9).text("nextvisadz@gmail.com", 220, 612);
  
  doc.fillColor(textMuted).font("Helvetica-Bold").fontSize(8).text("SITE WEB", 400, 600);
  doc.fillColor(textDark).fontSize(9).text("nextvisabooking.com", 400, 612);

  // Footer Banner
  doc.rect(40, 645, 515, 1).fill(borderLight);
  doc.fillColor(textMuted)
     .font("Helvetica")
     .fontSize(8)
     .text("Next Visa Travel · Agence de voyage agréée · Algérie", 40, 660)
     .text(`Réf. ${refNum} · Émis le ${issueDate}`, 380, 660, { align: "right", width: 175 });

  doc.end();
}
