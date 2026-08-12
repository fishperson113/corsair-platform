import { Hono } from "hono";

export function createCorsairApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok", system: "corsair-platform" }));
  app.get("/integrations", (c) => c.json({ integrations: [] }));
  app.get("/connections", (c) => c.json({ connections: [] }));
  app.get("/clients", (c) => c.json({ clients: [] }));
  app.get("/audit", (c) => c.json({ events: [] }));

  return app;
}
