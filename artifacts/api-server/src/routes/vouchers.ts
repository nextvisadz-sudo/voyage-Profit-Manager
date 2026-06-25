import express, { Router, type IRouter } from "express";
import { db, commissionConfigTable } from "@workspace/db";
import { parseVoucherPdf, generateVoucherPdf, VoucherData } from "../lib/voucher-service";
import { requireRole } from "../lib/auth-service";
import { mockCommission } from "./commission";

const router: IRouter = Router();

// Accept raw binary PDF uploads up to 10MB
router.post(
  "/vouchers/upload",
  requireRole(["admin"]),
  express.raw({ type: "application/pdf", limit: "10mb" }),
  async (req, res): Promise<void> => {
    try {
      const buffer = req.body;

      if (!buffer || buffer.length === 0) {
        res.status(400).json({ error: "Aucun fichier PDF n'a été fourni dans la requête." });
        return;
      }

      req.log.info({ size: buffer.length }, "Processing uploaded voucher PDF");

      // 1. Parse text fields from PDF
      const extracted = await parseVoucherPdf(buffer);

      // 2. Fetch profit markup percent
      let commissionPercent = mockCommission.percent;
      if (db) {
        try {
          const configs = await db.select().from(commissionConfigTable).limit(1);
          if (configs.length > 0) {
            commissionPercent = configs[0].percent;
          }
        } catch (err) {
          console.error("Failed to query commission from database, using mock value:", err);
        }
      }

      // 3. Apply profit markup on top of parsed price
      const basePrice = extracted.price;
      const markedUpPrice = Math.round(basePrice * (1 + commissionPercent / 100));

      // 4. Generate reference reference format NVT-XXXXXX
      const randHex = Math.floor(100000 + Math.random() * 900000);
      const reference = `NVT-${randHex}`;

      const voucherPayload = {
        ...extracted,
        markedUpPrice,
        reference,
      } as Required<VoucherData>;

      req.log.info({ hotel: voucherPayload.hotelName, price: basePrice, final: markedUpPrice }, "Extracted data and applied markup");

      // 5. Generate and return the branded PDF directly
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="voucher-${reference}.pdf"`);

      generateVoucherPdf(voucherPayload, res);
    } catch (error: any) {
      req.log.error({ err: error }, "Failed to process voucher PDF");
      res.status(500).json({
        error: "Erreur lors du traitement du fichier PDF.",
        message: error.message || String(error),
      });
    }
  }
);

export default router;

