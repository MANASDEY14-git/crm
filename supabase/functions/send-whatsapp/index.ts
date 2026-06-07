import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Auth header to verify user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Get request body
    const { recipientPhone, text } = await req.json();

    if (!recipientPhone || !text) {
      return new Response(JSON.stringify({ error: "Missing recipientPhone or text" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Fetch business ID from user profile
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profError || !profile?.business_id) {
      return new Response(JSON.stringify({ error: "Business profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Fetch WhatsApp credentials from business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('whatsapp_provider, ycloud_api_key, ycloud_sender_phone, openwa_api_url, openwa_api_key, openwa_session_id')
      .eq('id', profile.business_id)
      .single();

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: "Business not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const provider = business.whatsapp_provider || 'ycloud';

    if (provider === 'openwa') {
      if (!business.openwa_api_url || !business.openwa_api_key) {
        return new Response(JSON.stringify({ error: "OpenWA WhatsApp integration is not configured in Settings" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const apiBaseUrl = business.openwa_api_url.replace(/\/$/, "");
      const sessionId = business.openwa_session_id || 'my-bot';
      const cleanToDigits = recipientPhone.replace(/\D/g, "");
      const openwaUrl = `${apiBaseUrl}/sessions/${sessionId}/messages/send-text`;

      console.log(`Sending OpenWA message to ${cleanToDigits}@c.us via ${openwaUrl}`);

      const response = await fetch(openwaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': business.openwa_api_key
        },
        body: JSON.stringify({
          chatId: `${cleanToDigits}@c.us`,
          text: text
        })
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        const exactError = responseBody.message || responseBody.error?.message || `OpenWA API responded with status ${response.status}`;
        return new Response(JSON.stringify({
          success: false,
          error: exactError,
          details: responseBody
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(JSON.stringify({ success: true, data: responseBody }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } else {
      // Default to ycloud
      if (!business.ycloud_api_key || !business.ycloud_sender_phone) {
        return new Response(JSON.stringify({ error: "YCloud WhatsApp integration is not configured in Settings" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      // Function to normalize/standardize phone numbers to E.164
      const formatPhone = (p: string) => {
        let clean = p.replace(/[\s\-()]/g, '');
        if (!clean.startsWith('+')) {
          if (clean.length === 10) {
            clean = '+91' + clean;
          } else {
            clean = '+' + clean;
          }
        }
        return clean;
      };

      const formattedFrom = formatPhone(business.ycloud_sender_phone);
      const formattedTo = formatPhone(recipientPhone);

      // Call YCloud API
      const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': business.ycloud_api_key
        },
        body: JSON.stringify({
          from: formattedFrom,
          to: formattedTo,
          type: 'text',
          text: {
            body: text
          }
        })
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        const exactError = responseBody.error?.message || responseBody.message || `YCloud API responded with status ${response.status}`;
        return new Response(JSON.stringify({
          success: false,
          error: exactError,
          details: responseBody
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(JSON.stringify({ success: true, data: responseBody }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
