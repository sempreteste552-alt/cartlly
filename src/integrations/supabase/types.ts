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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          abandoned_at: string
          created_at: string
          customer_id: string | null
          id: string
          items: Json
          last_reminder_at: string | null
          recovered: boolean
          recovered_order_id: string | null
          reminder_sent_count: number
          session_id: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          abandoned_at?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json
          last_reminder_at?: string | null
          recovered?: boolean
          recovered_order_id?: string | null
          reminder_sent_count?: number
          session_id?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          abandoned_at?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json
          last_reminder_at?: string | null
          recovered?: boolean
          recovered_order_id?: string | null
          reminder_sent_count?: number
          session_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_ai_chats: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_announcements: {
        Row: {
          active: boolean
          banner_type: string
          bg_color: string | null
          body: string | null
          created_at: string
          created_by: string
          id: string
          link_url: string | null
          marquee: boolean
          target_audience: string
          target_tenant_ids: string[] | null
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          banner_type?: string
          bg_color?: string | null
          body?: string | null
          created_at?: string
          created_by: string
          id?: string
          link_url?: string | null
          marquee?: boolean
          target_audience?: string
          target_tenant_ids?: string[] | null
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          banner_type?: string
          bg_color?: string | null
          body?: string | null
          created_at?: string
          created_by?: string
          id?: string
          link_url?: string | null
          marquee?: boolean
          target_audience?: string
          target_tenant_ids?: string[] | null
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          sender_user_id: string
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          sender_user_id: string
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_user_id?: string
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_feedback_loop: {
        Row: {
          action_type: string
          content_sent: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          insight_generated: string | null
          is_processed: boolean | null
          message_id: string | null
          tenant_id: string | null
        }
        Insert: {
          action_type: string
          content_sent?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          insight_generated?: string | null
          is_processed?: boolean | null
          message_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          action_type?: string
          content_sent?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          insight_generated?: string | null
          is_processed?: boolean | null
          message_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_loop_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_templates: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          id: string
          is_default: boolean
          template_text: string
          tone: string
          trigger_type: string
          updated_at: string
          user_id: string
          variables: string[] | null
        }
        Insert: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          template_text: string
          tone?: string
          trigger_type: string
          updated_at?: string
          user_id: string
          variables?: string[] | null
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          template_text?: string
          tone?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      ai_scheduled_tasks: {
        Row: {
          ai_instruction: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          retry_count: number | null
          scheduled_at: string
          status: string
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_instruction?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          retry_count?: number | null
          scheduled_at: string
          status?: string
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_instruction?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          retry_count?: number | null
          scheduled_at?: string
          status?: string
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_name: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_name?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_name?: string | null
          target_type?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          ai_generated: boolean
          channel: string
          clicked_at: string | null
          converted_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_text: string | null
          opened_at: string | null
          related_order_id: string | null
          related_product_id: string | null
          revenue_attributed: number | null
          rule_id: string | null
          sent_at: string
          status: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          ai_generated?: boolean
          channel?: string
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_text?: string | null
          opened_at?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
          revenue_attributed?: number | null
          rule_id?: string | null
          sent_at?: string
          status?: string
          trigger_type: string
          user_id: string
        }
        Update: {
          ai_generated?: boolean
          channel?: string
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_text?: string | null
          opened_at?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
          revenue_attributed?: number | null
          rule_id?: string | null
          sent_at?: string
          status?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          ai_generated: boolean
          ai_tone: string | null
          allowed_hours_end: number | null
          allowed_hours_start: number | null
          channel: string
          cooldown_minutes: number | null
          created_at: string
          cta_link: string | null
          cta_text: string | null
          discount_code: string | null
          discount_percentage: number | null
          enabled: boolean
          id: string
          max_sends_per_day: number | null
          message_template: string | null
          name: string
          offer_discount: boolean
          target_segment: string | null
          trigger_type: string
          updated_at: string
          user_id: string
          wait_minutes: number
        }
        Insert: {
          ai_generated?: boolean
          ai_tone?: string | null
          allowed_hours_end?: number | null
          allowed_hours_start?: number | null
          channel?: string
          cooldown_minutes?: number | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          enabled?: boolean
          id?: string
          max_sends_per_day?: number | null
          message_template?: string | null
          name: string
          offer_discount?: boolean
          target_segment?: string | null
          trigger_type?: string
          updated_at?: string
          user_id: string
          wait_minutes?: number
        }
        Update: {
          ai_generated?: boolean
          ai_tone?: string | null
          allowed_hours_end?: number | null
          allowed_hours_start?: number | null
          channel?: string
          cooldown_minutes?: number | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          enabled?: boolean
          id?: string
          max_sends_per_day?: number | null
          message_template?: string | null
          name?: string
          offer_discount?: boolean
          target_segment?: string | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
          wait_minutes?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      communication_preferences: {
        Row: {
          created_at: string
          customer_id: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          opted_out_at: string | null
          push_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          sms_enabled: boolean
          store_user_id: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          opted_out_at?: string | null
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sms_enabled?: boolean
          store_user_id: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          opted_out_at?: string | null
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sms_enabled?: boolean
          store_user_id?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order_value: number | null
          used_count: number
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          used_count?: number
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      customer_ai_insights: {
        Row: {
          category: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          insight: string
          insight_vector: string | null
          metadata: Json | null
          relevance_score: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          insight: string
          insight_vector?: string | null
          metadata?: Json | null
          relevance_score?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          insight?: string
          insight_vector?: string | null
          metadata?: Json | null
          relevance_score?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_ai_insights_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_behavior_events: {
        Row: {
          category_id: string | null
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          product_id: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "tenant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_prizes: {
        Row: {
          created_at: string | null
          customer_id: string
          delivered_at: string | null
          id: string
          product_id: string
          released_at: string | null
          status: string | null
          store_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          delivered_at?: string | null
          id?: string
          product_id: string
          released_at?: string | null
          status?: string | null
          store_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          delivered_at?: string | null
          id?: string
          product_id?: string
          released_at?: string | null
          status?: string | null
          store_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_prizes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_push_tokens: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          platform: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_push_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          order_id: string | null
          referred_id: string
          referrer_id: string
          reward_description: string | null
          reward_type: string
          reward_value: number | null
          status: string
          store_user_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          referred_id: string
          referrer_id: string
          reward_description?: string | null
          reward_type?: string
          reward_value?: number | null
          status?: string
          store_user_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          referred_id?: string
          referrer_id?: string
          reward_description?: string | null
          reward_type?: string
          reward_value?: number | null
          status?: string
          store_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          auto_update: boolean
          created_at: string
          customer_count: number
          description: string | null
          enabled: boolean
          filter_rules: Json
          id: string
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_update?: boolean
          created_at?: string
          customer_count?: number
          description?: string | null
          enabled?: boolean
          filter_rules?: Json
          id?: string
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_update?: boolean
          created_at?: string
          customer_count?: number
          description?: string | null
          enabled?: boolean
          filter_rules?: Json
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_states: {
        Row: {
          created_at: string
          customer_id: string
          discount_available: boolean
          id: string
          intent_level: string
          last_activity_at: string
          last_product_id: string | null
          last_product_name: string | null
          low_stock: boolean
          metadata: Json
          state: string
          state_changed_at: string
          store_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_available?: boolean
          id?: string
          intent_level?: string
          last_activity_at?: string
          last_product_id?: string | null
          last_product_name?: string | null
          low_stock?: boolean
          metadata?: Json
          state?: string
          state_changed_at?: string
          store_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_available?: boolean
          id?: string
          intent_level?: string
          last_activity_at?: string
          last_product_id?: string | null
          last_product_name?: string | null
          low_stock?: boolean
          metadata?: Json
          state?: string
          state_changed_at?: string
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_view_stats: {
        Row: {
          customer_id: string | null
          id: string
          last_viewed_at: string | null
          product_id: string | null
          view_count: number | null
        }
        Insert: {
          customer_id?: string | null
          id?: string
          last_viewed_at?: string | null
          product_id?: string | null
          view_count?: number | null
        }
        Update: {
          customer_id?: string | null
          id?: string
          last_viewed_at?: string | null
          product_id?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_view_stats_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_view_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_wishlist: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
          store_user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          store_user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          store_user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          auth_user_id: string
          cep: string | null
          city: string | null
          cpf: string | null
          created_at: string
          email: string
          gender: string | null
          id: string
          name: string
          phone: string | null
          referral_code: string | null
          referred_by_code: string | null
          routine_notes: string | null
          state: string | null
          store_user_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id: string
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          gender?: string | null
          id?: string
          name: string
          phone?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          routine_notes?: string | null
          state?: string | null
          store_user_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          gender?: string | null
          id?: string
          name?: string
          phone?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          routine_notes?: string | null
          state?: string | null
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_fingerprint: string
          id: string
          ip_address: string | null
          last_seen_at: string
          os: string | null
          trusted: boolean
          user_agent: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          os?: string | null
          trusted?: boolean
          user_agent?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          os?: string | null
          trusted?: boolean
          user_agent?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          locked_until: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          locked_until?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          locked_until?: string | null
          success?: boolean
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          min_redemption: number
          points_per_real: number
          redemption_rate: number
          referral_enabled: boolean | null
          referral_goal: number | null
          referral_reward_condition: string | null
          referral_reward_description: string | null
          referral_reward_points: number | null
          referral_reward_type: string | null
          referral_show_pending: boolean | null
          store_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          min_redemption?: number
          points_per_real?: number
          redemption_rate?: number
          referral_enabled?: boolean | null
          referral_goal?: number | null
          referral_reward_condition?: string | null
          referral_reward_description?: string | null
          referral_reward_points?: number | null
          referral_reward_type?: string | null
          referral_show_pending?: boolean | null
          store_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          min_redemption?: number
          points_per_real?: number
          redemption_rate?: number
          referral_enabled?: boolean | null
          referral_goal?: number | null
          referral_reward_condition?: string | null
          referral_reward_description?: string | null
          referral_reward_points?: number | null
          referral_reward_type?: string | null
          referral_show_pending?: boolean | null
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          lifetime_points: number
          points_balance: number
          store_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          store_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          order_id: string | null
          points: number
          store_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          order_id?: string | null
          points: number
          store_user_id: string
          type?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points?: number
          store_user_id?: string
          type?: string
        }
        Relationships: []
      }
      manual_sales: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          items: Json
          notes: string | null
          payment_method: string
          sale_date: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          sale_date?: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          sale_date?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_delivery_logs: {
        Row: {
          channel: string
          clicked_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error_details: string | null
          execution_id: string | null
          external_id: string | null
          id: string
          opened_at: string | null
          provider: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_details?: string | null
          execution_id?: string | null
          external_id?: string | null
          id?: string
          opened_at?: string | null
          provider?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_details?: string | null
          execution_id?: string | null
          external_id?: string | null
          id?: string
          opened_at?: string | null
          provider?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_delivery_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_address: string | null
          customer_cpf: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount_amount: number
          id: string
          notes: string | null
          referral_code: string | null
          shipping_cep: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_cost: number
          shipping_method: string | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_state: string | null
          shipping_street: string | null
          status: string
          total: number
          tracking_token: string | null
          updated_at: string
          user_id: string
          whatsapp_order: boolean
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          referral_code?: string | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          status?: string
          total?: number
          tracking_token?: string | null
          updated_at?: string
          user_id: string
          whatsapp_order?: boolean
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          referral_code?: string | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          status?: string
          total?: number
          tracking_token?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_order?: boolean
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          destination: string
          expires_at: string
          hashed_code: string | null
          id: string
          max_attempts: number
          method: string
          purpose: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          destination: string
          expires_at: string
          hashed_code?: string | null
          id?: string
          max_attempts?: number
          method?: string
          purpose?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          destination?: string
          expires_at?: string
          hashed_code?: string | null
          id?: string
          max_attempts?: number
          method?: string
          purpose?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          boleto_barcode: string | null
          boleto_expiration: string | null
          boleto_url: string | null
          card_brand: string | null
          card_last_four: string | null
          created_at: string
          gateway: string
          gateway_payment_id: string | null
          id: string
          issuer_id: string | null
          method: string
          order_id: string
          payment_method_id: string | null
          pix_expiration: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          raw_response: Json | null
          status: string
          status_detail: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          boleto_barcode?: string | null
          boleto_expiration?: string | null
          boleto_url?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          gateway: string
          gateway_payment_id?: string | null
          id?: string
          issuer_id?: string | null
          method: string
          order_id: string
          payment_method_id?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          boleto_barcode?: string | null
          boleto_expiration?: string | null
          boleto_url?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          gateway?: string
          gateway_payment_id?: string | null
          id?: string
          issuer_id?: string | null
          method?: string
          order_id?: string
          payment_method_id?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_requests: {
        Row: {
          created_at: string
          current_plan_id: string | null
          id: string
          rejection_reason: string | null
          request_type: string
          requested_plan_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_plan_id?: string | null
          id?: string
          rejection_reason?: string | null
          request_type?: string
          requested_plan_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_plan_id?: string | null
          id?: string
          rejection_reason?: string | null
          request_type?: string
          requested_plan_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_requests_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "tenant_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_requests_requested_plan_id_fkey"
            columns: ["requested_plan_id"]
            isOneToOne: false
            referencedRelation: "tenant_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          id: string
          image_urls: string[]
          product_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          id?: string
          image_urls?: string[]
          product_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          id?: string
          image_urls?: string[]
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          price_modifier: number
          product_id: string
          sku: string | null
          stock: number
          variant_type: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_modifier?: number
          product_id: string
          sku?: string | null
          stock?: number
          variant_type?: string
          variant_value: string
        }
        Update: {
          created_at?: string
          id?: string
          price_modifier?: number
          product_id?: string
          sku?: string | null
          stock?: number
          variant_type?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_videos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string
          sort_order: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_prize: boolean | null
          made_to_order: boolean
          min_stock_alert: number
          name: string
          original_price: number | null
          price: number
          published: boolean
          stock: number
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          badge?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_prize?: boolean | null
          made_to_order?: boolean
          min_stock_alert?: number
          name: string
          original_price?: number | null
          price?: number
          published?: boolean
          stock?: number
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          badge?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_prize?: boolean | null
          made_to_order?: boolean
          min_stock_alert?: number
          name?: string
          original_price?: number | null
          price?: number
          published?: boolean
          stock?: number
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_online: boolean | null
          last_seen: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_logs: {
        Row: {
          body: string | null
          clicked_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          status: string
          store_user_id: string | null
          subscription_id: string | null
          title: string
          trigger_type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          status?: string
          store_user_id?: string | null
          subscription_id?: string | null
          title: string
          trigger_type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          status?: string
          store_user_id?: string | null
          subscription_id?: string | null
          title?: string
          trigger_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          platform: string
          store_user_id: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          platform?: string
          store_user_id?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          platform?: string
          store_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recommendation_logs: {
        Row: {
          algorithm: string
          clicked_product_id: string | null
          converted: boolean
          converted_order_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          recommended_product_ids: string[]
          source_product_id: string | null
          user_id: string
        }
        Insert: {
          algorithm?: string
          clicked_product_id?: string | null
          converted?: boolean
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          recommended_product_ids?: string[]
          source_product_id?: string | null
          user_id: string
        }
        Update: {
          algorithm?: string
          clicked_product_id?: string | null
          converted?: boolean
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          recommended_product_ids?: string[]
          source_product_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          clicks: number
          code: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          code: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          code?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_discounts: {
        Row: {
          amount: number
          applied: boolean
          billing_cycle: string | null
          created_at: string
          id: string
          referral_id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          applied?: boolean
          billing_cycle?: string | null
          created_at?: string
          id?: string
          referral_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          applied?: boolean
          billing_cycle?: string | null
          created_at?: string
          id?: string
          referral_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_discounts_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          approved_at: string | null
          cancelled_at: string | null
          clicked_at: string | null
          created_at: string
          discount_amount: number
          discount_applied: boolean
          flagged: boolean
          flagged_reason: string | null
          id: string
          ip_address: string | null
          payment_status: string | null
          referral_code: string
          referred_email: string | null
          referred_plan_id: string | null
          referred_user_id: string | null
          referrer_tenant_id: string
          status: string
          subscribed_at: string | null
          subscription_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          approved_at?: string | null
          cancelled_at?: string | null
          clicked_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_applied?: boolean
          flagged?: boolean
          flagged_reason?: string | null
          id?: string
          ip_address?: string | null
          payment_status?: string | null
          referral_code: string
          referred_email?: string | null
          referred_plan_id?: string | null
          referred_user_id?: string | null
          referrer_tenant_id: string
          status?: string
          subscribed_at?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          approved_at?: string | null
          cancelled_at?: string | null
          clicked_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_applied?: boolean
          flagged?: boolean
          flagged_reason?: string | null
          id?: string
          ip_address?: string | null
          payment_status?: string | null
          referral_code?: string
          referred_email?: string | null
          referred_plan_id?: string | null
          referred_user_id?: string | null
          referrer_tenant_id?: string
          status?: string
          subscribed_at?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_plan_id_fkey"
            columns: ["referred_plan_id"]
            isOneToOne: false
            referencedRelation: "tenant_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      retargeting_sequences: {
        Row: {
          created_at: string
          current_step: number
          customer_id: string
          id: string
          last_push_at: string | null
          max_steps: number
          metadata: Json
          next_push_at: string | null
          product_id: string | null
          pushes_sent: number
          status: string
          stopped_reason: string | null
          store_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          customer_id: string
          id?: string
          last_push_at?: string | null
          max_steps?: number
          metadata?: Json
          next_push_at?: string | null
          product_id?: string | null
          pushes_sent?: number
          status?: string
          stopped_reason?: string | null
          store_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          customer_id?: string
          id?: string
          last_push_at?: string | null
          max_steps?: number
          metadata?: Json
          next_push_at?: string | null
          product_id?: string | null
          pushes_sent?: number
          status?: string
          stopped_reason?: string | null
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      roulette_prizes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label: string
          manual_approval_required: boolean | null
          min_subscription_tier: string | null
          prize_type: string
          prize_value: number | null
          probability: number
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          manual_approval_required?: boolean | null
          min_subscription_tier?: string | null
          prize_type?: string
          prize_value?: number | null
          probability?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          manual_approval_required?: boolean | null
          min_subscription_tier?: string | null
          prize_type?: string
          prize_value?: number | null
          probability?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roulette_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_spins: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          delivered_at: string | null
          delivered_by: string | null
          id: string
          metadata: Json | null
          prize_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          metadata?: Json | null
          prize_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          metadata?: Json | null
          prize_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "roulette_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_customer_data: {
        Row: {
          card_brand: string | null
          card_last_four: string | null
          cpf: string | null
          created_at: string
          customer_id: string
          default_address: string | null
          default_cep: string | null
          id: string
          store_user_id: string
          updated_at: string
        }
        Insert: {
          card_brand?: string | null
          card_last_four?: string | null
          cpf?: string | null
          created_at?: string
          customer_id: string
          default_address?: string | null
          default_cep?: string | null
          id?: string
          store_user_id: string
          updated_at?: string
        }
        Update: {
          card_brand?: string | null
          card_last_four?: string | null
          cpf?: string | null
          created_at?: string
          customer_id?: string
          default_address?: string | null
          default_cep?: string | null
          id?: string
          store_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          term: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          term: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          term?: string
          user_id?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          id: string
          lockout_duration_minutes: number
          max_failed_logins: number
          otp_code_length: number
          otp_default_method: string
          otp_email_enabled: boolean
          otp_expiration_minutes: number
          otp_max_attempts: number
          otp_sms_enabled: boolean
          otp_whatsapp_enabled: boolean
          require_otp_new_device: boolean
          require_otp_new_ip: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          lockout_duration_minutes?: number
          max_failed_logins?: number
          otp_code_length?: number
          otp_default_method?: string
          otp_email_enabled?: boolean
          otp_expiration_minutes?: number
          otp_max_attempts?: number
          otp_sms_enabled?: boolean
          otp_whatsapp_enabled?: boolean
          require_otp_new_device?: boolean
          require_otp_new_ip?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          lockout_duration_minutes?: number
          max_failed_logins?: number
          otp_code_length?: number
          otp_default_method?: string
          otp_email_enabled?: boolean
          otp_expiration_minutes?: number
          otp_max_attempts?: number
          otp_sms_enabled?: boolean
          otp_whatsapp_enabled?: boolean
          require_otp_new_device?: boolean
          require_otp_new_ip?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          active: boolean
          cep_end: string
          cep_start: string
          created_at: string
          estimated_days: string
          id: string
          price: number
          user_id: string
          zone_name: string
        }
        Insert: {
          active?: boolean
          cep_end: string
          cep_start: string
          created_at?: string
          estimated_days?: string
          id?: string
          price?: number
          user_id: string
          zone_name: string
        }
        Update: {
          active?: boolean
          cep_end?: string
          cep_start?: string
          created_at?: string
          estimated_days?: string
          id?: string
          price?: number
          user_id?: string
          zone_name?: string
        }
        Relationships: []
      }
      stock_notify_subscriptions: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          id: string
          notified: boolean
          notified_at: string | null
          product_id: string
          store_user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          product_id: string
          store_user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          product_id?: string
          store_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_notify_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_notify_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_reminders: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          remind_at: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          remind_at: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          remind_at?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      store_banners: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          image_url: string
          link_url: string | null
          media_type: string
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          link_url?: string | null
          media_type?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          link_url?: string | null
          media_type?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_collaborators: {
        Row: {
          collaborator_id: string
          created_at: string
          id: string
          role: string
          store_owner_id: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          id?: string
          role: string
          store_owner_id: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          id?: string
          role?: string
          store_owner_id?: string
        }
        Relationships: []
      }
      store_domains: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_requested_at: string | null
          cloudflare_api_token: string | null
          cloudflare_zone_id: string | null
          conflicting_records: Json | null
          created_at: string
          detected_provider: string | null
          dns_status: string | null
          dns_validation_details: Json | null
          hostname: string
          id: string
          is_primary: boolean | null
          is_published: boolean | null
          last_ssl_error: string | null
          last_verified_at: string | null
          ssl_issued_at: string | null
          ssl_status: string | null
          ssl_validation_details: Json | null
          status: string
          store_id: string
          txt_status: string | null
          updated_at: string
          verification_token: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_requested_at?: string | null
          cloudflare_api_token?: string | null
          cloudflare_zone_id?: string | null
          conflicting_records?: Json | null
          created_at?: string
          detected_provider?: string | null
          dns_status?: string | null
          dns_validation_details?: Json | null
          hostname: string
          id?: string
          is_primary?: boolean | null
          is_published?: boolean | null
          last_ssl_error?: string | null
          last_verified_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string | null
          ssl_validation_details?: Json | null
          status?: string
          store_id: string
          txt_status?: string | null
          updated_at?: string
          verification_token?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_requested_at?: string | null
          cloudflare_api_token?: string | null
          cloudflare_zone_id?: string | null
          conflicting_records?: Json | null
          created_at?: string
          detected_provider?: string | null
          dns_status?: string | null
          dns_validation_details?: Json | null
          hostname?: string
          id?: string
          is_primary?: boolean | null
          is_published?: boolean | null
          last_ssl_error?: string | null
          last_verified_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string | null
          ssl_validation_details?: Json | null
          status?: string
          store_id?: string
          txt_status?: string | null
          updated_at?: string
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      store_highlight_items: {
        Row: {
          created_at: string
          highlight_id: string
          id: string
          media_type: string
          media_url: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          highlight_id: string
          id?: string
          media_type?: string
          media_url: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          highlight_id?: string
          id?: string
          media_type?: string
          media_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_highlight_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "store_highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      store_highlights: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_home_sections: {
        Row: {
          button_link: string | null
          button_text: string | null
          config: Json
          created_at: string
          description: string | null
          desktop_visible: boolean
          enabled: boolean
          id: string
          image_url: string | null
          mobile_visible: boolean
          section_type: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          desktop_visible?: boolean
          enabled?: boolean
          id?: string
          image_url?: string | null
          mobile_visible?: boolean
          section_type: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          desktop_visible?: boolean
          enabled?: boolean
          id?: string
          image_url?: string | null
          mobile_visible?: boolean
          section_type?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      store_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          role: string
          store_owner_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          role?: string
          store_owner_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          role?: string
          store_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_invitations_store_owner_id_fkey"
            columns: ["store_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      store_marketing_config: {
        Row: {
          announcement_bar_bg_color: string
          announcement_bar_enabled: boolean
          announcement_bar_link: string | null
          announcement_bar_search_enabled: boolean | null
          announcement_bar_text: string | null
          announcement_bar_text_color: string
          countdown_bg_color: string
          countdown_enabled: boolean
          countdown_end_date: string | null
          countdown_text: string | null
          countdown_text_color: string
          created_at: string
          free_shipping_bar_color: string
          free_shipping_bar_enabled: boolean
          free_shipping_threshold: number
          id: string
          popup_coupon_code: string | null
          popup_coupon_delay_seconds: number
          popup_coupon_description: string | null
          popup_coupon_enabled: boolean
          popup_coupon_image_url: string | null
          popup_coupon_title: string | null
          trust_badges: Json
          trust_badges_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcement_bar_bg_color?: string
          announcement_bar_enabled?: boolean
          announcement_bar_link?: string | null
          announcement_bar_search_enabled?: boolean | null
          announcement_bar_text?: string | null
          announcement_bar_text_color?: string
          countdown_bg_color?: string
          countdown_enabled?: boolean
          countdown_end_date?: string | null
          countdown_text?: string | null
          countdown_text_color?: string
          created_at?: string
          free_shipping_bar_color?: string
          free_shipping_bar_enabled?: boolean
          free_shipping_threshold?: number
          id?: string
          popup_coupon_code?: string | null
          popup_coupon_delay_seconds?: number
          popup_coupon_description?: string | null
          popup_coupon_enabled?: boolean
          popup_coupon_image_url?: string | null
          popup_coupon_title?: string | null
          trust_badges?: Json
          trust_badges_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcement_bar_bg_color?: string
          announcement_bar_enabled?: boolean
          announcement_bar_link?: string | null
          announcement_bar_search_enabled?: boolean | null
          announcement_bar_text?: string | null
          announcement_bar_text_color?: string
          countdown_bg_color?: string
          countdown_enabled?: boolean
          countdown_end_date?: string | null
          countdown_text?: string | null
          countdown_text_color?: string
          created_at?: string
          free_shipping_bar_color?: string
          free_shipping_bar_enabled?: boolean
          free_shipping_threshold?: number
          id?: string
          popup_coupon_code?: string | null
          popup_coupon_delay_seconds?: number
          popup_coupon_description?: string | null
          popup_coupon_enabled?: boolean
          popup_coupon_image_url?: string | null
          popup_coupon_title?: string | null
          trust_badges?: Json
          trust_badges_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_policies: {
        Row: {
          cookie_policy: string
          created_at: string
          id: string
          privacy_policy: string
          terms_of_service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cookie_policy?: string
          created_at?: string
          id?: string
          privacy_policy?: string
          terms_of_service?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cookie_policy?: string
          created_at?: string
          id?: string
          privacy_policy?: string
          terms_of_service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_product_page_config: {
        Row: {
          created_at: string
          delivery_estimation_text: string
          enable_buy_together: boolean
          enable_category_best_sellers: boolean
          enable_delivery_estimation: boolean
          enable_faq: boolean
          enable_image_zoom: boolean
          enable_recently_viewed: boolean
          enable_related_products: boolean
          enable_reviews: boolean
          enable_size_guide: boolean
          enable_sticky_add_to_cart: boolean
          enable_stock_urgency: boolean
          enable_trust_badges: boolean
          enable_video_gallery: boolean
          id: string
          size_guide_content: string | null
          stock_urgency_threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_estimation_text?: string
          enable_buy_together?: boolean
          enable_category_best_sellers?: boolean
          enable_delivery_estimation?: boolean
          enable_faq?: boolean
          enable_image_zoom?: boolean
          enable_recently_viewed?: boolean
          enable_related_products?: boolean
          enable_reviews?: boolean
          enable_size_guide?: boolean
          enable_sticky_add_to_cart?: boolean
          enable_stock_urgency?: boolean
          enable_trust_badges?: boolean
          enable_video_gallery?: boolean
          id?: string
          size_guide_content?: string | null
          stock_urgency_threshold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_estimation_text?: string
          enable_buy_together?: boolean
          enable_category_best_sellers?: boolean
          enable_delivery_estimation?: boolean
          enable_faq?: boolean
          enable_image_zoom?: boolean
          enable_recently_viewed?: boolean
          enable_related_products?: boolean
          enable_reviews?: boolean
          enable_size_guide?: boolean
          enable_sticky_add_to_cart?: boolean
          enable_stock_urgency?: boolean
          enable_trust_badges?: boolean
          enable_video_gallery?: boolean
          id?: string
          size_guide_content?: string | null
          stock_urgency_threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_restock_alerts: {
        Row: {
          accent_color: string
          active: boolean
          bg_color: string
          card_bg_color: string
          created_at: string
          cta_text: string
          id: string
          product_ids: string[]
          push_body: string | null
          push_enabled: boolean
          push_title: string | null
          subtitle: string | null
          text_color: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          active?: boolean
          bg_color?: string
          card_bg_color?: string
          created_at?: string
          cta_text?: string
          id?: string
          product_ids?: string[]
          push_body?: string | null
          push_enabled?: boolean
          push_title?: string | null
          subtitle?: string | null
          text_color?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          active?: boolean
          bg_color?: string
          card_bg_color?: string
          created_at?: string
          cta_text?: string
          id?: string
          product_ids?: string[]
          push_body?: string | null
          push_enabled?: boolean
          push_title?: string | null
          subtitle?: string | null
          text_color?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          accent_color: string
          accepted_payment_methods: string[] | null
          admin_accent_color: string
          admin_blocked: boolean
          admin_primary_color: string
          ai_avatar_url: string | null
          ai_chat_tone: string
          ai_last_analysis_at: string | null
          ai_name: string | null
          banner_mobile_format: string
          button_color: string
          button_text_color: string
          created_at: string
          custom_domain: string | null
          domain_last_check: string | null
          domain_status: string
          domain_verify_details: Json | null
          facebook_url: string | null
          favicon_url: string | null
          footer_bg_color: string
          footer_text_color: string
          gateway_environment: string
          gateway_public_key: string | null
          gateway_secret_key: string | null
          google_maps_url: string | null
          header_bg_color: string
          header_text_color: string | null
          id: string
          instagram_url: string | null
          installments_free_up_to: number
          installments_interest_enabled: boolean
          installments_interest_rate: number
          is_verified: boolean | null
          language: string
          logo_size: number
          logo_url: string | null
          low_stock_threshold: number
          marquee_bg_color: string
          marquee_enabled: boolean
          marquee_speed: number
          marquee_text: string | null
          marquee_text_color: string
          max_installments: number
          page_bg_color: string | null
          payment_boleto: boolean
          payment_credit_card: boolean
          payment_debit_card: boolean
          payment_gateway: string | null
          payment_pix: boolean
          primary_color: string
          promo_banner_enabled: boolean
          promo_banner_link: string | null
          promo_banner_text: string | null
          secondary_color: string
          sell_via_whatsapp: boolean
          shipping_base_cost: number
          shipping_enabled: boolean
          shipping_flat_rate: number | null
          shipping_free_above: number | null
          shipping_per_km: number
          store_address: string | null
          store_blocked: boolean
          store_category: string | null
          store_cep: string | null
          store_description: string | null
          store_location: string | null
          store_name: string
          store_open: boolean
          store_phone: string | null
          store_slug: string | null
          store_whatsapp: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          welcome_coupon_discount_type: string
          welcome_coupon_discount_value: number
          welcome_coupon_enabled: boolean
          welcome_coupon_expires_days: number
          welcome_coupon_min_order: number | null
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string
          accepted_payment_methods?: string[] | null
          admin_accent_color?: string
          admin_blocked?: boolean
          admin_primary_color?: string
          ai_avatar_url?: string | null
          ai_chat_tone?: string
          ai_last_analysis_at?: string | null
          ai_name?: string | null
          banner_mobile_format?: string
          button_color?: string
          button_text_color?: string
          created_at?: string
          custom_domain?: string | null
          domain_last_check?: string | null
          domain_status?: string
          domain_verify_details?: Json | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          gateway_environment?: string
          gateway_public_key?: string | null
          gateway_secret_key?: string | null
          google_maps_url?: string | null
          header_bg_color?: string
          header_text_color?: string | null
          id?: string
          instagram_url?: string | null
          installments_free_up_to?: number
          installments_interest_enabled?: boolean
          installments_interest_rate?: number
          is_verified?: boolean | null
          language?: string
          logo_size?: number
          logo_url?: string | null
          low_stock_threshold?: number
          marquee_bg_color?: string
          marquee_enabled?: boolean
          marquee_speed?: number
          marquee_text?: string | null
          marquee_text_color?: string
          max_installments?: number
          page_bg_color?: string | null
          payment_boleto?: boolean
          payment_credit_card?: boolean
          payment_debit_card?: boolean
          payment_gateway?: string | null
          payment_pix?: boolean
          primary_color?: string
          promo_banner_enabled?: boolean
          promo_banner_link?: string | null
          promo_banner_text?: string | null
          secondary_color?: string
          sell_via_whatsapp?: boolean
          shipping_base_cost?: number
          shipping_enabled?: boolean
          shipping_flat_rate?: number | null
          shipping_free_above?: number | null
          shipping_per_km?: number
          store_address?: string | null
          store_blocked?: boolean
          store_category?: string | null
          store_cep?: string | null
          store_description?: string | null
          store_location?: string | null
          store_name?: string
          store_open?: boolean
          store_phone?: string | null
          store_slug?: string | null
          store_whatsapp?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          welcome_coupon_discount_type?: string
          welcome_coupon_discount_value?: number
          welcome_coupon_enabled?: boolean
          welcome_coupon_expires_days?: number
          welcome_coupon_min_order?: number | null
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string
          accepted_payment_methods?: string[] | null
          admin_accent_color?: string
          admin_blocked?: boolean
          admin_primary_color?: string
          ai_avatar_url?: string | null
          ai_chat_tone?: string
          ai_last_analysis_at?: string | null
          ai_name?: string | null
          banner_mobile_format?: string
          button_color?: string
          button_text_color?: string
          created_at?: string
          custom_domain?: string | null
          domain_last_check?: string | null
          domain_status?: string
          domain_verify_details?: Json | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_bg_color?: string
          footer_text_color?: string
          gateway_environment?: string
          gateway_public_key?: string | null
          gateway_secret_key?: string | null
          google_maps_url?: string | null
          header_bg_color?: string
          header_text_color?: string | null
          id?: string
          instagram_url?: string | null
          installments_free_up_to?: number
          installments_interest_enabled?: boolean
          installments_interest_rate?: number
          is_verified?: boolean | null
          language?: string
          logo_size?: number
          logo_url?: string | null
          low_stock_threshold?: number
          marquee_bg_color?: string
          marquee_enabled?: boolean
          marquee_speed?: number
          marquee_text?: string | null
          marquee_text_color?: string
          max_installments?: number
          page_bg_color?: string | null
          payment_boleto?: boolean
          payment_credit_card?: boolean
          payment_debit_card?: boolean
          payment_gateway?: string | null
          payment_pix?: boolean
          primary_color?: string
          promo_banner_enabled?: boolean
          promo_banner_link?: string | null
          promo_banner_text?: string | null
          secondary_color?: string
          sell_via_whatsapp?: boolean
          shipping_base_cost?: number
          shipping_enabled?: boolean
          shipping_flat_rate?: number | null
          shipping_free_above?: number | null
          shipping_per_km?: number
          store_address?: string | null
          store_blocked?: boolean
          store_category?: string | null
          store_cep?: string | null
          store_description?: string | null
          store_location?: string | null
          store_name?: string
          store_open?: boolean
          store_phone?: string | null
          store_slug?: string | null
          store_whatsapp?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          welcome_coupon_discount_type?: string
          welcome_coupon_discount_value?: number
          welcome_coupon_enabled?: boolean
          welcome_coupon_expires_days?: number
          welcome_coupon_min_order?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      store_theme_config: {
        Row: {
          background_color: string | null
          card_border_radius: number
          card_shadow: string
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          font_body: string
          font_heading: string
          footer_style: string
          header_style: string
          id: string
          layout_width: string
          primary_color: string | null
          product_grid_columns: number
          product_grid_columns_mobile: number
          product_grid_gap: number
          secondary_color: string | null
          text_color: string | null
          theme_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          card_border_radius?: number
          card_shadow?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_body?: string
          font_heading?: string
          footer_style?: string
          header_style?: string
          id?: string
          layout_width?: string
          primary_color?: string | null
          product_grid_columns?: number
          product_grid_columns_mobile?: number
          product_grid_gap?: number
          secondary_color?: string | null
          text_color?: string | null
          theme_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          card_border_radius?: number
          card_shadow?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_body?: string
          font_heading?: string
          footer_style?: string
          header_style?: string
          id?: string
          layout_width?: string
          primary_color?: string | null
          product_grid_columns?: number
          product_grid_columns_mobile?: number
          product_grid_gap?: number
          secondary_color?: string | null
          text_color?: string | null
          theme_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          is_active: boolean | null
          is_typing_admin: boolean | null
          is_typing_customer: boolean | null
          last_message_at: string | null
          session_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          is_typing_admin?: boolean | null
          is_typing_customer?: boolean | null
          last_message_at?: string | null
          session_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          is_typing_admin?: boolean | null
          is_typing_customer?: boolean | null
          last_message_at?: string | null
          session_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          id: string
          read_at: string | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_ai_brain_config: {
        Row: {
          ai_name: string | null
          approach_type: string | null
          approved_examples: string | null
          brand_identity: string | null
          created_at: string
          custom_instructions: string | null
          emoji_usage: string | null
          formality_level: string | null
          id: string
          language_preferences: string | null
          niche: string | null
          personality: string | null
          persuasion_style: string | null
          prohibitions: string | null
          sending_rules: string | null
          store_knowledge: Json | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
          writing_style: string | null
        }
        Insert: {
          ai_name?: string | null
          approach_type?: string | null
          approved_examples?: string | null
          brand_identity?: string | null
          created_at?: string
          custom_instructions?: string | null
          emoji_usage?: string | null
          formality_level?: string | null
          id?: string
          language_preferences?: string | null
          niche?: string | null
          personality?: string | null
          persuasion_style?: string | null
          prohibitions?: string | null
          sending_rules?: string | null
          store_knowledge?: Json | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
          writing_style?: string | null
        }
        Update: {
          ai_name?: string | null
          approach_type?: string | null
          approved_examples?: string | null
          brand_identity?: string | null
          created_at?: string
          custom_instructions?: string | null
          emoji_usage?: string | null
          formality_level?: string | null
          id?: string
          language_preferences?: string | null
          niche?: string | null
          personality?: string | null
          persuasion_style?: string | null
          prohibitions?: string | null
          sending_rules?: string | null
          store_knowledge?: Json | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id?: string
          writing_style?: string | null
        }
        Relationships: []
      }
      tenant_ai_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_messages: {
        Row: {
          audience_type: string
          body: string | null
          channel: string
          created_at: string
          delivered_count: number
          failed_count: number
          id: string
          is_global: boolean
          message_type: string
          priority: string
          sender_type: string
          sender_user_id: string
          source_tenant_id: string
          status: string
          target_area: string
          target_slug: string | null
          target_tenant_id: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          audience_type: string
          body?: string | null
          channel?: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          is_global?: boolean
          message_type?: string
          priority?: string
          sender_type?: string
          sender_user_id: string
          source_tenant_id: string
          status?: string
          target_area?: string
          target_slug?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          audience_type?: string
          body?: string | null
          channel?: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          is_global?: boolean
          message_type?: string
          priority?: string
          sender_type?: string
          sender_user_id?: string
          source_tenant_id?: string
          status?: string
          target_area?: string
          target_slug?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      tenant_plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          max_orders_month: number
          max_products: number
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_orders_month?: number
          max_products?: number
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_orders_month?: number
          max_products?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          downgrade_applied_at: string | null
          feature_overrides: Json
          id: string
          plan_id: string
          plan_reminders_sent: number[]
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          downgrade_applied_at?: string | null
          feature_overrides?: Json
          id?: string
          plan_id: string
          plan_reminders_sent?: number[]
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          downgrade_applied_at?: string | null
          feature_overrides?: Json
          id?: string
          plan_id?: string
          plan_reminders_sent?: number[]
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tenant_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_name: string | null
          id: string | null
          image_urls: string[] | null
          is_verified_purchase: boolean | null
          product_id: string | null
          rating: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string | null
          image_urls?: string[] | null
          is_verified_purchase?: never
          product_id?: string | null
          rating?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string | null
          image_urls?: string[] | null
          is_verified_purchase?: never
          product_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_domains_public: {
        Row: {
          hostname: string | null
          id: string | null
          is_primary: boolean | null
          is_published: boolean | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          hostname?: string | null
          id?: string | null
          is_primary?: boolean | null
          is_published?: boolean | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          hostname?: string | null
          id?: string | null
          is_primary?: boolean | null
          is_published?: boolean | null
          status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      store_marketing_config_public: {
        Row: {
          announcement_bar_bg_color: string | null
          announcement_bar_enabled: boolean | null
          announcement_bar_link: string | null
          announcement_bar_text: string | null
          announcement_bar_text_color: string | null
          countdown_bg_color: string | null
          countdown_enabled: boolean | null
          countdown_end_date: string | null
          countdown_text: string | null
          countdown_text_color: string | null
          created_at: string | null
          free_shipping_bar_color: string | null
          free_shipping_bar_enabled: boolean | null
          free_shipping_threshold: number | null
          id: string | null
          popup_coupon_code: string | null
          popup_coupon_delay_seconds: number | null
          popup_coupon_description: string | null
          popup_coupon_enabled: boolean | null
          popup_coupon_image_url: string | null
          popup_coupon_title: string | null
          trust_badges: Json | null
          trust_badges_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          announcement_bar_bg_color?: string | null
          announcement_bar_enabled?: boolean | null
          announcement_bar_link?: string | null
          announcement_bar_text?: string | null
          announcement_bar_text_color?: string | null
          countdown_bg_color?: string | null
          countdown_enabled?: boolean | null
          countdown_end_date?: string | null
          countdown_text?: string | null
          countdown_text_color?: string | null
          created_at?: string | null
          free_shipping_bar_color?: string | null
          free_shipping_bar_enabled?: boolean | null
          free_shipping_threshold?: number | null
          id?: string | null
          popup_coupon_code?: string | null
          popup_coupon_delay_seconds?: number | null
          popup_coupon_description?: string | null
          popup_coupon_enabled?: boolean | null
          popup_coupon_image_url?: string | null
          popup_coupon_title?: string | null
          trust_badges?: Json | null
          trust_badges_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          announcement_bar_bg_color?: string | null
          announcement_bar_enabled?: boolean | null
          announcement_bar_link?: string | null
          announcement_bar_text?: string | null
          announcement_bar_text_color?: string | null
          countdown_bg_color?: string | null
          countdown_enabled?: boolean | null
          countdown_end_date?: string | null
          countdown_text?: string | null
          countdown_text_color?: string | null
          created_at?: string | null
          free_shipping_bar_color?: string | null
          free_shipping_bar_enabled?: boolean | null
          free_shipping_threshold?: number | null
          id?: string | null
          popup_coupon_code?: string | null
          popup_coupon_delay_seconds?: number | null
          popup_coupon_description?: string | null
          popup_coupon_enabled?: boolean | null
          popup_coupon_image_url?: string | null
          popup_coupon_title?: string | null
          trust_badges?: Json | null
          trust_badges_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      store_settings_public: {
        Row: {
          accent_color: string | null
          admin_accent_color: string | null
          admin_blocked: boolean | null
          admin_primary_color: string | null
          ai_avatar_url: string | null
          ai_chat_tone: string | null
          ai_name: string | null
          banner_mobile_format: string | null
          button_color: string | null
          button_text_color: string | null
          created_at: string | null
          custom_domain: string | null
          domain_last_check: string | null
          domain_status: string | null
          facebook_url: string | null
          favicon_url: string | null
          footer_bg_color: string | null
          footer_text_color: string | null
          gateway_environment: string | null
          gateway_public_key: string | null
          google_maps_url: string | null
          header_bg_color: string | null
          header_text_color: string | null
          id: string | null
          instagram_url: string | null
          is_premium_plan: boolean | null
          is_pro_plan: boolean | null
          is_verified: boolean | null
          logo_size: number | null
          logo_url: string | null
          low_stock_threshold: number | null
          marquee_bg_color: string | null
          marquee_enabled: boolean | null
          marquee_speed: number | null
          marquee_text: string | null
          marquee_text_color: string | null
          max_installments: number | null
          page_bg_color: string | null
          payment_boleto: boolean | null
          payment_credit_card: boolean | null
          payment_debit_card: boolean | null
          payment_gateway: string | null
          payment_pix: boolean | null
          plan_name: string | null
          primary_color: string | null
          secondary_color: string | null
          sell_via_whatsapp: boolean | null
          shipping_base_cost: number | null
          shipping_enabled: boolean | null
          shipping_flat_rate: number | null
          shipping_free_above: number | null
          shipping_per_km: number | null
          store_address: string | null
          store_blocked: boolean | null
          store_cep: string | null
          store_description: string | null
          store_location: string | null
          store_name: string | null
          store_open: boolean | null
          store_phone: string | null
          store_slug: string | null
          store_whatsapp: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          welcome_coupon_discount_type: string | null
          welcome_coupon_discount_value: number | null
          welcome_coupon_enabled: boolean | null
          welcome_coupon_expires_days: number | null
          welcome_coupon_min_order: number | null
          youtube_url: string | null
        }
        Relationships: []
      }
      store_settings_safe: {
        Row: {
          accent_color: string | null
          admin_accent_color: string | null
          admin_blocked: boolean | null
          admin_primary_color: string | null
          ai_avatar_url: string | null
          ai_chat_tone: string | null
          ai_last_analysis_at: string | null
          ai_name: string | null
          banner_mobile_format: string | null
          button_color: string | null
          button_text_color: string | null
          created_at: string | null
          custom_domain: string | null
          domain_last_check: string | null
          domain_status: string | null
          domain_verify_details: Json | null
          facebook_url: string | null
          favicon_url: string | null
          footer_bg_color: string | null
          footer_text_color: string | null
          gateway_environment: string | null
          gateway_public_key: string | null
          google_maps_url: string | null
          header_bg_color: string | null
          header_text_color: string | null
          id: string | null
          instagram_url: string | null
          is_verified: boolean | null
          language: string | null
          logo_size: number | null
          logo_url: string | null
          low_stock_threshold: number | null
          marquee_bg_color: string | null
          marquee_enabled: boolean | null
          marquee_speed: number | null
          marquee_text: string | null
          marquee_text_color: string | null
          max_installments: number | null
          page_bg_color: string | null
          payment_boleto: boolean | null
          payment_credit_card: boolean | null
          payment_debit_card: boolean | null
          payment_gateway: string | null
          payment_pix: boolean | null
          primary_color: string | null
          promo_banner_enabled: boolean | null
          promo_banner_link: string | null
          promo_banner_text: string | null
          secondary_color: string | null
          sell_via_whatsapp: boolean | null
          shipping_base_cost: number | null
          shipping_enabled: boolean | null
          shipping_flat_rate: number | null
          shipping_free_above: number | null
          shipping_per_km: number | null
          store_address: string | null
          store_blocked: boolean | null
          store_category: string | null
          store_cep: string | null
          store_description: string | null
          store_location: string | null
          store_name: string | null
          store_open: boolean | null
          store_phone: string | null
          store_slug: string | null
          store_whatsapp: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          welcome_coupon_discount_type: string | null
          welcome_coupon_discount_value: number | null
          welcome_coupon_enabled: boolean | null
          welcome_coupon_expires_days: number | null
          welcome_coupon_min_order: number | null
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string | null
          admin_accent_color?: string | null
          admin_blocked?: boolean | null
          admin_primary_color?: string | null
          ai_avatar_url?: string | null
          ai_chat_tone?: string | null
          ai_last_analysis_at?: string | null
          ai_name?: string | null
          banner_mobile_format?: string | null
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string | null
          custom_domain?: string | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verify_details?: Json | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          gateway_environment?: string | null
          gateway_public_key?: string | null
          google_maps_url?: string | null
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string | null
          instagram_url?: string | null
          is_verified?: boolean | null
          language?: string | null
          logo_size?: number | null
          logo_url?: string | null
          low_stock_threshold?: number | null
          marquee_bg_color?: string | null
          marquee_enabled?: boolean | null
          marquee_speed?: number | null
          marquee_text?: string | null
          marquee_text_color?: string | null
          max_installments?: number | null
          page_bg_color?: string | null
          payment_boleto?: boolean | null
          payment_credit_card?: boolean | null
          payment_debit_card?: boolean | null
          payment_gateway?: string | null
          payment_pix?: boolean | null
          primary_color?: string | null
          promo_banner_enabled?: boolean | null
          promo_banner_link?: string | null
          promo_banner_text?: string | null
          secondary_color?: string | null
          sell_via_whatsapp?: boolean | null
          shipping_base_cost?: number | null
          shipping_enabled?: boolean | null
          shipping_flat_rate?: number | null
          shipping_free_above?: number | null
          shipping_per_km?: number | null
          store_address?: string | null
          store_blocked?: boolean | null
          store_category?: string | null
          store_cep?: string | null
          store_description?: string | null
          store_location?: string | null
          store_name?: string | null
          store_open?: boolean | null
          store_phone?: string | null
          store_slug?: string | null
          store_whatsapp?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          welcome_coupon_discount_type?: string | null
          welcome_coupon_discount_value?: number | null
          welcome_coupon_enabled?: boolean | null
          welcome_coupon_expires_days?: number | null
          welcome_coupon_min_order?: number | null
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string | null
          admin_accent_color?: string | null
          admin_blocked?: boolean | null
          admin_primary_color?: string | null
          ai_avatar_url?: string | null
          ai_chat_tone?: string | null
          ai_last_analysis_at?: string | null
          ai_name?: string | null
          banner_mobile_format?: string | null
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string | null
          custom_domain?: string | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verify_details?: Json | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          gateway_environment?: string | null
          gateway_public_key?: string | null
          google_maps_url?: string | null
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string | null
          instagram_url?: string | null
          is_verified?: boolean | null
          language?: string | null
          logo_size?: number | null
          logo_url?: string | null
          low_stock_threshold?: number | null
          marquee_bg_color?: string | null
          marquee_enabled?: boolean | null
          marquee_speed?: number | null
          marquee_text?: string | null
          marquee_text_color?: string | null
          max_installments?: number | null
          page_bg_color?: string | null
          payment_boleto?: boolean | null
          payment_credit_card?: boolean | null
          payment_debit_card?: boolean | null
          payment_gateway?: string | null
          payment_pix?: boolean | null
          primary_color?: string | null
          promo_banner_enabled?: boolean | null
          promo_banner_link?: string | null
          promo_banner_text?: string | null
          secondary_color?: string | null
          sell_via_whatsapp?: boolean | null
          shipping_base_cost?: number | null
          shipping_enabled?: boolean | null
          shipping_flat_rate?: number | null
          shipping_free_above?: number | null
          shipping_per_km?: number | null
          store_address?: string | null
          store_blocked?: boolean | null
          store_category?: string | null
          store_cep?: string | null
          store_description?: string | null
          store_location?: string | null
          store_name?: string | null
          store_open?: boolean | null
          store_phone?: string | null
          store_slug?: string | null
          store_whatsapp?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          welcome_coupon_discount_type?: string | null
          welcome_coupon_discount_value?: number | null
          welcome_coupon_enabled?: boolean | null
          welcome_coupon_expires_days?: number | null
          welcome_coupon_min_order?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_loyalty_points: {
        Args: {
          p_customer_id: string
          p_order_id: string
          p_order_total: number
          p_store_user_id: string
        }
        Returns: undefined
      }
      can_send_message: {
        Args: {
          p_body: string
          p_cooldown_minutes?: number
          p_target_id: string
          p_title: string
        }
        Returns: boolean
      }
      check_hostname_exists: { Args: { _hostname: string }; Returns: boolean }
      check_pending_domains: { Args: never; Returns: undefined }
      create_default_segments: {
        Args: { _user_id: string }
        Returns: undefined
      }
      customer_email_exists_globally: {
        Args: { _email: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_customer_by_referral_code: {
        Args: { _code: string; _store_user_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      get_ai_work_summary: { Args: { p_user_id: string }; Returns: Json }
      get_best_selling_products: {
        Args: { _limit?: number; _store_user_id: string }
        Returns: {
          product_id: string
          total_sold: number
        }[]
      }
      get_dashboard_stats: { Args: { p_user_id: string }; Returns: Json }
      get_platform_banner_config_public: {
        Args: never
        Returns: {
          key: string
          value: Json
        }[]
      }
      get_store_rich_insights: { Args: { p_user_id: string }; Returns: Json }
      get_store_sales_stats: { Args: { p_user_id: string }; Returns: Json }
      get_storefront_banner_status: {
        Args: { _user_id: string }
        Returns: {
          is_premium: boolean
          promo_banner_enabled: boolean
          user_id: string
        }[]
      }
      get_super_admin_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { _coupon_code: string; _store_user_id: string }
        Returns: boolean
      }
      increment_customer_view_count: {
        Args: { p_customer_id: string; p_product_id: string }
        Returns: undefined
      }
      increment_product_views: {
        Args: { product_id: string }
        Returns: undefined
      }
      increment_referral_click:
        | { Args: { _code: string }; Returns: boolean }
        | {
            Args: { _code: string; _ip?: string; _ua?: string }
            Returns: boolean
          }
      is_collaborator: {
        Args: { owner_id: string; required_roles?: string[] }
        Returns: boolean
      }
      lookup_profile_for_invite: {
        Args: { _email: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      match_customer_insights: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_customer_id: string
          p_tenant_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          id: string
          insight: string
          similarity: number
        }[]
      }
      match_tenant_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_category?: string
          p_tenant_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_referral_approval: {
        Args: { _referred_user_id: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_loyalty_points: {
        Args: {
          p_customer_id: string
          p_points: number
          p_store_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "super_admin" | "tenant"
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
      app_role: ["super_admin", "tenant"],
    },
  },
} as const
