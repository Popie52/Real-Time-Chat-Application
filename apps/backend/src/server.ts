import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { createSocketServer } from "./socket";
import http from 'http';

const app = createApp();
const server = http.createServer(app);

connectDB(env.MONGO_URI).then(() => {
  createSocketServer(server);

  server.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
});
