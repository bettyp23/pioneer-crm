export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          body: string | null;
          client_id: string;
          contact_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          lead_id: string | null;
          occurred_at: string;
          subject: string;
          type: Database["public"]["Enums"]["activity_type"];
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          client_id: string;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          lead_id?: string | null;
          occurred_at?: string;
          subject: string;
          type: Database["public"]["Enums"]["activity_type"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          client_id?: string;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          lead_id?: string | null;
          occurred_at?: string;
          subject?: string;
          type?: Database["public"]["Enums"]["activity_type"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "activities_contact_fkey";
            columns: ["client_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "activities_lead_fkey";
            columns: ["client_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_agent_id: string | null;
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id: string | null;
          changes: Json | null;
          context: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: number;
          occurred_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_agent_id?: string | null;
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          changes?: Json | null;
          context?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          occurred_at?: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_agent_id?: string | null;
          actor_type?: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          changes?: Json | null;
          context?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          occurred_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          drive_folder_url: string | null;
          id: string;
          industry: string | null;
          kind: Database["public"]["Enums"]["client_kind"];
          legal_name: string | null;
          name: string;
          notes: string | null;
          status: Database["public"]["Enums"]["client_status"];
          updated_at: string;
          website_url: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          drive_folder_url?: string | null;
          id?: string;
          industry?: string | null;
          kind?: Database["public"]["Enums"]["client_kind"];
          legal_name?: string | null;
          name: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          updated_at?: string;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          drive_folder_url?: string | null;
          id?: string;
          industry?: string | null;
          kind?: Database["public"]["Enums"]["client_kind"];
          legal_name?: string | null;
          name?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          updated_at?: string;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          archived_at: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          first_name: string;
          id: string;
          is_primary: boolean;
          job_title: string | null;
          last_name: string | null;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          first_name: string;
          id?: string;
          is_primary?: boolean;
          job_title?: string | null;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          first_name?: string;
          id?: string;
          is_primary?: boolean;
          job_title?: string | null;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      follow_ups: {
        Row: {
          assignee_user_id: string | null;
          client_id: string;
          completed_at: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          due_on: string;
          id: string;
          lead_id: string | null;
          status: Database["public"]["Enums"]["follow_up_status"];
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_user_id?: string | null;
          client_id: string;
          completed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_on: string;
          id?: string;
          lead_id?: string | null;
          status?: Database["public"]["Enums"]["follow_up_status"];
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assignee_user_id?: string | null;
          client_id?: string;
          completed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_on?: string;
          id?: string;
          lead_id?: string | null;
          status?: Database["public"]["Enums"]["follow_up_status"];
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follow_ups_assignee_fkey";
            columns: ["workspace_id", "assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "follow_ups_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "follow_ups_contact_fkey";
            columns: ["client_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "follow_ups_lead_fkey";
            columns: ["client_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      leads: {
        Row: {
          archived_at: string | null;
          client_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          estimated_value_minor: number | null;
          expected_close_on: string | null;
          id: string;
          lost_reason: string | null;
          owner_user_id: string | null;
          primary_contact_id: string | null;
          source: string | null;
          stage_id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          client_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          estimated_value_minor?: number | null;
          expected_close_on?: string | null;
          id?: string;
          lost_reason?: string | null;
          owner_user_id?: string | null;
          primary_contact_id?: string | null;
          source?: string | null;
          stage_id: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          client_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          estimated_value_minor?: number | null;
          expected_close_on?: string | null;
          id?: string;
          lost_reason?: string | null;
          owner_user_id?: string | null;
          primary_contact_id?: string | null;
          source?: string | null;
          stage_id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "leads_owner_fkey";
            columns: ["workspace_id", "owner_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "leads_primary_contact_fkey";
            columns: ["client_id", "primary_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "leads_stage_fkey";
            columns: ["workspace_id", "stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      pipeline_stages: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["stage_kind"];
          name: string;
          position: number;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["stage_kind"];
          name: string;
          position: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["stage_kind"];
          name?: string;
          position?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      move_pipeline_stage: { Args: { direction: number; stage_id: string }; Returns: undefined };
    };
    Enums: {
      activity_type: "note" | "call" | "email" | "meeting";
      actor_type: "user" | "system" | "agent";
      client_kind: "organization" | "individual";
      client_status: "prospect" | "active" | "paused" | "former";
      follow_up_status: "open" | "done" | "cancelled";
      member_status: "active" | "suspended";
      stage_kind: "open" | "won" | "lost";
      workspace_role: "owner" | "admin" | "member" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_type: ["note", "call", "email", "meeting"],
      actor_type: ["user", "system", "agent"],
      client_kind: ["organization", "individual"],
      client_status: ["prospect", "active", "paused", "former"],
      follow_up_status: ["open", "done", "cancelled"],
      member_status: ["active", "suspended"],
      stage_kind: ["open", "won", "lost"],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const;
