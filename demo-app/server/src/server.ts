import express from "express";
import cors from "cors";
import session from "express-session";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import ticketsRouter from "./routes/tickets";

const app = express();
const PORT = 5001;

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is not set in the .env file.");
}

app.use(
  cors({
    origin: "http://localhost:5174",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/tickets", ticketsRouter);


app.listen(PORT, () => {
  console.log(`Demo app server running on http://localhost:${PORT}`);
});