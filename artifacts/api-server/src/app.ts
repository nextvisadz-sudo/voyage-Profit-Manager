import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

import cookieParser from "cookie-parser";
import { authMiddleware } from "./lib/auth-service";
import path from "path";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

app.use("/api", router);

// Serve static assets of travel-website from travel-website's build output
const clientDistPath = path.resolve(__dirname, "../../travel-website/dist/public");
app.use(express.static(clientDistPath));

// Fallback all non-API GET requests to travel-website's index.html (SPA routing)
// NOTE: Express v5 (path-to-regexp v8+) requires named wildcards — bare "*" throws a TypeError.
app.get("/{*path}", (req, res) => {
  res.sendFile(path.resolve(clientDistPath, "index.html"));
});

export default app;

