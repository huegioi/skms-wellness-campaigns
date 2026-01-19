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
      // Extract subject
      const subjectMatch = fileContent.match(/^Subject: (.*)$/m);
      subject = subjectMatch ? subjectMatch[1].trim() : '';

      // Find HTML content boundary
      const htmlBoundaryMatch = fileContent.match(/Content-Type: text\/html[^\n]*\n(?:Content-Transfer-Encoding: [^\n]*\n)?(?:\n)?([\s\S]*?)(?=\n--|\n\nContent-Type:|$)/i);
      
      if (htmlBoundaryMatch) {
        let htmlContent = htmlBoundaryMatch[1];
        
        // Decode if base64
        if (fileContent.includes('Content-Transfer-Encoding: base64')) {
          try {
            htmlContent = atob(htmlContent.replace(/\s/g, ''));
          } catch (e) {
            // If decode fails, keep original
          }
        }
        
        // Extract body content from HTML (remove html, head, body tags but keep inner content)
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        body = bodyMatch ? bodyMatch[1].trim() : htmlContent.trim();
        
        // Handle inline images - convert cid: references to placeholder
        body = body.replace(/src="cid:([^"]+)"/g, 'src="https://via.placeholder.com/150?text=Image"');
        
      } else {
        // Fallback to plain text
        const textBoundaryMatch = fileContent.match(/Content-Type: text\/plain[^\n]*\n(?:Content-Transfer-Encoding: [^\n]*\n)?(?:\n)?([\s\S]*?)(?=\n--|\n\nContent-Type:|$)/i);
        
        if (textBoundaryMatch) {
          let textContent = textBoundaryMatch[1];
          
          // Decode if base64
          if (fileContent.includes('Content-Transfer-Encoding: base64')) {
            try {
              textContent = atob(textContent.replace(/\s/g, ''));
            } catch (e) {
              // Keep original
            }
          }
          
          body = textContent.trim().split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
        } else {
          // Last resort: basic parsing
          const lines = fileContent.split('\n');
          let inBody = false;
          let bodyLines = [];

          for (let line of lines) {
            if (inBody) {
              bodyLines.push(line);
            } else if (line.trim() === '') {
              inBody = true;
            }
          }

          body = bodyLines.join('\n').trim();
          if (!body.includes('<')) {
            body = body.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
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

    return Response.json({ subject, body });
  } catch (error) {
    console.error('Parse error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});