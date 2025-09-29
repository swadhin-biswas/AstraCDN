export const prerender = false;

import type { APIRoute } from 'astro';
import { client } from '@/lib/discord';
import { ImageModel } from '@/lib/models';
 

export const GET: APIRoute = async ({ params }) => {
  const fileId = params.fileId;

  if (!fileId) {
    return new Response(JSON.stringify({ error: 'Missing fileId' }), { status: 400 });
  }

  try {
    const image = await ImageModel.findOne({ fileId });
    if (!image) {
      return new Response(JSON.stringify({ error: 'File not found in DB' }), { status: 404 });
    }

    const channel = await client.channels.fetch(image.channelId);
    if (!channel?.isTextBased()) {
      return new Response(JSON.stringify({ error: 'Invalid channel' }), { status: 500 });
    }

    const message = await channel.messages.fetch(fileId);
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404 });
    }

    const attachment = message.attachments.first();
    if (!attachment) {
      return new Response(JSON.stringify({ error: 'No attachment found' }), { status: 404 });
    }

    const fileResp = await fetch(attachment.url);

    if (!fileResp.ok || !fileResp.body) {
      return new Response(JSON.stringify({ error: 'Failed to fetch image from Discord' }), { status: 502 });
    }

    const headers = new Headers();
    headers.set('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    if (fileResp.headers.get('content-length')) {
      headers.set('Content-Length', fileResp.headers.get('content-length')!);
    }
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(fileResp.body, { status: 200, headers });
  } catch (err) {
    console.error('[File Proxy Error]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const fileId = params.fileId;

  if (!fileId) {
    return new Response(JSON.stringify({ error: 'Missing fileId' }), { status: 400 });
  }

  try {
    const image = await ImageModel.findOne({ fileId });
    if (!image) {
      return new Response(JSON.stringify({ error: 'File not found in DB' }), { status: 404 });
    }

    const channel = await client.channels.fetch(image.channelId);
    if (channel?.isTextBased()) {
      try {
        await channel.messages.delete(fileId);
      } catch (discordError) {
        console.error("[Discord Delete Error] Failed to delete message:", discordError);
        // It is safe to ignore this error and proceed with deleting the database entry
      }
    }

    await ImageModel.deleteOne({ fileId });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('[File Delete Error]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};