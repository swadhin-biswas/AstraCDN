import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

await client.login(process.env.BOT_TOKEN!);

export async function sendImageToDiscord(fileBuffer: Buffer, filename: string) {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID!);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Discord channel not found or invalid");
  }

  const message = await channel.send({
    files: [{ attachment: fileBuffer, name: filename }],
  });

  return message;
}
