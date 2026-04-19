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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          condition: string
          cooldown_minutes: number
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          labels: Json | null
          metric_name: string
          name: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          condition: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          labels?: Json | null
          metric_name: string
          name: string
          severity?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          condition?: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          labels?: Json | null
          metric_name?: string
          name?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      collected_events: {
        Row: {
          agent_id: string
          count: number | null
          created_at: string
          event_type: string
          first_timestamp: string | null
          id: string
          involved_object: string | null
          labels: Json | null
          last_timestamp: string | null
          message: string
          namespace: string | null
          reason: string
          source_component: string | null
        }
        Insert: {
          agent_id: string
          count?: number | null
          created_at?: string
          event_type: string
          first_timestamp?: string | null
          id?: string
          involved_object?: string | null
          labels?: Json | null
          last_timestamp?: string | null
          message: string
          namespace?: string | null
          reason: string
          source_component?: string | null
        }
        Update: {
          agent_id?: string
          count?: number | null
          created_at?: string
          event_type?: string
          first_timestamp?: string | null
          id?: string
          involved_object?: string | null
          labels?: Json | null
          last_timestamp?: string | null
          message?: string
          namespace?: string | null
          reason?: string
          source_component?: string | null
        }
        Relationships: []
      }
      collected_logs: {
        Row: {
          agent_id: string
          container_name: string | null
          created_at: string
          id: string
          labels: Json | null
          log_level: string | null
          message: string
          namespace: string | null
          pod_name: string | null
          source: string | null
          timestamp: string
        }
        Insert: {
          agent_id: string
          container_name?: string | null
          created_at?: string
          id?: string
          labels?: Json | null
          log_level?: string | null
          message: string
          namespace?: string | null
          pod_name?: string | null
          source?: string | null
          timestamp?: string
        }
        Update: {
          agent_id?: string
          container_name?: string | null
          created_at?: string
          id?: string
          labels?: Json | null
          log_level?: string | null
          message?: string
          namespace?: string | null
          pod_name?: string | null
          source?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      collected_metrics: {
        Row: {
          agent_id: string
          container_name: string | null
          created_at: string
          id: string
          labels: Json | null
          metric_name: string
          metric_type: string
          namespace: string | null
          node_name: string | null
          pod_name: string | null
          timestamp: string
          unit: string | null
          value: number
        }
        Insert: {
          agent_id: string
          container_name?: string | null
          created_at?: string
          id?: string
          labels?: Json | null
          metric_name: string
          metric_type: string
          namespace?: string | null
          node_name?: string | null
          pod_name?: string | null
          timestamp?: string
          unit?: string | null
          value: number
        }
        Update: {
          agent_id?: string
          container_name?: string | null
          created_at?: string
          id?: string
          labels?: Json | null
          metric_name?: string
          metric_type?: string
          namespace?: string | null
          node_name?: string | null
          pod_name?: string | null
          timestamp?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      monitoring_agents: {
        Row: {
          agent_id: string
          agent_name: string
          agent_type: string
          cluster_name: string | null
          created_at: string
          id: string
          ip_address: string | null
          last_heartbeat: string | null
          metadata: Json | null
          namespace: string | null
          node_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_name: string
          agent_type: string
          cluster_name?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          namespace?: string | null
          node_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_name?: string
          agent_type?: string
          cluster_name?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          namespace?: string | null
          node_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          channel_type: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          severity_filter: string[]
          updated_at: string
        }
        Insert: {
          channel_type: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          severity_filter?: string[]
          updated_at?: string
        }
        Update: {
          channel_type?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          severity_filter?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      jira_automation_settings: {
        Row: {
          created_at: string
          due_days: number
          enabled: boolean
          id: string
          issue_type: string
          jira_base_url: string | null
          jira_project_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_days?: number
          enabled?: boolean
          id?: string
          issue_type?: string
          jira_base_url?: string | null
          jira_project_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_days?: number
          enabled?: boolean
          id?: string
          issue_type?: string
          jira_base_url?: string | null
          jira_project_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jira_resource_tickets: {
        Row: {
          created_at: string
          creator_email: string | null
          creator_name: string | null
          due_date: string
          error_message: string | null
          id: string
          issue_type: string | null
          jira_issue_key: string | null
          jira_issue_url: string | null
          jira_project_key: string | null
          metadata: Json
          provider: string
          resource_name: string
          resource_type: string
          source_log_id: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_email?: string | null
          creator_name?: string | null
          due_date: string
          error_message?: string | null
          id?: string
          issue_type?: string | null
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          jira_project_key?: string | null
          metadata?: Json
          provider?: string
          resource_name: string
          resource_type: string
          source_log_id?: string | null
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_email?: string | null
          creator_name?: string | null
          due_date?: string
          error_message?: string | null
          id?: string
          issue_type?: string | null
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          jira_project_key?: string | null
          metadata?: Json
          provider?: string
          resource_name?: string
          resource_type?: string
          source_log_id?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jira_resource_tickets_source_log_id_fkey"
            columns: ["source_log_id"]
            isOneToOne: false
            referencedRelation: "collected_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      triggered_alerts: {
        Row: {
          acknowledged_at: string | null
          agent_id: string | null
          created_at: string
          id: string
          message: string
          metric_value: number
          namespace: string | null
          node_name: string | null
          pod_name: string | null
          resolved_at: string | null
          rule_id: string | null
          severity: string
          status: string
          threshold: number
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          message: string
          metric_value: number
          namespace?: string | null
          node_name?: string | null
          pod_name?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity: string
          status?: string
          threshold: number
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          message?: string
          metric_value?: number
          namespace?: string | null
          node_name?: string | null
          pod_name?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string
          status?: string
          threshold?: number
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "triggered_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: "viewer" | "operator" | "admin"
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: "viewer" | "operator" | "admin"
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: "viewer" | "operator" | "admin"
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_cron_job: {
        Args: { function_name: string; job_name: string; job_schedule: string }
        Returns: number
      }
      delete_cron_job: { Args: { job_name: string }; Returns: undefined }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      toggle_cron_job: {
        Args: { is_active: boolean; job_id: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "viewer" | "operator" | "admin"
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
    Enums: {},
  },
} as const
