import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FOLDER_ID = "1ZYxi5UFTsokwHBD29DZfJh5dQo84g7sZ";

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64  = encode(header);
  const payloadB64 = encode(payload);
  const sigInput   = `${headerB64}.${payloadB64}`;

  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const keyBytes  = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${sigInput}.${sigB64}`;

  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function uploadFile(
  token: string,
  fileName: string,
  fileBytes: Uint8Array,
  mimeType: string,
): Promise<{ viewLink: string; fileId: string }> {
  const metadata = JSON.stringify({ name: fileName, parents: [FOLDER_ID] });
  const boundary = "-------314159265358979323846";

  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`),
    fileBytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) { combined.set(part, offset); offset += part.length; }

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );

  const uploadData = await uploadRes.json();
  console.log("Upload response:", JSON.stringify(uploadData));

  if (!uploadData.id) {
    throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`);
  }

  // Make file publicly viewable
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    fileId: uploadData.id,
    viewLink: `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File;
    const empName  = formData.get("employee_name") as string;
    const dateStr  = new Date().toISOString().split("T")[0];

    if (!file || !empName) {
      return new Response(JSON.stringify({ error: "Missing file or employee_name" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const serviceAccount = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!);
    const token          = await getAccessToken(serviceAccount);

    // Filename: date_employeename_originalfilename
    const safeName  = empName.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_")
    const fileName  = `${dateStr}_${safeName}_${file.name}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { viewLink } = await uploadFile(token, fileName, fileBytes, file.type);

    return new Response(JSON.stringify({ url: viewLink }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});