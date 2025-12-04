import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function sendViaSMTP(gmailAddress, gmailAppPassword, to, subject, htmlBody) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const conn = await Deno.connectTls({
    hostname: "smtp.gmail.com",
    port: 465,
  });

  async function send(text) {
    await conn.write(encoder.encode(text + "\r\n"));
  }

  async function read() {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    return decoder.decode(buffer.subarray(0, n));
  }

  // Read greeting
  await read();
  
  // EHLO
  await send(`EHLO smtp.gmail.com`);
  await read();
  
  // AUTH LOGIN
  await send("AUTH LOGIN");
  await read();
  
  // Send username (base64)
  await send(btoa(gmailAddress));
  await read();
  
  // Send password (base64)
  await send(btoa(gmailAppPassword));
  const authResponse = await read();
  
  if (!authResponse.startsWith("235")) {
    conn.close();
    throw new Error("Authentication failed: " + authResponse);
  }
  
  // MAIL FROM
  await send(`MAIL FROM:<${gmailAddress}>`);
  await read();
  
  // RCPT TO
  await send(`RCPT TO:<${to}>`);
  await read();
  
  // DATA
  await send("DATA");
  await read();
  
  // Email content
  const emailContent = [
    `From: ${gmailAddress}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '.',
  ].join('\r\n');
  
  await send(emailContent);
  await read();
  
  // QUIT
  await send("QUIT");
  conn.close();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS');
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailAddress || !gmailAppPassword) {
      return Response.json({ error: 'Gmail credentials not configured' }, { status: 500 });
    }

    await sendViaSMTP(gmailAddress, gmailAppPassword, to, subject, body);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});