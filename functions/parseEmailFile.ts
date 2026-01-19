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

    // Parse .eml files - just extract everything after headers
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

      // Find double newline that separates headers from body
      const doubleLF = fileContent.indexOf('\n\n');
      const doubleCRLF = fileContent.indexOf('\r\n\r\n');
      const splitPoint = doubleCRLF > -1 ? doubleCRLF + 4 : (doubleLF > -1 ? doubleLF + 2 : -1);

      if (splitPoint > -1) {
        // Get everything after headers
        body = fileContent.substring(splitPoint).trim();

        // If body is still empty or very short, just return the last 80% of the file
        if (!body || body.length < 100) {
          const startFrom = Math.floor(fileContent.length * 0.2);
          body = fileContent.substring(startFrom);
        }

        console.log('[PARSE] Raw body length:', body.length);
        console.log('[PARSE] Raw body preview:', body.substring(0, 500));
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