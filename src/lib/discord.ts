export async function sendImageToDiscord(fileBuffer: Buffer | Uint8Array, filename: string) {
  const token = process.env.BOT_TOKEN;
  const channelId = process.env.CHANNEL_ID;
  
  if (!token) {
    throw new Error("BOT_TOKEN environment variable is not set");
  }
  
  if (!channelId) {
    throw new Error("CHANNEL_ID environment variable is not set");
  }

  // Create FormData for file upload
  const formData = new FormData();
  
  // Convert to ArrayBuffer if needed
  let arrayBuffer: ArrayBuffer;
  if (fileBuffer instanceof Buffer) {
    arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  } else if (fileBuffer instanceof Uint8Array) {
    arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  } else {
    arrayBuffer = fileBuffer;
  }
  
  const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
  formData.append("file", blob, filename);

  // Add empty payload_json to satisfy Discord's requirements for file uploads
  formData.append("payload_json", JSON.stringify({
    content: "",
  }));

  // Make request to Discord API
  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        // Don't set Content-Type header when using FormData - it will be set automatically with the correct boundary
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to upload to Discord: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const message = await response.json();
  return message;
}
