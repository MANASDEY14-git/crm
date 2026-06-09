import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Local simulator to simulate incoming WhatsApp messages for development/testing.
 * It directly inserts records into the messages/conversations table.
 * This simulates a backend webhook handling incoming WhatsApp messages.
 */
export async function simulateIncomingWhatsAppMessage(
  businessId: string,
  customerName: string,
  customerPhone: string,
  messageContent: string
) {
  try {
    // 1. Check if customer exists in this business
    let { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('phone', customerPhone)
      .maybeSingle();

    if (customerError) throw customerError;

    let customerId = customer?.id;

    // 2. If customer doesn't exist, create customer
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

    // 3. Find or create conversation
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
      // Update existing conversation
      const currentUnread = conversation ? (conversation.unread_count || 0) : 0;
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

    // 4. Insert message
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        business_id: businessId,
        sender_type: 'customer',
        content: messageContent,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) throw msgError;
    return newMessage;
  } catch (error) {
    console.error('Error in simulateIncomingWhatsAppMessage:', error);
    throw error;
  }
}
