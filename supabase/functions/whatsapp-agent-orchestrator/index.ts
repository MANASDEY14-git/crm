import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Retrieve environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "http://localhost:8080";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "evolution";

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("WhatsApp Test Orchestrator (Echo Mode) started.");

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const payload = await req.json();
    console.log("Received webhook event:", payload.event);

    // Filter only incoming message events
    if (payload.event !== "messages.upsert") {
      return new Response("Ignored non-upsert event", { status: 200 });
    }

    const messageData = payload.data;
    if (!messageData || messageData.key.fromMe) {
      return new Response("Ignored message from self", { status: 200 });
    }

    const remoteJid = messageData.key.remoteJid;
    const pushName = messageData.pushName || "Customer";

    // Extract message text content
    const messageText = messageData.message?.conversation || 
                        messageData.message?.extendedTextMessage?.text || 
                        "";

    if (!messageText.trim()) {
      return new Response("Ignored empty or media message", { status: 200 });
    }

    console.log(`Test Mode: Received message from ${pushName} (${remoteJid}): "${messageText}"`);

    // Attempt to log in Database (optional: fails gracefully if tables don't exist yet)
    try {
      const { error: dbErr } = await supabase
        .from("whatsapp_messages")
        .insert({ jid: remoteJid, role: "user", content: `[TEST] ${messageText}` });
      if (dbErr) {
        console.log("DB Insert test skipped (migration may not be run yet):", dbErr.message);
      } else {
        console.log("Logged user test message in Supabase successfully.");
      }
    } catch (dbEx) {
      console.log("Database connection failed or not configured yet. Continuing with Echo response...");
    }

    // Compose the test response
    const replyText = `✅ *Supabase Webhook Success!*\n\nHello ${pushName},\n\nYour message was received by the Supabase Edge Function orchestrator.\n\n*Echo:* "${messageText}"\n\n_Everything is working properly. We are ready to enable the AI agents next!_`;

    // Send reply back to customer via Evolution API
    console.log(`Sending echo response to ${remoteJid} via Evolution API...`);
    const evoEndpoint = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    const evoResponse = await fetch(evoEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: remoteJid,
        text: replyText,
      }),
    });

    if (!evoResponse.ok) {
      const evoErrText = await evoResponse.text();
      console.error(`Evolution API failed to send message to ${remoteJid}:`, evoErrText);
      return new Response("Evolution API Send Error", { status: 502 });
    }

    console.log(`Test message successfully sent to ${remoteJid}`);
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Error in handler:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
