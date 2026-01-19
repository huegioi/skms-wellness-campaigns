import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Fetch the file content
    const fileResponse = await fetch(file_url);
    const contentType = fileResponse.headers.get('content-type');
    const fileContent = await fileResponse.text();

    let subject = '';
    let body = '';

    // Parse .eml files
    if (file_url.endsWith('.eml') || contentType?.includes('message/rfc822')) {
      const lines = fileContent.split('\n');
      let inBody = false;
      let bodyLines = [];

      for (let line of lines) {
        if (line.startsWith('Subject: ')) {
          subject = line.substring(9).trim();
        }
        
        // Detect body start (after empty line following headers)
        if (inBody) {
          bodyLines.push(line);
        } else if (line.trim() === '') {
          inBody = true;
        }
      }

      body = bodyLines.join('\n').trim();

      // Convert plain text to basic HTML if needed
      if (!body.includes('<html') && !body.includes('<p>')) {
        body = body.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
      }
    }
    // Parse text files
    else if (file_url.endsWith('.txt') || contentType?.includes('text/plain')) {
      // First line as subject, rest as body
      const lines = fileContent.split('\n');
      subject = lines[0]?.trim() || '';
      body = lines.slice(1).join('\n').trim();
      body = body.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
    }
    // For other files, use LLM to extract content
    else {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract the email subject and body from this file content. Return as JSON with 'subject' and 'body' fields. The body should be in HTML format:\n\n${fileContent.substring(0, 10000)}`,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" }
          }
        }
      });

      subject = llmResponse.subject || '';
      body = llmResponse.body || '';
    }

    return Response.json({ subject, body });
  } catch (error) {
    console.error('Parse error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});