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
      // Extract subject with proper decoding
      const subjectMatch = fileContent.match(/^Subject: (.*)$/m);
      subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Decode encoded subject (=?UTF-8?B?...?= format)
      subject = subject.replace(/=\?[^?]+\?[BQ]\?([^?]+)\?=/gi, (match, encoded) => {
        try {
          return atob(encoded);
        } catch {
          return match;
        }
      });

      // Find the boundary marker for multipart emails
      const boundaryMatch = fileContent.match(/boundary="?([^"\s;]+)"?/i);
      const boundary = boundaryMatch ? boundaryMatch[1] : null;
      
      console.log('[PARSE] Boundary found:', boundary);

      let htmlContent = '';
      let plainContent = '';

      if (boundary) {
        console.log('[PARSE] Processing multipart email with boundary');
        // Split by boundary
        const parts = fileContent.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
        
        console.log('[PARSE] Split into', parts.length, 'parts');
        
        for (const part of parts) {
          // Find HTML parts
          if (part.includes('Content-Type: text/html')) {
            console.log('[PARSE] Found HTML part');
            const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
            const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';
            
            // Extract content after headers (double newline)
            const contentStart = part.indexOf('\n\n');
            if (contentStart > -1) {
              let content = part.substring(contentStart + 2).trim();
              
              // Decode based on encoding
              if (encoding === 'base64') {
                try {
                  content = atob(content.replace(/[\r\n\s]/g, ''));
                } catch (e) {
                  console.error('Base64 decode error:', e);
                }
              } else if (encoding === 'quoted-printable') {
                // Decode quoted-printable
                content = content
                  .replace(/=\r?\n/g, '')
                  .replace(/=([0-9A-F]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
              }
              
              htmlContent = content;
            }
          }
          // Find plain text parts as fallback
          else if (part.includes('Content-Type: text/plain') && !plainContent) {
            const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
            const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';
            
            const contentStart = part.indexOf('\n\n');
            if (contentStart > -1) {
              let content = part.substring(contentStart + 2).trim();
              
              if (encoding === 'base64') {
                try {
                  content = atob(content.replace(/[\r\n\s]/g, ''));
                } catch (e) {
                  console.error('Base64 decode error:', e);
                }
              } else if (encoding === 'quoted-printable') {
                content = content
                  .replace(/=\r?\n/g, '')
                  .replace(/=([0-9A-F]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
              }
              
              plainContent = content;
            }
          }
        }
      } else {
        // No boundary - try single part parsing
        const htmlMatch = fileContent.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]+?)(?=\n--|\nContent-Type:|$)/i);
        const plainMatch = fileContent.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]+?)(?=\n--|\nContent-Type:|$)/i);
        
        if (htmlMatch) htmlContent = htmlMatch[1];
        if (plainMatch) plainContent = plainMatch[1];
      }

      // Use HTML content if available, otherwise plain text
      if (htmlContent) {
        // Extract just the body content
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        body = bodyMatch ? bodyMatch[1].trim() : htmlContent.trim();
        
        // Remove HTML/head tags but preserve body content
        body = body.replace(/<\/?html[^>]*>/gi, '').replace(/<head>[\s\S]*?<\/head>/gi, '');
        
        // Handle inline images - replace cid: with placeholder
        body = body.replace(/src=["']cid:([^"']+)["']/gi, 'src="https://placehold.co/400x300/e2e8f0/64748b?text=Embedded+Image"');
        
        // Preserve email styling - convert inline styles to editor-friendly format
        // Keep tables, divs, spans with styling
        body = body
          .replace(/style=["']([^"']*font-family:[^"';]*)[^"']*["']/gi, (match) => match) // Keep font styles
          .replace(/style=["']([^"']*color:[^"';]*)[^"']*["']/gi, (match) => match) // Keep colors
          .replace(/style=["']([^"']*background[^"';]*)[^"';]*)[^"']*["']/gi, (match) => match); // Keep backgrounds
        
        // Clean up excessive whitespace but preserve structure
        body = body.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        
        console.log('Processed HTML body length:', body.length);
        console.log('HTML body preview:', body.substring(0, 300));
      } else if (plainContent) {
        // Convert plain text to HTML with proper formatting
        body = plainContent
          .trim()
          .split(/\n\s*\n/)
          .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('');
        
        console.log('Converted plain text to HTML, length:', body.length);
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

    console.log('Extracted subject:', subject);
    console.log('Extracted body length:', body?.length || 0);
    console.log('Body preview:', body?.substring(0, 100));
    
    if (!subject && !body) {
      console.warn('No content extracted from file');
    }
    
    return Response.json({ subject: subject || '', body: body || '' });
  } catch (error) {
    console.error('Parse error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});