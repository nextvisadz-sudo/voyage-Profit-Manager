import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hotelsRouter from "./hotels";
import commissionRouter from "./commission";
import destinationsRouter from "./destinations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(destinationsRouter);
router.use(hotelsRouter);
router.use(commissionRouter);

export default router;
