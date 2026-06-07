import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Webhooks are accessed by YCloud, so we handle CORS and method check
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Received YCloud Webhook:", JSON.stringify(payload));

    // Check if the event type is inbound message received
    if (payload.type !== "whatsapp.inbound_message.received") {
      return new Response(JSON.stringify({ status: "ignored_event_type", type: payload.type }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const msgData = payload.whatsappInboundMessage;
    if (!msgData) {
      return new Response(JSON.stringify({ error: "Missing whatsappInboundMessage" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const customerPhone = msgData.from; // Customer e.164 phone number
    const businessPhone = msgData.to;   // Business e.164 phone number
    const customerName = msgData.customerProfile?.name || "WhatsApp User";
    
    // Support image, video, document, sticker, etc. by placing placeholder text if body is empty
    let messageContent = "";
    if (msgData.type === "text" && msgData.text?.body) {
      messageContent = msgData.text.body;
    } else if (msgData.type === "image") {
      messageContent = msgData.image?.caption ? `[Image: ${msgData.image.caption}]` : "[Sent an Image]";
    } else if (msgData.type === "video") {
      messageContent = msgData.video?.caption ? `[Video: ${msgData.video.caption}]` : "[Sent a Video]";
    } else if (msgData.type === "audio") {
      messageContent = "[Sent an Audio Message]";
    } else if (msgData.type === "document") {
      messageContent = msgData.document?.filename ? `[Document: ${msgData.document.filename}]` : "[Sent a Document]";
    } else if (msgData.type === "location") {
      messageContent = msgData.location?.name ? `[Location: ${msgData.location.name} - ${msgData.location.address || ''}]` : "[Sent a Location]";
    } else if (msgData.type === "sticker") {
      messageContent = "[Sent a Sticker]";
    } else if (msgData.type === "interactive") {
      const type = msgData.interactive?.type;
      if (type === "button_reply") {
        messageContent = msgData.interactive.button_reply?.title || "[Button Reply]";
      } else if (type === "list_reply") {
        messageContent = msgData.interactive.list_reply?.title || "[List Reply]";
      } else {
        messageContent = "[Interactive Reply]";
      }
    } else {
      messageContent = `[Sent a ${msgData.type || 'message'}]`;
    }

    // Normalize phone numbers to digits only for comparison
    const normalizeDigits = (p: string) => p.replace(/\D/g, "");
    const normalizedBusinessPhone = normalizeDigits(businessPhone);

    // 1. Find the business by ycloud_sender_phone
    // Since businesses might store it in different formats, we query all businesses and match on normalized phone
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, ycloud_sender_phone");

    if (bizError) throw bizError;

    const matchedBiz = businesses?.find(b => 
      b.ycloud_sender_phone && normalizeDigits(b.ycloud_sender_phone) === normalizedBusinessPhone
    );

    if (!matchedBiz) {
      console.log(`No business configured with phone: ${businessPhone}`);
      return new Response(JSON.stringify({ error: "Business phone number not matched" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const businessId = matchedBiz.id;

    // 2. Check if customer exists in this business
    let { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('phone', customerPhone)
      .maybeSingle();

    if (customerError) throw customerError;

    let customerId = customer?.id;

    // 3. If customer doesn't exist, create customer
    if (!customerId) {
      const { data: newCustomer, error: createCustError } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: customerName,
          phone: customerPhone,
          tags: ['New WhatsApp Inquiry']
        })
        .select('id')
        .single();

      if (createCustError) throw createCustError;
      customerId = newCustomer.id;

      // Create a lead automatically for the new inquiry
      await supabase.from('leads').insert({
        business_id: businessId,
        customer_id: customerId,
        stage: 'New Inquiry',
        priority: 'medium',
        expected_deal_value: 0
      });
    }

    // 4. Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (convError) throw convError;

    let conversationId = conversation?.id;

    if (!conversationId) {
      const { data: newConv, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          business_id: businessId,
          customer_id: customerId,
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          unread_count: 1
        })
        .select('id')
        .single();

      if (createConvError) throw createConvError;
      conversationId = newConv.id;
    } else {
      // Update existing conversation
      const currentUnread = conversation.unread_count || 0;
      const { error: updateConvError } = await supabase
        .from('conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          unread_count: currentUnread + 1
        })
        .eq('id', conversationId);

      if (updateConvError) throw updateConvError;
    }

    // 5. Insert message
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'customer',
        content: messageContent,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return new Response(JSON.stringify({ success: true, messageId: newMessage.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    console.error("Error in webhook handler:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
