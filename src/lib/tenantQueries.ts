import { supabase } from './supabase';
import { Customer, Lead, Task, Conversation, Message, Note } from '../types';

/**
 * Tenant-scoped query helpers to fetch and write records.
 * These centralize the .eq('business_id', businessId) filters to prevent cross-tenant data leakage.
 */

export async function getTenantCustomers(businessId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*, assigned_staff:profiles(*)')
    .eq('business_id', businessId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getTenantConversations(businessId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, customer:customers(*, leads(*))')
    .eq('business_id', businessId)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getTenantTasks(businessId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, customer:customers(*), assigned_staff:profiles(*)')
    .eq('business_id', businessId)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getTenantLeads(businessId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, customer:customers(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCustomerContext(businessId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*, leads(*), tasks(*, assigned_staff:profiles(*)), notes(*, author:profiles(*))')
    .eq('business_id', businessId)
    .eq('id', customerId)
    .single();

  if (error) throw error;
  return data;
}

export async function createTenantCustomer(businessId: string, customerData: Omit<Customer, 'id' | 'business_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...customerData,
      business_id: businessId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTenantLead(businessId: string, leadData: Omit<Lead, 'id' | 'business_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...leadData,
      business_id: businessId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTenantTask(businessId: string, taskData: Omit<Task, 'id' | 'business_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      business_id: businessId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTenantNote(businessId: string, noteData: Omit<Note, 'id' | 'business_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      ...noteData,
      business_id: businessId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
