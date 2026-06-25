import { Router } from "express";
import { db, vouchersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-service";
import { generateVoucherPdf, VoucherData } from "../lib/voucher-service";

const router = Router();

// In-memory mock bookings list (fallback)
export const mockBookings: any[] = [];

router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const bookingData = req.body;

    // Generate unique reference
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
    };

    if (db) {
      try {
        await db.insert(vouchersTable).values({
          ...newVoucher,
          agentId: user.role === "agent" ? user.id : null,
        });
      } catch (err) {
        console.error("Failed to insert booking into database, saving in-memory:", err);
        mockBookings.push({ ...newVoucher, agentUsername: user.username });
      }
    } else {
      mockBookings.push({ ...newVoucher, agentUsername: user.username });
    }

    console.log(`[bookings] Created booking ${reference} for agent ${user.username}`);
    res.status(201).json({ success: true, booking: newVoucher });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create booking", message: error.message });
  }
});

router.get("/vouchers", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    let list: any[] = [];

    if (db) {
      try {
        if (user.role === "admin") {
          list = await db.select().from(vouchersTable);
        } else {
          list = await db.select().from(vouchersTable).where(eq(vouchersTable.agentId, user.id));
        }
      } catch (err) {
        console.error("Database query failed, reading from in-memory bookings:", err);
      }
    }

    // Merge/use in-memory bookings for fallback or local dev
    const inMemList = user.role === "admin" 
      ? mockBookings 
      : mockBookings.filter(b => b.agentId === user.id || b.agentUsername === user.username);
    
    // Combine lists, making sure references are unique
    const combined = [...list];
    for (const inMem of inMemList) {
      if (!combined.some(c => c.reference === inMem.reference)) {
        combined.push(inMem);
      }
    }

    res.json({ vouchers: combined });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch vouchers", message: error.message });
  }
});

router.get("/vouchers/download/:reference", async (req, res): Promise<void> => {
  try {
    const ref = req.params.reference;
    let voucher: any = null;

    if (db) {
      try {
        const results = await db.select().from(vouchersTable).where(eq(vouchersTable.reference, ref)).limit(1);
        if (results.length > 0) {
          voucher = results[0];
        }
      } catch (err) {
        console.error("Database lookup failed for download:", err);
      }
    }

    if (!voucher) {
      voucher = mockBookings.find(b => b.reference === ref);
    }

    if (!voucher) {
      res.status(404).json({ error: "Voucher not found", message: `Le bon ${ref} n'existe pas.` });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voucher-${ref}.pdf"`,
    });

    const payload = {
      hotelName: voucher.hotelName,
      destination: voucher.destination,
      checkin: voucher.checkin,
      checkout: voucher.checkout,
      nights: voucher.nights,
      adults: voucher.adults,
      children: voucher.children,
      guests: Array.isArray(voucher.guests) ? voucher.guests : JSON.parse(voucher.guests || "[]"),
      roomCategory: voucher.roomCategory,
      boardType: voucher.boardType,
      price: voucher.price,
      markedUpPrice: voucher.markedUpPrice,
      reference: voucher.reference,
    } as Required<VoucherData>;

    generateVoucherPdf(payload, res);
  } catch (error: any) {
    console.error("Voucher download failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Download failed", message: error.message });
    }
  }
});

export default router;
