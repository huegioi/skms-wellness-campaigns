import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[PARSE] Request body:', body);
    const { file_url } = body;

    if (!file_url) {
      console.log('[PARSE] ERROR: No file_url provided');
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Fetch the file content
    console.log('[PARSE] Fetching file from:', file_url);
    const fileResponse = await fetch(file_url);
    
    if (!fileResponse.ok) {
      console.error('File fetch failed:', fileResponse.status, fileResponse.statusText);
      return Response.json({ error: `Failed to fetch file: ${fileResponse.statusText}` }, { status: 500 });
    }
    
    const contentType = fileResponse.headers.get('content-type');
    const fileContent = await fileResponse.text();
    
    console.log('[PARSE] File fetched successfully');
    console.log('[PARSE] Content type:', contentType);
    console.log('[PARSE] Content length:', fileContent.length);
    console.log('[PARSE] First 500 chars:', fileContent.substring(0, 500));
    console.log('[PARSE] file_url ends with .eml?', file_url.endsWith('.eml'));
    console.log('[PARSE] contentType includes message/rfc822?', contentType?.includes('message/rfc822'));

    let subject = '';
    let body = '';

    // Parse .eml files
    if (file_url.endsWith('.eml') || contentType?.includes('message/rfc822')) {
      // Extract subject
      const subjectMatch = fileContent.match(/^Subject: (.*)$/m);
      subject = subjectMatch ? subjectMatch[1].trim() : '';

      // Decode encoded subject
      subject = subject.replace(/=\?[^?]+\?[BQ]\?([^?]+)\?=/gi, (match, encoded) => {
        try {
          return atob(encoded);
        } catch {
          return match;
        }
      });

      // Find where headers end (blank line)
      const lines = fileContent.split('\n');
      let headerEndIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i > 0) {
          headerEndIndex = i;
          break;
        }
      }

      if (headerEndIndex > -1) {
        // Everything after headers is the body
        const bodyContent = lines.slice(headerEndIndex + 1).join('\n');

        // Try to find HTML content between <html> and </html> or <body> and </body>
        const htmlMatch = bodyContent.match(/<html[\s\S]*<\/html>/i);
        const bodyTagMatch = bodyContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

        if (bodyTagMatch) {
          body = bodyTagMatch[1];
        } else if (htmlMatch) {
          body = htmlMatch[0];
        } else {
          // No HTML tags found - treat as plain text
          const cleaned = bodyContent.trim();
          if (cleaned) {
            body = cleaned.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
          }
        }
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

    console.log('[PARSE] === FINAL RESULTS ===');
    console.log('[PARSE] Extracted subject:', subject);
    console.log('[PARSE] Extracted body length:', body?.length || 0);
    console.log('[PARSE] Body preview:', body?.substring(0, 200));
    
    if (!subject && !body) {
      console.warn('No content extracted from file');
    }
    
    return Response.json({ subject: subject || '', body: body || '' });
  } catch (error) {
    console.error('Parse error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});