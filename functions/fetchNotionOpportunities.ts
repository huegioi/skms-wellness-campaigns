import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { start_date, end_date, source } = await req.json();

    const notionApiKey = Deno.env.get('Notion_Internal_Integration_Secret');
    const notionDatabaseId = 'bab8d7c689784fb19409f7aee24465bf';

    if (!notionApiKey) {
      return Response.json({ error: 'Notion API key not configured' }, { status: 500 });
    }

    const filters = [];

    // Filter by Created time
    if (start_date && end_date) {
      filters.push({
        property: "Created time",
        created_time: {
          on_or_after: start_date,
          on_or_before: end_date
        }
      });
    } else if (start_date) {
      filters.push({
        property: "Created time",
        created_time: {
          on_or_after: start_date
        }
      });
    } else if (end_date) {
      filters.push({
        property: "Created time",
        created_time: {
          on_or_before: end_date
        }
      });
    }

    // Filter by Source
    if (source && source !== 'all') {
      filters.push({
        property: "Source",
        select: {
          equals: source
        }
      });
    }

    const queryPayload = {
      sorts: [
        {
          property: "Created time",
          direction: "descending"
        }
      ]
    };

    if (filters.length > 0) {
      queryPayload.filter = filters.length === 1 ? filters[0] : { and: filters };
    }

    // Fetch all results with pagination
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const paginatedPayload = { ...queryPayload };
      if (startCursor) {
        paginatedPayload.start_cursor = startCursor;
      }

      const notionResponse = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(paginatedPayload)
      });

      if (!notionResponse.ok) {
        const errorText = await notionResponse.text();
        return Response.json({ error: `Notion API error: ${notionResponse.status} - ${errorText}` }, { status: 500 });
      }

      const data = await notionResponse.json();
      allResults = allResults.concat(data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    const opportunities = allResults.map(page => {
      const properties = page.properties;
      
      // Extract company name - try multiple property types
      let companyName = 'Unknown';
      const companyProp = properties.Company || properties.company || properties.Name;
      
      if (companyProp) {
        // Title property type
        if (companyProp.title && companyProp.title.length > 0) {
          companyName = companyProp.title[0]?.plain_text;
        }
        // Rich text property type
        else if (companyProp.rich_text && companyProp.rich_text.length > 0) {
          companyName = companyProp.rich_text[0]?.plain_text;
        }
        // Formula property type
        else if (companyProp.formula?.string) {
          companyName = companyProp.formula.string;
        }
        // Rollup property type
        else if (companyProp.rollup?.array && companyProp.rollup.array.length > 0) {
          companyName = companyProp.rollup.array[0]?.title?.[0]?.plain_text || companyProp.rollup.array[0]?.rich_text?.[0]?.plain_text;
        }
        // Relation property type - extract ID
        else if (companyProp.relation && companyProp.relation.length > 0) {
          companyName = companyProp.relation[0]?.id;
        }
      }
      
      return {
        id: page.id,
        source: properties.Source?.select?.name || 'Unknown',
        company: companyName || 'Unknown',
        stage: properties.Stage?.select?.name || 'Unknown',
        created_time: properties['Created time']?.created_time || page.created_time
      };
    });

    return Response.json({ opportunities, total: opportunities.length });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});