/**
 * Local mock API server for development.
 * Runs with: node mock-api-server.mjs
 * No database or environment variables required.
 */

import http from "http";
import { createRequire } from "module";
import PDFDocument from "pdfkit";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");


const PORT = 5000;

// --- Mock data ---

const DESTINATIONS = [
  { id: 8,  city: "Tunis",    country: "Tunisie",  label: "Tunis, Tunisie" },
  { id: 12, city: "Sousse",   country: "Tunisie",  label: "Sousse, Tunisie" },
  { id: 13, city: "Djerba",   country: "Tunisie",  label: "Djerba, Tunisie" },
  { id: 11, city: "Monastir", country: "Tunisie",  label: "Monastir, Tunisie" },
  { id: 14, city: "Mahdia",   country: "Tunisie",  label: "Mahdia, Tunisie" },
  { id: 20, city: "Tabarka",  country: "Tunisie",  label: "Tabarka, Tunisie" },
  { id: 15, city: "Gammarth", country: "Tunisie",  label: "Gammarth, Tunisie" },
  { id: 7,  city: "Nabeul",   country: "Tunisie",  label: "Nabeul, Tunisie" },
  { id: 90, city: "Hammamet", country: "Tunisie",  label: "Hammamet, Tunisie" },
  { id: 16, city: "Zarzis",   country: "Tunisie",  label: "Zarzis, Tunisie" },
];

// Commission stored in memory (resets on server restart)
let commission = { percent: 10, updatedAt: new Date().toISOString() };

// Search stats stored in memory
let stats = { totalSearches: 42, totalHotelsServed: 378, lastSearchAt: new Date().toISOString() };

function applyCommission(amount, percent) {
  return Math.round(amount * (1 + percent / 100));
}

function parseH24Hotel(raw, commissionPercent) {
  const rooms = [];
  if (Array.isArray(raw.rooms)) {
    for (const room of raw.rooms) {
      if (Array.isArray(room.rates) && room.rates.length > 0) {
        // Group rates by boardCode or boardName to get option totals for multiple rooms
        const groups = {};
        for (const rate of room.rates) {
          const key = rate.boardCode ? String(rate.boardCode) : (rate.boardName || "Standard");
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(rate);
        }

        for (const key of Object.keys(groups)) {
          const rateGroup = groups[key];
          const firstRate = rateGroup[0];

          let totalOriginalAmount = 0;
          let availabilityFlag = "A";
          let rateTypeFlag = "BOOKABLE";

          for (const rate of rateGroup) {
            totalOriginalAmount += rate.amount ?? room.amount ?? 0;
            if (rate.availability === "R") {
              availabilityFlag = "R";
            }
            if (rate.rateType === "ON_REQUEST") {
              rateTypeFlag = "ON_REQUEST";
            }
          }

          const isOnRequest =
            availabilityFlag === "R" ||
            rateTypeFlag === "ON_REQUEST" ||
            firstRate.rateType?.toLowerCase().includes("request") ||
            firstRate.boardName?.toLowerCase().includes("demande") ||
            firstRate.boardName?.toLowerCase().includes("request") ||
            room.name?.toLowerCase().includes("demande") ||
            room.name?.toLowerCase().includes("request");
          const resolvedRateType = isOnRequest ? "ON_REQUEST" : "BOOKABLE";

          rooms.push({
            roomName: room.name ?? "Chambre Standard",
            boardName: firstRate.boardName ?? "Standard",
            originalAmount: totalOriginalAmount,
            amount: applyCommission(totalOriginalAmount, commissionPercent),
            rateType: resolvedRateType,
          });
        }
      } else if (typeof room.amount === "number") {
        const isOnRequest =
          room.name?.toLowerCase().includes("demande") ||
          room.name?.toLowerCase().includes("request");
        const resolvedRateType = isOnRequest ? "ON_REQUEST" : "BOOKABLE";

        rooms.push({
          roomName: room.name ?? "Chambre Standard",
          boardName: room.name ?? "Chambre Standard",
          originalAmount: room.amount,
          amount: applyCommission(room.amount, commissionPercent),
          rateType: resolvedRateType,
        });
      }
    }
  }

  let originalPrice = raw.minRate ?? 0;
  let price = applyCommission(originalPrice, commissionPercent);

  if (rooms.length > 0) {
    const roomOriginalAmounts = rooms.map((r) => r.originalAmount);
    const roomAmounts = rooms.map((r) => r.amount);
    originalPrice = Math.min(...roomOriginalAmounts);
    price = Math.min(...roomAmounts);
  }

  const allPhotos = Array.isArray(raw.photos) ? raw.photos.filter(Boolean) : [];
  const image = allPhotos[0] ?? "";

  const amenities = [];
  if (Array.isArray(raw.facilities) && raw.facilities.length > 0) {
    raw.facilities.slice(0, 8).forEach((f) => amenities.push(f.name));
  } else if (Array.isArray(raw.themes) && raw.themes.length > 0) {
    raw.themes.slice(0, 5).forEach((t) => amenities.push(t.name));
  }

  return {
    id: String(raw.hotelId ?? Math.random().toString(36).slice(2)),
    name: raw.name ?? "Hôtel",
    destination: raw.city ?? "",
    address: raw.address ?? "",
    stars: raw.rating ?? 0,
    image,
    photos: allPhotos,
    description: raw.marketingText ?? "",
    originalPrice,
    price,
    currency: raw.currency ?? "DZD",
    rating: raw.review?.rating != null ? Number(raw.review.rating) / 20 : undefined,
    reviewCount: raw.review?.count != null ? Number(raw.review.count) : undefined,
    amenities,
    roomType: rooms[0]?.boardName ?? "Chambre Standard",
    mealPlan: rooms[0]?.boardName ?? "",
    nights: undefined,
    rooms: rooms,
    lat: raw.lat,
    long: raw.long,
    isStopSales: !rooms || rooms.length === 0 || raw.minRate === 0,
    restrictions: raw.themes?.filter(t => t.name.toLowerCase().includes("celib") || t.name.toLowerCase().includes("couple")).map(t => t.name) ?? [],
    marketingBadges: raw.themes?.slice(0, 2).map(t => t.name) ?? [],
  };
}

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

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

