import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

serve(
  {
    fetch: createApp().fetch,
    port,
  },
  (info) => {
    console.log(`Imagin backend running on http://localhost:${info.port}`);
  },
);
