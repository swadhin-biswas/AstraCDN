export const prerender = false;

import type { APIRoute } from 'astro';
import { ImageModel } from '@/lib/models';

// Helper function to call Discord API
async function callDiscordAPI(endpoint: string, method: string = 'GET', body?: any) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN environment variable is not set");
  }
  
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) })
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Discord API error: ${response.status} ${response.statusText} - ${errorData}`);
  }
  
  return response.json();
}

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

    // Fetch message from Discord using REST API
    const message = await callDiscordAPI(`/channels/${image.channelId}/messages/${fileId}`, 'GET');
    
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404 });
    }

    const attachment = message.attachments?.[0];
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

    // Delete message from Discord using REST API
    try {
      await callDiscordAPI(`/channels/${image.channelId}/messages/${fileId}`, 'DELETE');
    } catch (discordError) {
      console.error("[Discord Delete Error] Failed to delete message:", discordError);
      // It is safe to ignore this error and proceed with deleting the database entry
    }

    await ImageModel.deleteOne({ fileId });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('[File Delete Error]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};