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
      blueprint_versions: {
        Row: {
          blueprint_id: string;
          change_summary: string | null;
          content_hash: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          published_at: string | null;
          published_by: string | null;
          retired_at: string | null;
          status: Database["public"]["Enums"]["blueprint_version_status"];
          updated_at: string;
          version_number: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          blueprint_id: string;
          change_summary?: string | null;
          content_hash?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          status?: Database["public"]["Enums"]["blueprint_version_status"];
          updated_at?: string;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          blueprint_id?: string;
          change_summary?: string | null;
          content_hash?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          status?: Database["public"]["Enums"]["blueprint_version_status"];
          updated_at?: string;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blueprint_versions_blueprint_fkey";
            columns: ["workspace_id", "blueprint_id"];
            isOneToOne: false;
            referencedRelation: "blueprints";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      blueprints: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          service_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          service_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          service_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blueprints_service_fkey";
            columns: ["workspace_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "blueprints_workspace_id_fkey";
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
      input_templates: {
        Row: {
          blocks_task_template_id: string | null;
          blueprint_version_id: string;
          created_at: string;
          description: string | null;
          id: string;
          input_kind: Database["public"]["Enums"]["input_kind"];
          key: string;
          label: string;
          required: boolean;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          blocks_task_template_id?: string | null;
          blueprint_version_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          input_kind: Database["public"]["Enums"]["input_kind"];
          key: string;
          label: string;
          required?: boolean;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          blocks_task_template_id?: string | null;
          blueprint_version_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          input_kind?: Database["public"]["Enums"]["input_kind"];
          key?: string;
          label?: string;
          required?: boolean;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "input_templates_blocks_fkey";
            columns: ["blueprint_version_id", "blocks_task_template_id"];
            isOneToOne: false;
            referencedRelation: "task_templates";
            referencedColumns: ["blueprint_version_id", "id"];
          },
          {
            foreignKeyName: "input_templates_version_fkey";
            columns: ["workspace_id", "blueprint_version_id"];
            isOneToOne: false;
            referencedRelation: "blueprint_versions";
            referencedColumns: ["workspace_id", "id"];
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
      package_services: {
        Row: {
          created_at: string;
          package_id: string;
          position: number;
          quantity: number;
          service_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          package_id: string;
          position?: number;
          quantity?: number;
          service_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          package_id?: string;
          position?: number;
          quantity?: number;
          service_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_services_package_fkey";
            columns: ["workspace_id", "package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "package_services_service_fkey";
            columns: ["workspace_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      packages: {
        Row: {
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          list_price_minor: number | null;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          list_price_minor?: number | null;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          list_price_minor?: number | null;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
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
      services: {
        Row: {
          category: string | null;
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          list_price_minor: number | null;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          list_price_minor?: number | null;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          category?: string | null;
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          list_price_minor?: number | null;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      task_template_dependencies: {
        Row: {
          blueprint_version_id: string;
          created_at: string;
          depends_on_id: string;
          task_template_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          blueprint_version_id: string;
          created_at?: string;
          depends_on_id: string;
          task_template_id: string;
          workspace_id: string;
        };
        Update: {
          blueprint_version_id?: string;
          created_at?: string;
          depends_on_id?: string;
          task_template_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_template_dependencies_depends_on_fkey";
            columns: ["blueprint_version_id", "depends_on_id"];
            isOneToOne: false;
            referencedRelation: "task_templates";
            referencedColumns: ["blueprint_version_id", "id"];
          },
          {
            foreignKeyName: "task_template_dependencies_task_fkey";
            columns: ["blueprint_version_id", "task_template_id"];
            isOneToOne: false;
            referencedRelation: "task_templates";
            referencedColumns: ["blueprint_version_id", "id"];
          },
          {
            foreignKeyName: "task_template_dependencies_version_fkey";
            columns: ["workspace_id", "blueprint_version_id"];
            isOneToOne: false;
            referencedRelation: "blueprint_versions";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      task_templates: {
        Row: {
          approval_approver: Database["public"]["Enums"]["approval_approver"] | null;
          blueprint_version_id: string;
          created_at: string;
          description: string | null;
          due_offset_days: number | null;
          estimated_hours: number | null;
          id: string;
          key: string;
          phase: string | null;
          position: number;
          requires_approval: boolean;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          approval_approver?: Database["public"]["Enums"]["approval_approver"] | null;
          blueprint_version_id: string;
          created_at?: string;
          description?: string | null;
          due_offset_days?: number | null;
          estimated_hours?: number | null;
          id?: string;
          key: string;
          phase?: string | null;
          position?: number;
          requires_approval?: boolean;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          approval_approver?: Database["public"]["Enums"]["approval_approver"] | null;
          blueprint_version_id?: string;
          created_at?: string;
          description?: string | null;
          due_offset_days?: number | null;
          estimated_hours?: number | null;
          id?: string;
          key?: string;
          phase?: string | null;
          position?: number;
          requires_approval?: boolean;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_templates_version_fkey";
            columns: ["workspace_id", "blueprint_version_id"];
            isOneToOne: false;
            referencedRelation: "blueprint_versions";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
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
      blueprint_version_problems: { Args: { p_version_id: string }; Returns: string[] };
      create_draft_version: {
        Args: { p_blueprint_id: string; p_from_version_id?: string };
        Returns: string;
      };
      move_pipeline_stage: { Args: { direction: number; stage_id: string }; Returns: undefined };
      publish_blueprint_version: {
        Args: { p_change_summary?: string; p_version_id: string };
        Returns: undefined;
      };
      retire_blueprint_version: { Args: { p_version_id: string }; Returns: undefined };
    };
    Enums: {
      activity_type: "note" | "call" | "email" | "meeting";
      actor_type: "user" | "system" | "agent";
      approval_approver: "internal" | "client";
      blueprint_version_status: "draft" | "published" | "retired";
      client_kind: "organization" | "individual";
      client_status: "prospect" | "active" | "paused" | "former";
      follow_up_status: "open" | "done" | "cancelled";
      input_kind: "file" | "text" | "access_confirmation" | "decision";
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
      approval_approver: ["internal", "client"],
      blueprint_version_status: ["draft", "published", "retired"],
      client_kind: ["organization", "individual"],
      client_status: ["prospect", "active", "paused", "former"],
      follow_up_status: ["open", "done", "cancelled"],
      input_kind: ["file", "text", "access_confirmation", "decision"],
      member_status: ["active", "suspended"],
      stage_kind: ["open", "won", "lost"],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const;
