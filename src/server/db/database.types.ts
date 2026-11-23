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
      agent_deliveries: {
        Row: {
          attempts: number;
          created_at: string;
          delivered_at: string | null;
          last_error: string | null;
          message_id: string;
          sent_from: string;
          status: string;
          target: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          last_error?: string | null;
          message_id: string;
          sent_from: string;
          status?: string;
          target: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          last_error?: string | null;
          message_id?: string;
          sent_from?: string;
          status?: string;
          target?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_deliveries_message_fkey";
            columns: ["workspace_id", "message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      agent_work_items: {
        Row: {
          agent_id: string;
          client_id: string | null;
          context_options: NonNullable<Json>;
          context_snapshot: string | null;
          created_at: string;
          dispatched_at: string | null;
          dispatched_by: string | null;
          id: string;
          instructions: string;
          output_text: string | null;
          output_url: string | null;
          override_reason: string | null;
          prepared_by: string | null;
          project_id: string | null;
          returned_at: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          sensitivity_flags: Json | null;
          status: Database["public"]["Enums"]["work_item_status"];
          title: string;
          updated_at: string;
          version: number;
          work_type: Database["public"]["Enums"]["agent_work_type"];
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          agent_id: string;
          client_id?: string | null;
          context_options?: NonNullable<Json>;
          context_snapshot?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          id?: string;
          instructions: string;
          output_text?: string | null;
          output_url?: string | null;
          override_reason?: string | null;
          prepared_by?: string | null;
          project_id?: string | null;
          returned_at?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sensitivity_flags?: Json | null;
          status?: Database["public"]["Enums"]["work_item_status"];
          title: string;
          updated_at?: string;
          version?: number;
          work_type: Database["public"]["Enums"]["agent_work_type"];
          workspace_id: string;
        };
        Update: {
          agent_id?: string;
          client_id?: string | null;
          context_options?: NonNullable<Json>;
          context_snapshot?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          id?: string;
          instructions?: string;
          output_text?: string | null;
          output_url?: string | null;
          override_reason?: string | null;
          prepared_by?: string | null;
          project_id?: string | null;
          returned_at?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sensitivity_flags?: Json | null;
          status?: Database["public"]["Enums"]["work_item_status"];
          title?: string;
          updated_at?: string;
          version?: number;
          work_type?: Database["public"]["Enums"]["agent_work_type"];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_work_items_agent_fkey";
            columns: ["workspace_id", "agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "agent_work_items_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "agent_work_items_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      agents: {
        Row: {
          allowed_work_types: Database["public"]["Enums"]["agent_work_type"][];
          created_at: string;
          id: string;
          instructions: string | null;
          integration_state: string;
          is_active: boolean;
          key: string;
          kind: string;
          last_verified_at: string | null;
          model: string | null;
          name: string;
          provider: Database["public"]["Enums"]["ai_provider"];
          role_summary: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_work_types: Database["public"]["Enums"]["agent_work_type"][];
          created_at?: string;
          id?: string;
          instructions?: string | null;
          integration_state?: string;
          is_active?: boolean;
          key: string;
          kind?: string;
          last_verified_at?: string | null;
          model?: string | null;
          name: string;
          provider?: Database["public"]["Enums"]["ai_provider"];
          role_summary?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          allowed_work_types?: Database["public"]["Enums"]["agent_work_type"][];
          created_at?: string;
          id?: string;
          instructions?: string | null;
          integration_state?: string;
          is_active?: boolean;
          key?: string;
          kind?: string;
          last_verified_at?: string | null;
          model?: string | null;
          name?: string;
          provider?: Database["public"]["Enums"]["ai_provider"];
          role_summary?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_budgets: {
        Row: {
          monthly_cap_minor: number;
          provider: Database["public"]["Enums"]["ai_provider"];
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          monthly_cap_minor: number;
          provider: Database["public"]["Enums"]["ai_provider"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          monthly_cap_minor?: number;
          provider?: Database["public"]["Enums"]["ai_provider"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_budgets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          cost_microusd: number;
          id: number;
          input_tokens: number | null;
          note: string | null;
          occurred_at: string;
          output_tokens: number | null;
          provider: Database["public"]["Enums"]["ai_provider"];
          recorded_by: string | null;
          work_item_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          cost_microusd: number;
          id?: never;
          input_tokens?: number | null;
          note?: string | null;
          occurred_at?: string;
          output_tokens?: number | null;
          provider: Database["public"]["Enums"]["ai_provider"];
          recorded_by?: string | null;
          work_item_id?: string | null;
          workspace_id: string;
        };
        Update: {
          cost_microusd?: number;
          id?: never;
          input_tokens?: number | null;
          note?: string | null;
          occurred_at?: string;
          output_tokens?: number | null;
          provider?: Database["public"]["Enums"]["ai_provider"];
          recorded_by?: string | null;
          work_item_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_work_item_fkey";
            columns: ["workspace_id", "work_item_id"];
            isOneToOne: false;
            referencedRelation: "agent_work_items";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "ai_usage_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_responses: {
        Row: {
          approval_id: string;
          client_id: string;
          comment: string | null;
          created_at: string;
          decision: Database["public"]["Enums"]["approval_status"];
          id: string;
          responded_by: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          approval_id: string;
          client_id: string;
          comment?: string | null;
          created_at?: string;
          decision: Database["public"]["Enums"]["approval_status"];
          id?: string;
          responded_by?: string;
          workspace_id: string;
        };
        Update: {
          approval_id?: string;
          client_id?: string;
          comment?: string | null;
          created_at?: string;
          decision?: Database["public"]["Enums"]["approval_status"];
          id?: string;
          responded_by?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_responses_approval_id_fkey";
            columns: ["approval_id"];
            isOneToOne: true;
            referencedRelation: "approvals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_responses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_responses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
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
          decided_in_portal: boolean;
          decision_note: string | null;
          details: string | null;
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
          decided_in_portal?: boolean;
          decision_note?: string | null;
          details?: string | null;
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
          decided_in_portal?: boolean;
          decision_note?: string | null;
          details?: string | null;
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
            referencedRelation: "project_health";
            referencedColumns: ["workspace_id", "project_id"];
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
      chat_threads: {
        Row: {
          agent: string;
          created_at: string;
          created_by: string | null;
          id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          agent: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          workspace_id: string;
        };
        Update: {
          agent?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_threads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      client_files: {
        Row: {
          client_id: string;
          content_type: string | null;
          created_at: string;
          file_name: string;
          id: string;
          project_id: string | null;
          size_bytes: number | null;
          storage_path: string;
          title: string;
          uploaded_by: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          content_type?: string | null;
          created_at?: string;
          file_name: string;
          id?: string;
          project_id?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          title: string;
          uploaded_by?: string | null;
          workspace_id: string;
        };
        Update: {
          client_id?: string;
          content_type?: string | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          project_id?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          title?: string;
          uploaded_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_files_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "client_files_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
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
            referencedRelation: "project_health";
            referencedColumns: ["workspace_id", "project_id"];
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
      client_requests: {
        Row: {
          admin_reply: string | null;
          body: string;
          client_id: string;
          created_at: string;
          created_by: string;
          id: string;
          kind: Database["public"]["Enums"]["client_request_kind"];
          project_id: string | null;
          status: Database["public"]["Enums"]["client_request_status"];
          subject: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          admin_reply?: string | null;
          body: string;
          client_id: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind: Database["public"]["Enums"]["client_request_kind"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["client_request_status"];
          subject: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          admin_reply?: string | null;
          body?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["client_request_kind"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["client_request_status"];
          subject?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_requests_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "client_requests_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
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
      connection_brakes: {
        Row: {
          connection: string;
          hourly_limit: number;
          paused_at: string | null;
          paused_reason: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          connection: string;
          hourly_limit?: number;
          paused_at?: string | null;
          paused_reason?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          connection?: string;
          hourly_limit?: number;
          paused_at?: string | null;
          paused_reason?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connection_brakes_workspace_id_fkey";
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
      diagnostics: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          diagnostic_type: string;
          id: string;
          performed_by: string | null;
          performed_on: string;
          project_id: string | null;
          report_url: string | null;
          score: number | null;
          summary: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          diagnostic_type: string;
          id?: string;
          performed_by?: string | null;
          performed_on: string;
          project_id?: string | null;
          report_url?: string | null;
          score?: number | null;
          summary: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          diagnostic_type?: string;
          id?: string;
          performed_by?: string | null;
          performed_on?: string;
          project_id?: string | null;
          report_url?: string | null;
          score?: number | null;
          summary?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnostics_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "diagnostics_performer_fkey";
            columns: ["workspace_id", "performed_by"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "diagnostics_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
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
      invoices: {
        Row: {
          amount_minor: number;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_on: string | null;
          external_number: string;
          external_system: Database["public"]["Enums"]["invoice_system"];
          external_url: string | null;
          id: string;
          issued_on: string;
          notes: string | null;
          paid_on: string | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_minor: number;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_on?: string | null;
          external_number: string;
          external_system: Database["public"]["Enums"]["invoice_system"];
          external_url?: string | null;
          id?: string;
          issued_on: string;
          notes?: string | null;
          paid_on?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          amount_minor?: number;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_on?: string | null;
          external_number?: string;
          external_system?: Database["public"]["Enums"]["invoice_system"];
          external_url?: string | null;
          id?: string;
          issued_on?: string;
          notes?: string | null;
          paid_on?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "invoices_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      issues: {
        Row: {
          assignee_user_id: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          diagnostic_id: string | null;
          id: string;
          opened_at: string;
          project_id: string | null;
          resolution: string | null;
          resolved_at: string | null;
          severity: Database["public"]["Enums"]["issue_severity"];
          status: Database["public"]["Enums"]["issue_status"];
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_user_id?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diagnostic_id?: string | null;
          id?: string;
          opened_at?: string;
          project_id?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["issue_severity"];
          status?: Database["public"]["Enums"]["issue_status"];
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assignee_user_id?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diagnostic_id?: string | null;
          id?: string;
          opened_at?: string;
          project_id?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["issue_severity"];
          status?: Database["public"]["Enums"]["issue_status"];
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issues_assignee_fkey";
            columns: ["workspace_id", "assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "issues_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "issues_diagnostic_fkey";
            columns: ["client_id", "diagnostic_id"];
            isOneToOne: false;
            referencedRelation: "diagnostics";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "issues_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
          },
        ];
      };
      job_attempts: {
        Row: {
          attempt: number;
          error: string | null;
          finished_at: string | null;
          id: number;
          job_id: string;
          outcome: string;
          started_at: string;
          worker: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt: number;
          error?: string | null;
          finished_at?: string | null;
          id?: never;
          job_id: string;
          outcome?: string;
          started_at?: string;
          worker: string;
          workspace_id: string;
        };
        Update: {
          attempt?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: never;
          job_id?: string;
          outcome?: string;
          started_at?: string;
          worker?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_attempts_job_fkey";
            columns: ["workspace_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      job_dispatches: {
        Row: {
          attempt: number;
          code_sha256: string;
          connection: string;
          dispatched_at: string;
          expected_from: string;
          expires_at: string;
          job_id: string;
          used_at: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt: number;
          code_sha256: string;
          connection: string;
          dispatched_at?: string;
          expected_from: string;
          expires_at: string;
          job_id: string;
          used_at?: string | null;
          workspace_id: string;
        };
        Update: {
          attempt?: number;
          code_sha256?: string;
          connection?: string;
          dispatched_at?: string;
          expected_from?: string;
          expires_at?: string;
          job_id?: string;
          used_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_dispatches_job_fkey";
            columns: ["workspace_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      jobs: {
        Row: {
          agent_id: string | null;
          at_most_once: boolean;
          attempts: number;
          created_at: string;
          enqueued_by: string | null;
          external_ref: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string;
          kind: string;
          last_error: string | null;
          locked_by: string | null;
          locked_until: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          priority: number;
          result: Json | null;
          run_after: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          timeout_seconds: number;
          updated_at: string;
          waiting_until: string | null;
          work_item_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          agent_id?: string | null;
          at_most_once?: boolean;
          attempts?: number;
          created_at?: string;
          enqueued_by?: string | null;
          external_ref?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key: string;
          kind: string;
          last_error?: string | null;
          locked_by?: string | null;
          locked_until?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          priority?: number;
          result?: Json | null;
          run_after?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          timeout_seconds?: number;
          updated_at?: string;
          waiting_until?: string | null;
          work_item_id?: string | null;
          workspace_id: string;
        };
        Update: {
          agent_id?: string | null;
          at_most_once?: boolean;
          attempts?: number;
          created_at?: string;
          enqueued_by?: string | null;
          external_ref?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string;
          kind?: string;
          last_error?: string | null;
          locked_by?: string | null;
          locked_until?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          priority?: number;
          result?: Json | null;
          run_after?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          timeout_seconds?: number;
          updated_at?: string;
          waiting_until?: string | null;
          work_item_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_agent_fkey";
            columns: ["workspace_id", "agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "jobs_work_item_fkey";
            columns: ["workspace_id", "work_item_id"];
            isOneToOne: false;
            referencedRelation: "agent_work_items";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
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
          {
            foreignKeyName: "leads_stage_fkey";
            columns: ["workspace_id", "stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_summary";
            referencedColumns: ["workspace_id", "stage_id"];
          },
        ];
      };
      messages: {
        Row: {
          agent_status: string | null;
          author: string;
          author_user_id: string | null;
          body: string;
          created_at: string;
          flagged: boolean;
          id: string;
          in_reply_to: string | null;
          job_id: string | null;
          kind: string;
          links: Json | null;
          recipient: string | null;
          thread_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          agent_status?: string | null;
          author: string;
          author_user_id?: string | null;
          body: string;
          created_at?: string;
          flagged?: boolean;
          id?: string;
          in_reply_to?: string | null;
          job_id?: string | null;
          kind?: string;
          links?: Json | null;
          recipient?: string | null;
          thread_id?: string | null;
          workspace_id: string;
        };
        Update: {
          agent_status?: string | null;
          author?: string;
          author_user_id?: string | null;
          body?: string;
          created_at?: string;
          flagged?: boolean;
          id?: string;
          in_reply_to?: string | null;
          job_id?: string | null;
          kind?: string;
          links?: Json | null;
          recipient?: string | null;
          thread_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_in_reply_to_fkey";
            columns: ["workspace_id", "in_reply_to"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "messages_job_fkey";
            columns: ["workspace_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "messages_thread_fkey";
            columns: ["workspace_id", "thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
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
          client_id: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          role: Database["public"]["Enums"]["account_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id?: string | null;
          created_at?: string;
          display_name: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
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
            referencedRelation: "project_health";
            referencedColumns: ["workspace_id", "project_id"];
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
          blueprint_version_id: string | null;
          client_id: string;
          created_at: string;
          current_phase: string | null;
          generated_by: string | null;
          id: string;
          idempotency_key: string;
          launch_on: string | null;
          lead_id: string | null;
          name: string;
          next_steps: string | null;
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
          blueprint_version_id?: string | null;
          client_id: string;
          created_at?: string;
          current_phase?: string | null;
          generated_by?: string | null;
          id?: string;
          idempotency_key: string;
          launch_on?: string | null;
          lead_id?: string | null;
          name: string;
          next_steps?: string | null;
          no_sow_reason?: string | null;
          sow_id?: string | null;
          start_on: string;
          status?: Database["public"]["Enums"]["project_status"];
          target_end_on?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          blueprint_version_id?: string | null;
          client_id?: string;
          created_at?: string;
          current_phase?: string | null;
          generated_by?: string | null;
          id?: string;
          idempotency_key?: string;
          launch_on?: string | null;
          lead_id?: string | null;
          name?: string;
          next_steps?: string | null;
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
      proposed_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"];
          client_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          details: string;
          evidence_url: string | null;
          executed_at: string | null;
          executed_by: string | null;
          execution_note: string | null;
          id: string;
          requested_by: string | null;
          status: Database["public"]["Enums"]["action_status"];
          target: string | null;
          title: string;
          updated_at: string;
          version: number;
          work_item_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"];
          client_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          details: string;
          evidence_url?: string | null;
          executed_at?: string | null;
          executed_by?: string | null;
          execution_note?: string | null;
          id?: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["action_status"];
          target?: string | null;
          title: string;
          updated_at?: string;
          version?: number;
          work_item_id?: string | null;
          workspace_id: string;
        };
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"];
          client_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          details?: string;
          evidence_url?: string | null;
          executed_at?: string | null;
          executed_by?: string | null;
          execution_note?: string | null;
          id?: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["action_status"];
          target?: string | null;
          title?: string;
          updated_at?: string;
          version?: number;
          work_item_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposed_actions_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "proposed_actions_work_item_fkey";
            columns: ["workspace_id", "work_item_id"];
            isOneToOne: false;
            referencedRelation: "agent_work_items";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "proposed_actions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      result_rows: {
        Row: {
          job_id: string | null;
          outcome: string;
          reason: string | null;
          row_key: string;
          seen_at: string;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          job_id?: string | null;
          outcome: string;
          reason?: string | null;
          row_key: string;
          seen_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          job_id?: string | null;
          outcome?: string;
          reason?: string | null;
          row_key?: string;
          seen_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "result_rows_job_fkey";
            columns: ["workspace_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "result_rows_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      routine_runs: {
        Row: {
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          evidence_url: string | null;
          id: string;
          notes: string | null;
          routine_id: string;
          scheduled_for: string;
          status: Database["public"]["Enums"]["routine_run_status"];
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          evidence_url?: string | null;
          id?: string;
          notes?: string | null;
          routine_id: string;
          scheduled_for: string;
          status?: Database["public"]["Enums"]["routine_run_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          evidence_url?: string | null;
          id?: string;
          notes?: string | null;
          routine_id?: string;
          scheduled_for?: string;
          status?: Database["public"]["Enums"]["routine_run_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routine_runs_routine_fkey";
            columns: ["workspace_id", "routine_id"];
            isOneToOne: false;
            referencedRelation: "routine_compliance";
            referencedColumns: ["workspace_id", "routine_id"];
          },
          {
            foreignKeyName: "routine_runs_routine_fkey";
            columns: ["workspace_id", "routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      routines: {
        Row: {
          anchor_on: string;
          cadence: Database["public"]["Enums"]["routine_cadence"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          interval_count: number;
          is_active: boolean;
          name: string;
          next_due_on: string | null;
          owner_user_id: string | null;
          project_id: string | null;
          runbook_url: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          anchor_on: string;
          cadence: Database["public"]["Enums"]["routine_cadence"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interval_count?: number;
          is_active?: boolean;
          name: string;
          next_due_on?: string | null;
          owner_user_id?: string | null;
          project_id?: string | null;
          runbook_url?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          anchor_on?: string;
          cadence?: Database["public"]["Enums"]["routine_cadence"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interval_count?: number;
          is_active?: boolean;
          name?: string;
          next_due_on?: string | null;
          owner_user_id?: string | null;
          project_id?: string | null;
          runbook_url?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routines_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "routines_owner_fkey";
            columns: ["workspace_id", "owner_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "routines_project_fkey";
            columns: ["client_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["client_id", "id"];
          },
          {
            foreignKeyName: "routines_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
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
            referencedRelation: "project_health";
            referencedColumns: ["workspace_id", "project_id"];
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
          ai_pause_reason: string | null;
          ai_paused_at: string | null;
          ai_paused_by: string | null;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_pause_reason?: string | null;
          ai_paused_at?: string | null;
          ai_paused_by?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          ai_pause_reason?: string | null;
          ai_paused_at?: string | null;
          ai_paused_by?: string | null;
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
      ai_spend_this_month: {
        Row: {
          monthly_cap_minor: number | null;
          provider: Database["public"]["Enums"]["ai_provider"] | null;
          remaining_microusd: number | null;
          spent_microusd: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ai_budgets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      open_issues_by_severity: {
        Row: {
          oldest_opened_at: string | null;
          open_count: number | null;
          severity: Database["public"]["Enums"]["issue_severity"] | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      overdue_tasks: {
        Row: {
          assignee_user_id: string | null;
          days_overdue: number | null;
          due_on: string | null;
          project_id: string | null;
          project_name: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          task_id: string | null;
          title: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_fkey";
            columns: ["workspace_id", "assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      pipeline_summary: {
        Row: {
          estimated_value_minor: number | null;
          kind: Database["public"]["Enums"]["stage_kind"] | null;
          lead_count: number | null;
          position: number | null;
          stage_id: string | null;
          stage_name: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
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
      project_health: {
        Row: {
          blocked_tasks: number | null;
          client_name: string | null;
          done_tasks: number | null;
          name: string | null;
          open_inputs: number | null;
          overdue_tasks: number | null;
          pending_approvals: number | null;
          percent_done: number | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["project_status"] | null;
          target_end_on: string | null;
          total_tasks: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
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
      receivables_by_status: {
        Row: {
          amount_minor: number | null;
          currency: string | null;
          invoice_count: number | null;
          status: Database["public"]["Enums"]["invoice_status"] | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      routine_compliance: {
        Row: {
          cadence: Database["public"]["Enums"]["routine_cadence"] | null;
          client_id: string | null;
          compliance_percent: number | null;
          done_runs: number | null;
          due_runs: number | null;
          failed_runs: number | null;
          is_active: boolean | null;
          missed_runs: number | null;
          name: string | null;
          routine_id: string | null;
          skipped_runs: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "routines_client_fkey";
            columns: ["workspace_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "routines_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
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
            referencedRelation: "project_health";
            referencedColumns: ["workspace_id", "project_id"];
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
        ];
      };
    };
    Functions: {
      add_project_task: {
        Args: { p_due_on?: string; p_phase?: string; p_project_id: string; p_title: string };
        Returns: string;
      };
      attach_portal_user: {
        Args: { p_client_id: string; p_display_name: string; p_email?: string; p_user_id: string };
        Returns: undefined;
      };
      blueprint_version_problems: { Args: { p_version_id: string }; Returns: string[] };
      cancel_job: { Args: { p_id: string }; Returns: undefined };
      claim_agent_delivery: { Args: { p_message_id: string }; Returns: boolean };
      create_client_approval: {
        Args: { p_details?: string; p_project_id: string; p_title: string };
        Returns: string;
      };
      create_draft_version: {
        Args: { p_blueprint_id: string; p_from_version_id?: string };
        Returns: string;
      };
      create_portal_project: {
        Args: { p_client_id: string; p_launch_on?: string; p_name: string; p_start_on: string };
        Returns: string;
      };
      decide_action: {
        Args: {
          p_decision: Database["public"]["Enums"]["action_status"];
          p_expected_version: number;
          p_id: string;
          p_note?: string;
        };
        Returns: number;
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
      detach_portal_user: { Args: { p_user_id: string }; Returns: undefined };
      enqueue_job: {
        Args: {
          p_agent_id?: string;
          p_idempotency_key: string;
          p_kind: string;
          p_max_attempts?: number;
          p_payload?: Json;
          p_run_after?: string;
          p_work_item_id?: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      finish_agent_delivery: {
        Args: { p_attempts: number; p_delivered: boolean; p_error?: string; p_message_id: string };
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
      generate_routine_runs: {
        Args: { p_through?: string; p_workspace_id: string };
        Returns: number;
      };
      mark_action_executed: {
        Args: { p_expected_version: number; p_id: string; p_note?: string };
        Returns: number;
      };
      move_pipeline_stage: { Args: { direction: number; stage_id: string }; Returns: undefined };
      portal_client: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          timezone: string;
        }[];
      };
      publish_blueprint_version: {
        Args: { p_change_summary?: string; p_version_id: string };
        Returns: undefined;
      };
      record_agent_reply: {
        Args: {
          p_author: string;
          p_body: string;
          p_in_reply_to: string;
          p_kind?: string;
          p_links?: Json;
          p_status: string;
          p_thread_id: string;
        };
        Returns: {
          duplicate: boolean;
          message_id: string;
        }[];
      };
      request_approval: { Args: { p_task_id: string }; Returns: string };
      resume_connection: {
        Args: { p_connection: string; p_workspace_id: string };
        Returns: undefined;
      };
      retire_blueprint_version: { Args: { p_version_id: string }; Returns: undefined };
      retry_job: { Args: { p_id: string }; Returns: undefined };
      route_agent_message: { Args: { p_message_id: string; p_target: string }; Returns: boolean };
      send_agent_message: {
        Args: { p_agent: string; p_body: string; p_flagged?: boolean; p_workspace_id: string };
        Returns: {
          message_id: string;
          thread_id: string;
        }[];
      };
      send_message: {
        Args: { p_body: string; p_flagged?: boolean; p_recipient?: string; p_workspace_id: string };
        Returns: string;
      };
      set_ai_paused: {
        Args: { p_paused: boolean; p_reason?: string; p_workspace_id: string };
        Returns: undefined;
      };
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
      transition_work_item: {
        Args: {
          p_expected_version: number;
          p_id: string;
          p_output_text?: string;
          p_output_url?: string;
          p_override_reason?: string;
          p_review_note?: string;
          p_to: Database["public"]["Enums"]["work_item_status"];
        };
        Returns: number;
      };
    };
    Enums: {
      account_role: "admin" | "client";
      action_status: "pending" | "approved" | "rejected" | "executed" | "cancelled";
      action_type:
        "send_email" | "deploy" | "price_quote" | "sign_contract" | "publish_content" | "other";
      activity_type: "note" | "call" | "email" | "meeting";
      actor_type: "user" | "system" | "agent";
      agent_work_type:
        "research" | "draft_message" | "plan" | "code" | "qa" | "operations" | "other";
      ai_provider: "manual" | "xai" | "anthropic" | "perplexity" | "openrouter" | "openai";
      approval_approver: "internal" | "client";
      approval_status: "pending" | "approved" | "rejected" | "withdrawn";
      approval_subject: "task" | "deliverable" | "project_phase";
      blueprint_version_status: "draft" | "published" | "retired";
      client_kind: "organization" | "individual";
      client_request_kind: "change" | "question";
      client_request_status: "open" | "in_progress" | "done" | "declined";
      client_status: "prospect" | "active" | "paused" | "former";
      follow_up_status: "open" | "done" | "cancelled";
      input_kind: "file" | "text" | "access_confirmation" | "decision";
      input_request_status: "requested" | "received" | "accepted" | "rejected" | "waived";
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void";
      invoice_system: "quickbooks" | "stripe" | "wave" | "xero" | "freshbooks" | "other";
      issue_severity: "low" | "medium" | "high" | "critical";
      issue_status: "open" | "triaged" | "in_progress" | "resolved" | "wont_fix";
      job_status:
        "queued" | "running" | "waiting_external" | "succeeded" | "failed" | "dead" | "cancelled";
      member_status: "active" | "suspended";
      project_status: "active" | "on_hold" | "completed" | "cancelled";
      routine_cadence: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
      routine_run_status: "pending" | "done" | "skipped" | "failed";
      sow_status: "draft" | "sent" | "signed" | "superseded" | "void";
      stage_kind: "open" | "won" | "lost";
      task_status: "todo" | "in_progress" | "in_review" | "on_hold" | "done" | "cancelled";
      work_item_status:
        "draft" | "ready" | "dispatched" | "returned" | "accepted" | "rejected" | "cancelled";
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
      account_role: ["admin", "client"],
      action_status: ["pending", "approved", "rejected", "executed", "cancelled"],
      action_type: [
        "send_email",
        "deploy",
        "price_quote",
        "sign_contract",
        "publish_content",
        "other",
      ],
      activity_type: ["note", "call", "email", "meeting"],
      actor_type: ["user", "system", "agent"],
      agent_work_type: ["research", "draft_message", "plan", "code", "qa", "operations", "other"],
      ai_provider: ["manual", "xai", "anthropic", "perplexity", "openrouter", "openai"],
      approval_approver: ["internal", "client"],
      approval_status: ["pending", "approved", "rejected", "withdrawn"],
      approval_subject: ["task", "deliverable", "project_phase"],
      blueprint_version_status: ["draft", "published", "retired"],
      client_kind: ["organization", "individual"],
      client_request_kind: ["change", "question"],
      client_request_status: ["open", "in_progress", "done", "declined"],
      client_status: ["prospect", "active", "paused", "former"],
      follow_up_status: ["open", "done", "cancelled"],
      input_kind: ["file", "text", "access_confirmation", "decision"],
      input_request_status: ["requested", "received", "accepted", "rejected", "waived"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      invoice_system: ["quickbooks", "stripe", "wave", "xero", "freshbooks", "other"],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: ["open", "triaged", "in_progress", "resolved", "wont_fix"],
      job_status: [
        "queued",
        "running",
        "waiting_external",
        "succeeded",
        "failed",
        "dead",
        "cancelled",
      ],
      member_status: ["active", "suspended"],
      project_status: ["active", "on_hold", "completed", "cancelled"],
      routine_cadence: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      routine_run_status: ["pending", "done", "skipped", "failed"],
      sow_status: ["draft", "sent", "signed", "superseded", "void"],
      stage_kind: ["open", "won", "lost"],
      task_status: ["todo", "in_progress", "in_review", "on_hold", "done", "cancelled"],
      work_item_status: [
        "draft",
        "ready",
        "dispatched",
        "returned",
        "accepted",
        "rejected",
        "cancelled",
      ],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const;
