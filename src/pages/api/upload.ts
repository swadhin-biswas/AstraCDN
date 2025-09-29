// Astro API (Bun) — Direct client-side image upload to Discord
import { sendImageToDiscord } from "@/lib/discord";
import { ImageModel } from "@/lib/models";
import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let buffer: Buffer;
    let filename: string;

    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const { imageBase64, filename: fn } = await request.json();
      if (!imageBase64 || !fn) {
        return new Response(
          JSON.stringify({ error: "Missing imageBase64 or filename" }),
          { status: 400 }
        );
      }
      buffer = Buffer.from(imageBase64, "base64");
      filename = fn;
    } else if (contentType?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(JSON.stringify({ error: "Missing file" }), {
          status: 400,
        });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      filename = file.name;
    } else {
      return new Response(JSON.stringify({ error: "Invalid content type" }), {
        status: 400,
      });
    }

    const message = await sendImageToDiscord(buffer, filename);

    // Log to Mongo
    await ImageModel.create({
      fileId: message.id,
      channelId: message.channel.id,
    });

    const host = new URL(request.url).origin;

    return new Response(
      JSON.stringify({
        fileId: message.id,
        discordUrl: message.attachments.first()?.url,
        viewUrl: `${host}/api/file/${message.id}`, // optional proxy
      }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
      });
    }
    console.error("[UPLOAD ERROR]", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
    });
  }
};
