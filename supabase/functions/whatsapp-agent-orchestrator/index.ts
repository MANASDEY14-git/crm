import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Retrieve environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "http://localhost:8080";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "evolution";

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("WhatsApp AI Agent Orchestrator (Gemini) started.");

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

    console.log(`Processing message from ${pushName} (${remoteJid}): "${messageText}"`);

    // 1. Fetch or Create Customer in Supabase
    let { data: customer, error: customerErr } = await supabase
      .from("whatsapp_customers")
      .select("*")
      .eq("jid", remoteJid)
      .single();

    if (customerErr || !customer) {
      const { data: newCustomer, error: insertCustomerErr } = await supabase
        .from("whatsapp_customers")
        .insert({ jid: remoteJid, name: pushName })
        .select("*")
        .single();
      
      if (insertCustomerErr) {
        console.error("Error creating customer record:", insertCustomerErr);
        return new Response("Error creating customer record", { status: 500 });
      }
      customer = newCustomer;
    }

    // 2. Fetch or Create Active Session state
    let { data: session, error: sessionErr } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("jid", remoteJid)
      .single();

    if (sessionErr || !session) {
      const { data: newSession, error: insertSessErr } = await supabase
        .from("whatsapp_sessions")
        .insert({ jid: remoteJid, active_agent: "sales" }) // default to sales agent
        .select("*")
        .single();

      if (insertSessErr) {
        console.error("Error creating session record:", insertSessErr);
        return new Response("Error creating session record", { status: 500 });
      }
      session = newSession;
    }

    // 3. Human Handoff Check (if active_agent is set to 'none', let human manage it)
    if (session.active_agent === "none") {
      console.log(`Session for ${remoteJid} is in human handoff state. AI is bypassed.`);
      return new Response("Human handoff active, AI bypassed", { status: 200 });
    }

    // 4. Log the incoming user message to Database
    const { error: userMsgErr } = await supabase
      .from("whatsapp_messages")
      .insert({ jid: remoteJid, role: "user", content: messageText });
    
    if (userMsgErr) {
      console.error("Failed to log user message in DB:", userMsgErr);
    }

    // 5. Fetch recent conversation history
    const { data: history } = await supabase
      .from("whatsapp_messages")
      .select("role, content")
      .eq("jid", remoteJid)
      .order("created_at", { ascending: true })
      .limit(12);

    // Format history for Gemini ensuring alternating roles and starting with user
    const rawHistory = history || [];
    const formattedHistory = [];
    
    for (const msg of rawHistory) {
      const role = msg.role === "assistant" ? "model" : "user";
      const text = msg.content || "";
      
      if (formattedHistory.length === 0) {
        if (role === "user") {
          formattedHistory.push({ role, parts: [{ text }] });
        }
      } else {
        const lastMsg = formattedHistory[formattedHistory.length - 1];
        if (lastMsg.role === role) {
          lastMsg.parts[0].text += "\n" + text;
        } else {
          formattedHistory.push({ role, parts: [{ text }] });
        }
      }
    }

    // Ensure we have at least one user message
    if (formattedHistory.length === 0) {
      formattedHistory.push({
        role: "user",
        parts: [{ text: messageText }]
      });
    }

    // 6. Compose System Prompt with current Customer Memory
    const currentMemory = customer.memory_context || "No history or specific details recorded yet.";
    const activeAgent = session.active_agent;

    const systemPrompt = `You are a highly professional AI Agent for our business.
Current active department: ${activeAgent === "sales" ? "SALES & UPSELLING" : "CUSTOMER SUPPORT"}
Customer Name: ${pushName}
Customer WhatsApp ID: ${remoteJid}

Permanent Customer Context (CRM Memory):
"""
${currentMemory}
"""

Guidelines:
1. Always maintain a helpful, friendly, and business-focused tone. Keep messages clear and concise (appropriate for WhatsApp).
2. If you are in SALES:
   - Your objective is to answer product questions, identify buying opportunities, explain packages, and qualify leads.
   - If the user asks technical support questions, reports an error, asks to open a support ticket, or needs help with an existing account, you MUST switch departments using the 'switch_agent' tool, setting target_agent to 'support'.
3. If you are in CUSTOMER SUPPORT:
   - Your objective is to resolve user issues, answer technical questions, explain feature setups, and manage customer service.
   - If the user shows interest in buying, pricing quotes, upgrading plans, or licensing details, you MUST switch departments using the 'switch_agent' tool, setting target_agent to 'sales'.
4. If the user explicitly asks to speak to a real person / human agent, call the 'switch_agent' tool with target_agent set to 'none'.
5. When you learn critical details about the customer (e.g. they prefer premium plan, their industry is ecommerce, they complained about speed), update their permanent record using the 'update_customer_memory' tool.`;

    // 7. Define Gemini Tools for Agent Handoff and Memory Tracking
    const tools = [
      {
        functionDeclarations: [
          {
            name: "switch_agent",
            description: "Re-routes the user's chat session to a different department. Use 'support' for technical, product, account, or issue tickets. Use 'sales' for price lists, purchasing, or upgrade queries. Use 'none' to transfer to a human support agent.",
            parameters: {
              type: "OBJECT",
              properties: {
                target_agent: {
                  type: "STRING",
                  enum: ["sales", "support", "none"],
                  description: "The department to route the conversation to.",
                },
              },
              required: ["target_agent"],
            },
          },
          {
            name: "update_customer_memory",
            description: "Saves a permanent fact or detail about the customer to their CRM profile for future conversations.",
            parameters: {
              type: "OBJECT",
              properties: {
                memory_fact: {
                  type: "STRING",
                  description: "A short, concise fact to add to the customer memory (e.g., 'Wants custom integration', 'Complained about latency').",
                },
              },
              required: ["memory_fact"],
            },
          },
        ],
      },
    ];

    // 8. Call Gemini API
    console.log(`Calling Gemini for ${activeAgent} agent...`);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: formattedHistory,
      systemInstruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      tools: tools,
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO"
        }
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API call failed with status", geminiResponse.status, ":", errText);
      return new Response(`Gemini Error: ${errText}`, { status: 500 });
    }

    const aiResult = await geminiResponse.json();
    const parts = aiResult.candidates?.[0]?.content?.parts || [];
    
    let aiResponseText = "";
    const toolCalls = [];

    for (const part of parts) {
      if (part.text) {
        aiResponseText += part.text;
      }
      if (part.functionCall) {
        toolCalls.push(part.functionCall);
      }
    }

    let updatedAgentState = activeAgent;
    let newMemoryContext = customer.memory_context || "";

    // 9. Execute Tool Calls (if any)
    for (const toolCall of toolCalls) {
      const funcName = toolCall.name;
      const funcArgs = toolCall.args;

      if (funcName === "switch_agent") {
        const nextAgent = funcArgs.target_agent;
        console.log(`Executing tool: switch_agent to "${nextAgent}"`);
        
        await supabase
          .from("whatsapp_sessions")
          .update({ active_agent: nextAgent })
          .eq("jid", remoteJid);

        updatedAgentState = nextAgent;

        if (nextAgent === "support") {
          aiResponseText += "\n\n*(Routing your request to our Support team. Please wait a moment...)*";
        } else if (nextAgent === "sales") {
          aiResponseText += "\n\n*(Routing your request to our Sales team. Please wait a moment...)*";
        } else if (nextAgent === "none") {
          aiResponseText += "\n\n*(I am transferring you to a human agent now. One of our team members will be with you shortly.)*";
        }
      }

      if (funcName === "update_customer_memory") {
        const fact = funcArgs.memory_fact;
        console.log(`Executing tool: update_customer_memory with "${fact}"`);

        const timeStamp = new Date().toISOString().split("T")[0];
        newMemoryContext = newMemoryContext 
          ? `${newMemoryContext}\n- [${timeStamp}] ${fact}` 
          : `- [${timeStamp}] ${fact}`;

        await supabase
          .from("whatsapp_customers")
          .update({ memory_context: newMemoryContext })
          .eq("jid", remoteJid);
      }
    }

    // If there is no response text generated, supply a fallback
    if (!aiResponseText.trim()) {
      if (updatedAgentState === "none") {
        aiResponseText = "Transferring you to a human representative now. Please stand by.";
      } else {
        aiResponseText = "I understand. How can I help you today?";
      }
    }

    // 10. Send reply back to customer via Evolution API
    console.log(`Sending reply to ${remoteJid} via Evolution API...`);
    const evoEndpoint = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    const evoResponse = await fetch(evoEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: remoteJid,
        text: aiResponseText,
      }),
    });

    if (!evoResponse.ok) {
      const evoErrText = await evoResponse.text();
      console.error(`Evolution API failed to send message to ${remoteJid}:`, evoErrText);
    } else {
      console.log(`Message successfully sent to ${remoteJid}`);
      
      // Log the outgoing assistant message to DB
      const { error: assistantMsgErr } = await supabase
        .from("whatsapp_messages")
        .insert({ jid: remoteJid, role: "assistant", content: aiResponseText });
      
      if (assistantMsgErr) {
        console.error("Failed to log assistant response in DB:", assistantMsgErr);
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Error in handler:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
