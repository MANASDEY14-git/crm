export interface Business {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  business_id: string | null;
  email: string;
  full_name: string | null;
  role: 'admin' | 'sales_staff';
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  assigned_staff_id: string | null;
  created_at: string;
  address?: string | null;
  gst_number?: string | null;
  notes?: string | null;
  // Joins
  assigned_staff?: Profile;
}

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string;
  stage: 'New Inquiry' | 'Contacted' | 'Interested' | 'Follow-up Pending' | 'Quotation Sent' | 'Won' | 'Lost';
  expected_deal_value: number;
  priority: 'low' | 'medium' | 'high';
  follow_up_date: string | null;
  created_at: string;
  // Joins
  customer?: Customer;
}

export interface Conversation {
  id: string;
  business_id: string;
  customer_id: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  // Joins
  customer?: Customer;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'staff';
  sender_id: string | null;
  content: string;
  attachment_url: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  business_id: string;
  customer_id: string;
  type: 'Call' | 'WhatsApp Follow-up' | 'Meeting' | 'Callback';
  due_date: string;
  assigned_staff_id: string | null;
  status: 'pending' | 'completed';
  created_at: string;
  // Joins
  customer?: Customer;
  assigned_staff?: Profile;
}

export interface Note {
  id: string;
  business_id: string;
  customer_id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  // Joins
  author?: Profile;
}
