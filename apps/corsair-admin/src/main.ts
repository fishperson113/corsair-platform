import { serve } from "@hono/node-server";
import { createCorsairApp } from "./interfaces/http/createCorsairApp.js";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
const app = createCorsairApp();

serve({ fetch: app.fetch, port, hostname: host });
console.log(`Corsair listening on http://${host}:${port}`);
