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
          project_id: string | null;
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
          project_id?: string | null;
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
          project_id?: string | null;
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
          {
            foreignKeyName: "activities_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      approvals: {
        Row: {
          approver_type: Database["public"]["Enums"]["approval_approver"];
          client_contact_id: string | null;
          client_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by_user_id: string | null;
          decision_note: string | null;
          evidence_url: string | null;
          id: string;
          project_id: string;
          requested_by: string | null;
          status: Database["public"]["Enums"]["approval_status"];
          subject: Database["public"]["Enums"]["approval_subject"];
          task_id: string | null;
          title: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          approver_type: Database["public"]["Enums"]["approval_approver"];
          client_contact_id?: string | null;
          client_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by_user_id?: string | null;
          decision_note?: string | null;
          evidence_url?: string | null;
          id?: string;
          project_id: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["approval_status"];
          subject?: Database["public"]["Enums"]["approval_subject"];
          task_id?: string | null;
          title: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          approver_type?: Database["public"]["Enums"]["approval_approver"];
          client_contact_id?: string | null;
          client_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by_user_id?: string | null;
          decision_note?: string | null;
          evidence_url?: string | null;
          id?: string;
          project_id?: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["approval_status"];
          subject?: Database["public"]["Enums"]["approval_subject"];
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_client_contact_fkey";
            columns: ["client_id", "client_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "approvals_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "project_progress";
            referencedColumns: ["workspace_id", "project_id"];
          },
          {
            foreignKeyName: "approvals_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "approvals_task_fkey";
            columns: ["project_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "project_tasks";
            referencedColumns: ["project_id", "id"];
          },
          {
            foreignKeyName: "approvals_task_fkey";
            columns: ["project_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "task_readiness";
            referencedColumns: ["project_id", "task_id"];
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
      client_input_requests: {
        Row: {
          blocks_task_id: string | null;
          created_at: string;
          decided_at: string | null;
          description: string | null;
          drive_url: string | null;
          id: string;
          input_kind: Database["public"]["Enums"]["input_kind"];
          key: string;
          label: string;
          project_id: string;
          received_at: string | null;
          requested_at: string;
          required: boolean;
          response_text: string | null;
          source_template_id: string | null;
          status: Database["public"]["Enums"]["input_request_status"];
          updated_at: string;
          version: number;
          waive_reason: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          blocks_task_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          description?: string | null;
          drive_url?: string | null;
          id?: string;
          input_kind: Database["public"]["Enums"]["input_kind"];
          key: string;
          label: string;
          project_id: string;
          received_at?: string | null;
          requested_at?: string;
          required?: boolean;
          response_text?: string | null;
          source_template_id?: string | null;
          status?: Database["public"]["Enums"]["input_request_status"];
          updated_at?: string;
          version?: number;
          waive_reason?: string | null;
          workspace_id: string;
        };
        Update: {
          blocks_task_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          description?: string | null;
          drive_url?: string | null;
          id?: string;
          input_kind?: Database["public"]["Enums"]["input_kind"];
          key?: string;
          label?: string;
          project_id?: string;
          received_at?: string | null;
          requested_at?: string;
          required?: boolean;
          response_text?: string | null;
          source_template_id?: string | null;
          status?: Database["public"]["Enums"]["input_request_status"];
          updated_at?: string;
          version?: number;
          waive_reason?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_input_requests_blocks_fkey";
            columns: ["project_id", "blocks_task_id"];
            isOneToOne: false;
            referencedRelation: "project_tasks";
            referencedColumns: ["project_id", "id"];
          },
          {
            foreignKeyName: "client_input_requests_blocks_fkey";
            columns: ["project_id", "blocks_task_id"];
            isOneToOne: false;
            referencedRelation: "task_readiness";
            referencedColumns: ["project_id", "task_id"];
          },
          {
            foreignKeyName: "client_input_requests_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "project_progress";
            referencedColumns: ["workspace_id", "project_id"];
          },
          {
            foreignKeyName: "client_input_requests_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "client_input_requests_source_template_id_fkey";
            columns: ["source_template_id"];
            isOneToOne: false;
            referencedRelation: "input_templates";
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
      project_tasks: {
        Row: {
          approval_approver: Database["public"]["Enums"]["approval_approver"] | null;
          assignee_user_id: string | null;
          cancel_reason: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_on: string | null;
          estimated_hours: number | null;
          id: string;
          key: string;
          phase: string | null;
          position: number;
          project_id: string;
          requires_approval: boolean;
          source_template_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          approval_approver?: Database["public"]["Enums"]["approval_approver"] | null;
          assignee_user_id?: string | null;
          cancel_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_on?: string | null;
          estimated_hours?: number | null;
          id?: string;
          key: string;
          phase?: string | null;
          position: number;
          project_id: string;
          requires_approval?: boolean;
          source_template_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          approval_approver?: Database["public"]["Enums"]["approval_approver"] | null;
          assignee_user_id?: string | null;
          cancel_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_on?: string | null;
          estimated_hours?: number | null;
          id?: string;
          key?: string;
          phase?: string | null;
          position?: number;
          project_id?: string;
          requires_approval?: boolean;
          source_template_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_fkey";
            columns: ["workspace_id", "assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "project_tasks_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "project_progress";
            referencedColumns: ["workspace_id", "project_id"];
          },
          {
            foreignKeyName: "project_tasks_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "project_tasks_source_template_id_fkey";
            columns: ["source_template_id"];
            isOneToOne: false;
            referencedRelation: "task_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          blueprint_version_id: string;
          client_id: string;
          created_at: string;
          generated_by: string | null;
          id: string;
          idempotency_key: string;
          lead_id: string | null;
          name: string;
          no_sow_reason: string | null;
          sow_id: string | null;
          start_on: string;
          status: Database["public"]["Enums"]["project_status"];
          target_end_on: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          blueprint_version_id: string;
          client_id: string;
          created_at?: string;
          generated_by?: string | null;
          id?: string;
          idempotency_key: string;
          lead_id?: string | null;
          name: string;
          no_sow_reason?: string | null;
          sow_id?: string | null;
          start_on: string;
          status?: Database["public"]["Enums"]["project_status"];
          target_end_on?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          blueprint_version_id?: string;
          client_id?: string;
          created_at?: string;
          generated_by?: string | null;
          id?: string;
          idempotency_key?: string;
          lead_id?: string | null;
          name?: string;
          no_sow_reason?: string | null;
          sow_id?: string | null;
          start_on?: string;
          status?: Database["public"]["Enums"]["project_status"];
          target_end_on?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_blueprint_version_fkey";
            columns: ["workspace_id", "blueprint_version_id"];
            isOneToOne: false;
            referencedRelation: "blueprint_versions";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "projects_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "projects_lead_fkey";
            columns: ["client_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "projects_sow_fkey";
            columns: ["client_id", "sow_id"];
            isOneToOne: false;
            referencedRelation: "sow_documents";
            referencedColumns: ["client_id", "id"];
          },
        ];
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
      sow_documents: {
        Row: {
          client_id: string;
          client_signatory: string | null;
          created_at: string;
          created_by: string | null;
          drive_url: string | null;
          id: string;
          scope_summary: string | null;
          signed_on: string | null;
          status: Database["public"]["Enums"]["sow_status"];
          supersedes_id: string | null;
          title: string;
          updated_at: string;
          version_label: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          client_signatory?: string | null;
          created_at?: string;
          created_by?: string | null;
          drive_url?: string | null;
          id?: string;
          scope_summary?: string | null;
          signed_on?: string | null;
          status?: Database["public"]["Enums"]["sow_status"];
          supersedes_id?: string | null;
          title: string;
          updated_at?: string;
          version_label?: string | null;
          workspace_id: string;
        };
        Update: {
          client_id?: string;
          client_signatory?: string | null;
          created_at?: string;
          created_by?: string | null;
          drive_url?: string | null;
          id?: string;
          scope_summary?: string | null;
          signed_on?: string | null;
          status?: Database["public"]["Enums"]["sow_status"];
          supersedes_id?: string | null;
          title?: string;
          updated_at?: string;
          version_label?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sow_documents_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "sow_documents_supersedes_fkey";
            columns: ["client_id", "supersedes_id"];
            isOneToOne: false;
            referencedRelation: "sow_documents";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      task_dependencies: {
        Row: {
          created_at: string;
          depends_on_task_id: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          depends_on_task_id: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          depends_on_task_id?: string;
          project_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_fkey";
            columns: ["project_id", "depends_on_task_id"];
            isOneToOne: false;
            referencedRelation: "project_tasks";
            referencedColumns: ["project_id", "id"];
          },
          {
            foreignKeyName: "task_dependencies_depends_on_fkey";
            columns: ["project_id", "depends_on_task_id"];
            isOneToOne: false;
            referencedRelation: "task_readiness";
            referencedColumns: ["project_id", "task_id"];
          },
          {
            foreignKeyName: "task_dependencies_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "project_progress";
            referencedColumns: ["workspace_id", "project_id"];
          },
          {
            foreignKeyName: "task_dependencies_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "task_dependencies_task_fkey";
            columns: ["project_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "project_tasks";
            referencedColumns: ["project_id", "id"];
          },
          {
            foreignKeyName: "task_dependencies_task_fkey";
            columns: ["project_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "task_readiness";
            referencedColumns: ["project_id", "task_id"];
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
      project_progress: {
        Row: {
          done_tasks: number | null;
          in_progress_tasks: number | null;
          in_review_tasks: number | null;
          on_hold_tasks: number | null;
          overdue_tasks: number | null;
          percent_done: number | null;
          project_id: string | null;
          total_tasks: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      task_readiness: {
        Row: {
          approval_satisfied: boolean | null;
          can_start: boolean | null;
          project_id: string | null;
          start_blockers: Json | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          task_id: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "project_progress";
            referencedColumns: ["workspace_id", "project_id"];
          },
          {
            foreignKeyName: "project_tasks_project_fkey";
            columns: ["workspace_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
    };
    Functions: {
      blueprint_version_problems: { Args: { p_version_id: string }; Returns: string[] };
      create_draft_version: {
        Args: { p_blueprint_id: string; p_from_version_id?: string };
        Returns: string;
      };
      decide_approval: {
        Args: {
          p_approval_id: string;
          p_client_contact_id?: string;
          p_decision: Database["public"]["Enums"]["approval_status"];
          p_evidence_url?: string;
          p_expected_version: number;
          p_note?: string;
        };
        Returns: undefined;
      };
      generate_project: {
        Args: {
          p_blueprint_version_id: string;
          p_client_id: string;
          p_idempotency_key: string;
          p_lead_id?: string;
          p_name: string;
          p_no_sow_reason?: string;
          p_sow_id?: string;
          p_start_on: string;
        };
        Returns: string;
      };
      move_pipeline_stage: { Args: { direction: number; stage_id: string }; Returns: undefined };
      publish_blueprint_version: {
        Args: { p_change_summary?: string; p_version_id: string };
        Returns: undefined;
      };
      request_approval: { Args: { p_task_id: string }; Returns: string };
      retire_blueprint_version: { Args: { p_version_id: string }; Returns: undefined };
      set_input_request_status: {
        Args: {
          p_drive_url?: string;
          p_expected_version: number;
          p_request_id: string;
          p_response_text?: string;
          p_to_status: Database["public"]["Enums"]["input_request_status"];
          p_waive_reason?: string;
        };
        Returns: number;
      };
      transition_task: {
        Args: {
          p_confirm_unblock?: boolean;
          p_expected_version: number;
          p_reason?: string;
          p_task_id: string;
          p_to_status: Database["public"]["Enums"]["task_status"];
        };
        Returns: number;
      };
    };
    Enums: {
      activity_type: "note" | "call" | "email" | "meeting";
      actor_type: "user" | "system" | "agent";
      approval_approver: "internal" | "client";
      approval_status: "pending" | "approved" | "rejected" | "withdrawn";
      approval_subject: "task" | "deliverable" | "project_phase";
      blueprint_version_status: "draft" | "published" | "retired";
      client_kind: "organization" | "individual";
      client_status: "prospect" | "active" | "paused" | "former";
      follow_up_status: "open" | "done" | "cancelled";
      input_kind: "file" | "text" | "access_confirmation" | "decision";
      input_request_status: "requested" | "received" | "accepted" | "rejected" | "waived";
      member_status: "active" | "suspended";
      project_status: "active" | "on_hold" | "completed" | "cancelled";
      sow_status: "draft" | "sent" | "signed" | "superseded" | "void";
      stage_kind: "open" | "won" | "lost";
      task_status: "todo" | "in_progress" | "in_review" | "on_hold" | "done" | "cancelled";
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
      approval_status: ["pending", "approved", "rejected", "withdrawn"],
      approval_subject: ["task", "deliverable", "project_phase"],
      blueprint_version_status: ["draft", "published", "retired"],
      client_kind: ["organization", "individual"],
      client_status: ["prospect", "active", "paused", "former"],
      follow_up_status: ["open", "done", "cancelled"],
      input_kind: ["file", "text", "access_confirmation", "decision"],
      input_request_status: ["requested", "received", "accepted", "rejected", "waived"],
      member_status: ["active", "suspended"],
      project_status: ["active", "on_hold", "completed", "cancelled"],
      sow_status: ["draft", "sent", "signed", "superseded", "void"],
      stage_kind: ["open", "won", "lost"],
      task_status: ["todo", "in_progress", "in_review", "on_hold", "done", "cancelled"],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const;
