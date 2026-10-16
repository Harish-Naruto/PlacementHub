import express from "express";
import { json, urlencoded } from "body-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import config from "./config/index.ts";
import { errorHandler } from "./utils/apiError.ts";
import routes from "./routes/index.ts";

const app = express();

const limiter = rateLimit({
  windowMs: config.rate_limit_window_minutes() * 60 * 1000,
  max: config.rate_limit_max_request(),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: "http://localhost:5174",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);


app.use(helmet());
app.use(limiter);
app.use(cookieParser());
app.use(json({ limit: "1mb" }));
app.use(urlencoded({ extended: true, limit: "1mb" }));

// Health check at root
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ error: false, message: "OK", timestamp: new Date().toISOString() });
});

app.use("/api/v1", routes());

app.use((_req, res) => {
  res.status(404).json({ error: true, message: "Not Found" });
});

app.use(errorHandler);

export default app;
