export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_types: {
        Row: {
          active: boolean | null
          avg_ticket_range: string | null
          complexity_level: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avg_ticket_range?: string | null
          complexity_level?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avg_ticket_range?: string | null
          complexity_level?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_operator_id: string | null
          assigned_seller_id: string | null
          created_at: string | null
          customer_name: string | null
          fallback_mode: boolean | null
          fallback_taken_by: string | null
          id: string
          metadata: Json | null
          phone_number: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_operator_id?: string | null
          assigned_seller_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          fallback_mode?: boolean | null
          fallback_taken_by?: string | null
          id?: string
          metadata?: Json | null
          phone_number: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_operator_id?: string | null
          assigned_seller_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          fallback_mode?: boolean | null
          fallback_taken_by?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_fallback_taken_by_fkey"
            columns: ["fallback_taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          record_id: string | null
          sensitive_fields: string[] | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          record_id?: string | null
          sensitive_fields?: string[] | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          record_id?: string | null
          sensitive_fields?: string[] | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          active: boolean | null
          config: Json
          created_at: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          config?: Json
          created_at?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          config?: Json
          created_at?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          ai_evaluation: string | null
          conversation_id: string | null
          created_at: string | null
          customer_name: string
          generated_sale: boolean | null
          id: string
          phone_number: string
          product_interest: string | null
          sale_value: number | null
          seller_id: string | null
          sent_at: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          ai_evaluation?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_name: string
          generated_sale?: boolean | null
          id?: string
          phone_number: string
          product_interest?: string | null
          sale_value?: number | null
          seller_id?: string | null
          sent_at?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_evaluation?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_name?: string
          generated_sale?: boolean | null
          id?: string
          phone_number?: string
          product_interest?: string | null
          sale_value?: number | null
          seller_id?: string | null
          sent_at?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          last_error: string | null
          max_retries: number | null
          messages_content: string[] | null
          processed_at: string | null
          retry_count: number | null
          scheduled_for: string | null
          status: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          messages_content?: string[] | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          messages_content?: string[] | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          delivery_status: string | null
          id: string
          is_read: boolean | null
          media_url: string | null
          message_source: string | null
          message_type: string | null
          metadata: Json | null
          reply_to_message_id: string | null
          sender_name: string | null
          sender_type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_source?: string | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_name?: string | null
          sender_type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_source?: string | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_name?: string | null
          sender_type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quality_analyses: {
        Row: {
          analysis_type: string | null
          conversation_id: string | null
          created_at: string | null
          feedback: string | null
          id: string
          score: number | null
          seller_id: string | null
          suggestions: Json | null
        }
        Insert: {
          analysis_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          seller_id?: string | null
          suggestions?: Json | null
        }
        Update: {
          analysis_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          seller_id?: string | null
          suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_analyses_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_analyses_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_analyses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_analyses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_analyses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_performance_metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_type: string
          metric_unit: string | null
          metric_value: number
          period_end: string
          period_start: string
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_type: string
          metric_unit?: string | null
          metric_value: number
          period_end: string
          period_start: string
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_type?: string
          metric_unit?: string | null
          metric_value?: number
          period_end?: string
          period_start?: string
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_performance_metrics_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_performance_metrics_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_performance_metrics_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_skills: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          proficiency_level: number | null
          seller_id: string
          skill_name: string
          skill_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          proficiency_level?: number | null
          seller_id: string
          skill_name: string
          skill_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          proficiency_level?: number | null
          seller_id?: string
          skill_name?: string
          skill_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_skills_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_skills_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_skills_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_specialties: {
        Row: {
          created_at: string | null
          expertise_level: string | null
          id: string
          product_category_id: string
          seller_id: string
        }
        Insert: {
          created_at?: string | null
          expertise_level?: string | null
          id?: string
          product_category_id: string
          seller_id: string
        }
        Update: {
          created_at?: string | null
          expertise_level?: string | null
          id?: string
          product_category_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_specialties_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_specialties_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_specialties_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_specialties_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean | null
          auto_first_message: boolean | null
          avatar_url: string | null
          average_ticket: number | null
          bio: string | null
          conversion_rate: number | null
          created_at: string | null
          current_workload: number | null
          deleted: boolean | null
          email: string | null
          experience_years: number | null
          id: string
          max_concurrent_leads: number | null
          name: string
          performance_score: number | null
          personality_type: string | null
          phone_number: string
          updated_at: string | null
          whapi_error_message: string | null
          whapi_last_test: string | null
          whapi_status: string | null
          whapi_token: string | null
          whapi_webhook: string | null
          whapi_webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          auto_first_message?: boolean | null
          avatar_url?: string | null
          average_ticket?: number | null
          bio?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          current_workload?: number | null
          deleted?: boolean | null
          email?: string | null
          experience_years?: number | null
          id?: string
          max_concurrent_leads?: number | null
          name: string
          performance_score?: number | null
          personality_type?: string | null
          phone_number: string
          updated_at?: string | null
          whapi_error_message?: string | null
          whapi_last_test?: string | null
          whapi_status?: string | null
          whapi_token?: string | null
          whapi_webhook?: string | null
          whapi_webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          auto_first_message?: boolean | null
          avatar_url?: string | null
          average_ticket?: number | null
          bio?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          current_workload?: number | null
          deleted?: boolean | null
          email?: string | null
          experience_years?: number | null
          id?: string
          max_concurrent_leads?: number | null
          name?: string
          performance_score?: number | null
          personality_type?: string | null
          phone_number?: string
          updated_at?: string | null
          whapi_error_message?: string | null
          whapi_last_test?: string | null
          whapi_status?: string | null
          whapi_token?: string | null
          whapi_webhook?: string | null
          whapi_webhook_url?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          message: string
          source: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          source: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          source?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_registrations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          email: string
          id: string
          metadata: Json | null
          requested_at: string | null
          requested_role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          email: string
          id?: string
          metadata?: Json | null
          requested_at?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          requested_at?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          body: Json | null
          created_at: string | null
          error_message: string | null
          headers: Json | null
          id: string
          method: string
          response_body: Json | null
          response_status: number | null
          source: string
          url: string
        }
        Insert: {
          body?: Json | null
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          method: string
          response_body?: Json | null
          response_status?: number | null
          source: string
          url: string
        }
        Update: {
          body?: Json | null
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          method?: string
          response_body?: Json | null
          response_status?: number | null
          source?: string
          url?: string
        }
        Relationships: []
      }
      whapi_configurations: {
        Row: {
          active: boolean | null
          created_at: string | null
          health_status: string | null
          id: string
          last_health_check: string | null
          name: string
          phone_number: string
          seller_id: string | null
          token_secret_name: string
          type: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          name: string
          phone_number: string
          seller_id?: string | null
          token_secret_name: string
          type: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          name?: string
          phone_number?: string
          seller_id?: string | null
          token_secret_name?: string
          type?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "whapi_configurations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_configurations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_configurations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whapi_logs: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          direction: string
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          phone_from: string
          phone_to: string
          seller_id: string | null
          status: string | null
          token_secret_name: string | null
          token_used: string | null
          whapi_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          phone_from: string
          phone_to: string
          seller_id?: string | null
          status?: string | null
          token_secret_name?: string | null
          token_used?: string | null
          whapi_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          phone_from?: string
          phone_to?: string
          seller_id?: string | null
          status?: string | null
          token_secret_name?: string | null
          token_used?: string | null
          whapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whapi_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whapi_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversations_with_last_message: {
        Row: {
          assigned_operator_id: string | null
          assigned_seller_id: string | null
          created_at: string | null
          customer_name: string | null
          fallback_mode: boolean | null
          fallback_taken_by: string | null
          id: string | null
          last_message: string | null
          last_message_at: string | null
          last_sender_type: string | null
          phone_number: string | null
          seller_name: string | null
          status: string | null
          total_messages: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_fallback_taken_by_fkey"
            columns: ["fallback_taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_dashboard: {
        Row: {
          active: boolean | null
          active_leads: number | null
          avg_quality_score: number | null
          id: string | null
          name: string | null
          total_leads: number | null
          total_revenue: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      sellers_basic_info: {
        Row: {
          active: boolean | null
          conversion_rate: number | null
          created_at: string | null
          current_workload: number | null
          experience_years: number | null
          id: string | null
          max_concurrent_leads: number | null
          name: string | null
          performance_score: number | null
          personality_type: string | null
        }
        Insert: {
          active?: boolean | null
          conversion_rate?: number | null
          created_at?: string | null
          current_workload?: number | null
          experience_years?: number | null
          id?: string | null
          max_concurrent_leads?: number | null
          name?: string | null
          performance_score?: number | null
          personality_type?: string | null
        }
        Update: {
          active?: boolean | null
          conversion_rate?: number | null
          created_at?: string | null
          current_workload?: number | null
          experience_years?: number | null
          id?: string | null
          max_concurrent_leads?: number | null
          name?: string | null
          performance_score?: number | null
          personality_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_user_access: {
        Args: { approve?: boolean; registration_id_param: string }
        Returns: boolean
      }
      audit_access_attempt: {
        Args: {
          approval_status_param: string
          email_param: string
          has_access_param: boolean
          roles_param: string[]
          timestamp_param: string
          user_id_param: string
        }
        Returns: undefined
      }
      audit_sensitive_data_access: {
        Args: {
          accessed_fields: string[]
          record_id_param: string
          table_name_param: string
        }
        Returns: undefined
      }
      can_access_customer_data: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      can_access_seller_data: {
        Args: { target_seller_id: string; user_uuid: string }
        Returns: boolean
      }
      can_access_unassigned_conversations: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      cleanup_message_queue: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_masked_phone: {
        Args: { phone_number: string }
        Returns: string
      }
      get_seller_conversations: {
        Args: { seller_uuid: string }
        Returns: {
          conversation_id: string
          customer_name: string
          last_message: string
          last_message_at: string
          phone_number: string
          status: string
          total_messages: number
        }[]
      }
      get_user_role: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_safe: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["app_role"]
          user_uuid: string
        }
        Returns: boolean
      }
      mask_phone_for_role: {
        Args: {
          phone: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      mask_phone_number: {
        Args: {
          phone: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      process_message_queue: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      request_user_access: {
        Args: {
          requested_role_param?: Database["public"]["Enums"]["app_role"]
          user_email: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "operator" | "seller"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "operator", "seller"],
    },
  },
} as const
