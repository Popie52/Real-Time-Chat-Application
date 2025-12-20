import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";

const app = createApp();

connectDB(env.MONGO_URI).then(() => {
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
});