function formatPrice(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function generateVoucherPdf(data, stream) {
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function sendJson(req, res, data, status = 200) {
  const origin = req.headers.origin || "*";
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
  res.end(json);
}

// --- Auth & Booking Mock Core ---
const JWT_SECRET = "next-visa-secret-key-12345";

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}

function verifyJwt(token) {
  try {
    const [header, data, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${data}`).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  const salt = "mocksalt12345678";
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return hash === testHash;
  } catch (e) {
    return false;
  }
}

function getCookie(req, name) {
  const rc = req.headers.cookie;
  if (!rc) return null;
  const list = {};
  rc.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift().trim()] = decodeURIComponent(parts.join("="));
  });
  return list[name];
}

function getUserFromReq(req) {
  const token = getCookie(req, "token") || req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  return verifyJwt(token);
}

const mockUsers = [
  { id: 1, username: "admin", passwordHash: hashPassword("admin123"), role: "admin" },
  { id: 2, username: "agent", passwordHash: hashPassword("agent123"), role: "agent" }
];

const mockBookings = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  const origin = req.headers.origin || "*";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }

  console.log(`[mock-api] ${method} ${pathname}`);

  const user = getUserFromReq(req);

  // RBAC Guards on Endpoints
  // Admin-only endpoints
  if (pathname === "/api/commission/stats" || (pathname === "/api/commission" && method === "PUT") || pathname === "/api/vouchers/upload") {
    if (!user) {
      return sendJson(req, res, { error: "Unauthorized", message: "Authentification requise." }, 401);
    }
    if (user.role !== "admin") {
      return sendJson(req, res, { error: "Forbidden", message: "Accès refusé. Privilèges insuffisants." }, 403);
    }
  }

  // Any authenticated user endpoints
  if (pathname === "/api/hotels/search" || (pathname === "/api/commission" && method === "GET") || pathname === "/api/vouchers" || pathname === "/api/bookings") {
    if (!user) {
      return sendJson(req, res, { error: "Unauthorized", message: "Authentification requise." }, 401);
    }
  }

  // GET /api/destinations
  if (method === "GET" && pathname === "/api/destinations") {
    return sendJson(req, res, DESTINATIONS);
  }

  // GET /api/commission
  if (method === "GET" && pathname === "/api/commission") {
    return sendJson(req, res, commission);
  }

  // PUT /api/commission
  if (method === "PUT" && pathname === "/api/commission") {
    const body = await parseBody(req);
    if (typeof body.percent !== "number" || body.percent < 0 || body.percent > 100) {
      return sendJson(req, res, { error: "Invalid percent" }, 400);
    }
    commission = { percent: body.percent, updatedAt: new Date().toISOString() };
    return sendJson(req, res, commission);
  }

  // GET /api/commission/stats
  if (method === "GET" && pathname === "/api/commission/stats") {
    return sendJson(req, res, {
      totalSearches: stats.totalSearches,
      totalHotelsServed: stats.totalHotelsServed,
      currentPercent: commission.percent,
      lastSearchAt: stats.lastSearchAt,
    });
  }

  // GET /api/hotels/search
  if (method === "GET" && pathname === "/api/hotels/search") {
    const destinationId = url.searchParams.get("destinationId");
    const destination = url.searchParams.get("destination") || "Tunis";
    const checkin = url.searchParams.get("checkin");
    const checkout = url.searchParams.get("checkout");
    const adults = parseInt(url.searchParams.get("adults") || "2");
    const rooms = parseInt(url.searchParams.get("rooms") || "1");
    const children = parseInt(url.searchParams.get("children") || "0");
    const infants = parseInt(url.searchParams.get("infants") || "0");
    const childAges = url.searchParams.get("childAges") || "";

    let resolvedId = destinationId ? parseInt(destinationId) : null;
    let resolvedCity = destination;

    if (!resolvedId && destination) {
      const match = DESTINATIONS.find(
        (d) => d.city.toLowerCase() === destination.toLowerCase() ||
               d.label.toLowerCase().includes(destination.toLowerCase())
      );
      if (match) {
        resolvedId = match.id;
        resolvedCity = match.city;
      }
    } else if (resolvedId) {
      const match = DESTINATIONS.find((d) => d.id === resolvedId);
      if (match) resolvedCity = match.city;
    }

    let hotels = [];
    if (resolvedId) {
      try {
        const paxParams = new URLSearchParams();
        paxParams.set("rooms", String(rooms));

        const ages = childAges ? childAges.split(",").map(Number).filter((n) => !isNaN(n)) : [];

        const adultsPerRoom = Math.floor(adults / rooms);
        const extraAdults = adults % rooms;

        const childrenPerRoom = Math.floor(children / rooms);
        const extraChildren = children % rooms;

        const infantsPerRoom = Math.floor(infants / rooms);
        const extraInfants = infants % rooms;

        let ageIdx = 0;

        for (let i = 1; i <= rooms; i++) {
          const roomAdults = adultsPerRoom + (i <= extraAdults ? 1 : 0);
          const roomChildren = childrenPerRoom + (i <= extraChildren ? 1 : 0);
          const roomInfants = infantsPerRoom + (i <= extraInfants ? 1 : 0);

          paxParams.set(`adults${i}`, String(roomAdults));
          paxParams.set(`children${i}`, String(roomChildren));
          paxParams.set(`infant${i}`, String(roomInfants));

          for (let j = 1; j <= roomChildren; j++) {
            const age = ages[ageIdx] !== undefined ? ages[ageIdx] : 6;
            paxParams.set(`age${i}_${j}`, String(age));
            ageIdx++;
          }
        }
        paxParams.set("destinationId", String(resolvedId));
        
        if (checkin) {
          const [y, m, d] = checkin.split("-");
          paxParams.set("arrDate", `${d}/${m}/${y}`);
        }
        if (checkout) {
          const [y, m, d] = checkout.split("-");
          paxParams.set("depDate", `${d}/${m}/${y}`);
        }

        const fetchUrl = `https://www.h24voyages.com/fr/hotels/api/Search/?${paxParams.toString()}`;
        console.log(`[mock-api] Fetching H24: ${fetchUrl}`);
        
        const response = await fetch(fetchUrl, {
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://www.h24voyages.com/fr/hotels/recherche",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.hotels)) {
            hotels = data.hotels.map((h) => parseH24Hotel(h, commission.percent));
          }
        } else {
          console.warn(`[mock-api] H24Voyages response not OK: ${response.status}`);
        }
      } catch (err) {
        console.error(`[mock-api] H24Voyages fetch failed:`, err);
      }
    }

    stats.totalSearches += 1;
    stats.totalHotelsServed += hotels.length;
    stats.lastSearchAt = new Date().toISOString();

    return sendJson(req, res, {
      hotels,
      total: hotels.length,
      page: 1,
      limit: hotels.length,
      commissionPercent: commission.percent,
      destination: resolvedCity || destination,
      checkin: checkin || undefined,
      checkout: checkout || undefined,
    });
  }

  // POST /api/auth/login
  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const { username, password } = body;
    if (!username || !password) {
      return sendJson(req, res, { error: "Missing fields", message: "Nom d'utilisateur et mot de passe requis." }, 400);
    }
    const found = mockUsers.find(u => u.username === username);
    if (!found || !verifyPassword(password, found.passwordHash)) {
      return sendJson(req, res, { error: "Invalid credentials", message: "Identifiants incorrects." }, 401);
    }
    const sessionUser = { id: found.id, username: found.username, role: found.role };
    const token = signJwt(sessionUser);
    
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    return res.end(JSON.stringify({ user: sessionUser }));
  }

  // POST /api/auth/logout
  if (method === "POST" && pathname === "/api/auth/logout") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    return res.end(JSON.stringify({ success: true, message: "Déconnexion réussie." }));
  }

  // GET /api/auth/me
  if (method === "GET" && pathname === "/api/auth/me") {
    if (!user) {
      return sendJson(req, res, { error: "Unauthorized", message: "Non authentifié." }, 401);
    }
    return sendJson(req, res, { user });
  }

  // POST /api/bookings
  if (method === "POST" && pathname === "/api/bookings") {
    const bookingData = await parseBody(req);
    const randHex = Math.floor(100000 + Math.random() * 900000);
    const reference = `NVT-${randHex}`;

    const newVoucher = {
      reference,
      hotelName: bookingData.hotelName || "Hôtel",
      destination: bookingData.destination || "Tunis, Tunisie",
      checkin: bookingData.checkin || "2026-07-01",
      checkout: bookingData.checkout || "2026-07-05",
      nights: Number(bookingData.nights) || 1,
      adults: Number(bookingData.adults) || 2,
      children: Number(bookingData.children) || 0,
      guests: Array.isArray(bookingData.guests) ? bookingData.guests : [bookingData.guests || "M. Client Principal"],
      roomCategory: bookingData.roomCategory || "Chambre Standard",
      boardType: bookingData.boardType || "Petit Déjeuner",
      price: Number(bookingData.price) || 30000,
      markedUpPrice: Number(bookingData.markedUpPrice) || 33000,
      agentId: user.role === "agent" ? user.id : null,
      agentUsername: user.username,
    };

    mockBookings.push(newVoucher);
    console.log(`[mock-api] Created booking ${reference} for agent ${user.username}`);
    return sendJson(req, res, { success: true, booking: newVoucher }, 201);
  }

  // GET /api/vouchers
  if (method === "GET" && pathname === "/api/vouchers") {
    const list = user.role === "admin" 
      ? mockBookings 
      : mockBookings.filter(b => b.agentId === user.id || b.agentUsername === user.username);
    return sendJson(req, res, { vouchers: list });
  }

  // GET /api/vouchers/download/:reference
  if (method === "GET" && pathname.startsWith("/api/vouchers/download/")) {
    const ref = pathname.split("/").pop();
    const voucher = mockBookings.find(b => b.reference === ref);
    if (!voucher) {
      return sendJson(req, res, { error: "Voucher not found", message: `Le bon ${ref} n'existe pas.` }, 404);
    }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voucher-${ref}.pdf"`,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });

    const payload = {
      hotelName: voucher.hotelName,
      destination: voucher.destination,
      checkin: voucher.checkin,
      checkout: voucher.checkout,
      nights: voucher.nights,
      adults: voucher.adults,
      children: voucher.children,
      guests: voucher.guests,
      roomCategory: voucher.roomCategory,
      boardType: voucher.boardType,
      price: voucher.price,
      markedUpPrice: voucher.markedUpPrice,
      reference: voucher.reference,
    };

    return generateVoucherPdf(payload, res);
  }

  // POST /api/vouchers/upload
  if (method === "POST" && pathname === "/api/vouchers/upload") {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer || buffer.length === 0) {
          return sendJson(req, res, { error: "No file buffer provided" }, 400);
        }

        const parser = new pdf.PDFParse({ data: new Uint8Array(buffer) });
        const textResult = await parser.getText();
        const text = textResult.text;

        const extracted = parseVoucherText(text);

        const commissionPercent = commission.percent;
        const basePrice = extracted.price;
        const markedUpPrice = Math.round(basePrice * (1 + commissionPercent / 100));

        const randHex = Math.floor(100000 + Math.random() * 900000);
        const reference = `NVT-${randHex}`;

        const voucherPayload = {
          ...extracted,
          markedUpPrice,
          reference,
        };

        console.log(`[mock-api] Generated voucher ${reference} for ${voucherPayload.hotelName}. Final price: ${markedUpPrice}`);

        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="voucher-${reference}.pdf"`,
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        });

        generateVoucherPdf(voucherPayload, res);
      } catch (err) {
        console.error("[mock-api] Failed to process voucher PDF:", err);
        sendJson(req, res, { error: "Failed to process voucher PDF", message: err.message }, 500);
      }
    });
    return;
  }

  // GET /api/health
  if (method === "GET" && pathname === "/api/health") {
    return sendJson(req, res, { status: "ok" });
  }

  // 404
  sendJson(req, res, { error: "Not found" }, 404);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Mock API server running at http://localhost:${PORT}`);
  console.log(`   GET  /api/destinations`);
  console.log(`   GET  /api/commission`);
  console.log(`   PUT  /api/commission`);
  console.log(`   GET  /api/commission/stats`);
  console.log(`   GET  /api/hotels/search?destination=Tunis&checkin=...&checkout=...`);
  console.log(`\n   Press Ctrl+C to stop.\n`);
});

