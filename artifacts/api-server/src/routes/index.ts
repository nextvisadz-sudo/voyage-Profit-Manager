import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hotelsRouter from "./hotels";
import commissionRouter from "./commission";
import destinationsRouter from "./destinations";
import vouchersRouter from "./vouchers";
import authRouter from "./auth";
import bookingsRouter from "./bookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(destinationsRouter);
router.use(hotelsRouter);
router.use(commissionRouter);
router.use(vouchersRouter);
router.use(authRouter);
router.use(bookingsRouter);

export default router;

