import "server-only";

// Maps Postgres/PostgREST errors to user-facing messages (docs/architecture.md §5).
// Known constraint names get specific text; unknown errors are logged with their code only
// (never record contents) and shown generically.

type DbError = { code?: string; message?: string; details?: string | null };

const CONSTRAINT_MESSAGES: Record<string, string> = {
  clients_name_not_blank: "Enter a client name.",
  clients_website_url_https: "Website must start with https://",
  clients_drive_folder_url_google:
    "Drive folder must be a https://drive.google.com or https://docs.google.com link.",
  contacts_email_format: "Enter a valid email address.",
  contacts_primary_not_archived: "An archived contact can't be the primary contact.",
  leads_lost_reason_required: "Add a reason when marking a lead as lost.",
  leads_primary_contact_fkey: "The contact must belong to this client.",
  leads_owner_fkey: "The owner must be a member of this workspace.",
  follow_ups_assignee_fkey: "The assignee must be a member of this workspace.",
  activities_lead_fkey: "The lead must belong to this client.",
  activities_contact_fkey: "The contact must belong to this client.",
  pipeline_stages_position_key: "Another stage already has that position.",
  services_code_key: "Another service already uses that code.",
  task_templates_key_key: "Another task already uses that key.",
  input_templates_key_key: "Another input already uses that key.",
  task_templates_approver_iff_required: "Choose who approves the task.",
  task_template_dependencies_not_self: "A task can't depend on itself.",
  package_services_service_fkey: "Choose a service from this workspace.",
  workspace_members_last_owner: "A workspace must keep at least one active owner.",
};

export function toUserMessage(error: DbError, context: string): string {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  for (const [constraint, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(constraint)) return message;
  }
  // Our own database functions and triggers raise messages written for users
  // (e.g. "Dependencies form a cycle…"); built-in violations start with "new row"/"duplicate".
  const message = error.message ?? "";
  if (
    (error.code === "23514" || error.code === "23505" || error.code === "P0001") &&
    message &&
    !/^(new row|duplicate key|null value|value too long)/.test(message)
  ) {
    return message;
  }
  switch (error.code) {
    case "42501":
    case "PGRST116":
      return "You don't have permission to do that.";
    case "23503":
      if (text.includes("pipeline_stages")) return "This stage is still used by leads.";
      return "A linked record is missing or belongs to another workspace.";
    case "23505":
      return "That record already exists.";
    case "23514":
      return "Some values aren't allowed. Check the form and try again.";
  }
  console.error(`${context}.failed`, { code: error.code });
  return "Something went wrong. Try again.";
}
