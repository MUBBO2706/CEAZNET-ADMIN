# AI Agent Database Context & Schema Migrations

**Reference API URL (SQL Exports):** `https://sql-migration.vercel.app/export.json`
**API Key:** `sk_sync_b4k92jdm10`

## Guidelines for AI Agent
Whenever the user requests changes related to the database, edge functions, or backend logic:
1. **You MUST** hit the Reference API URL to fetch the latest migration/SQL history. Because it requires authentication, you must use `shell_exec` with this exact command:
   `npx -y tsx -e "fetch('https://sql-migration.vercel.app/export.json', { headers: { 'x-api-key': 'sk_sync_b4k92jdm10' } }).then(res=>res.text()).then(console.log).catch(console.error)"`
2. Carefully read the JSON contents to understand the existing schema, functions, triggers, rules, and relationships.
3. **CRITICAL INDEXING RULE**: To match the frontend Task Manager UI numbering exactly, **DO NOT** date-sort the JSON array. The UI displays the tasks by reversing the JSON array as-is. So, to find a UI Task by its visible number (e.g. Task 32), you should process the array locally using:
   `const queries = data.sql_queries.reverse();` (Then Task 32 will be `queries[31]`).
4. Keep all queries idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Drop incorrect configurations first rather than blindly updating if you spot an anomaly in earlier tasks.
5. **MASTER QUERY CONSOLIDATION RULE**: 
   - Instead of creating incremental/iterative migration tasks, you MUST prioritize merging new schema changes (New Tables, RLS, Functions, Triggers, Edge Functions logic) into the **existing relevant master tasks**.
   - Your goal is to keep the migration history clean and minimal. 
   - When a new feature is requested, identify the most relevant existing SQL Task entry and return the **entire updated master query** in a code block. This allows the user to replace the old query with the new idempotent one in the management UI.
   - Only suggest creating a *new* task if merging into existing ones would cause fundamental structural conflicts or extreme complexity.
6. **FRONTEND COMPATIBILITY & REPO REFERENCE**:
   - Before any code or database modification, you MUST refer to the **Ceznet Client App repository** (`https://github.com/mubasshir12/Ceaznet`) to ensure that your changes keep both the Frontend and Admin Panel fully compatible and compiled.
7. **SCHEMA VERIFICATION**:
   - Always fetch the latest schema of the project named **"Ceaznet database schema"** via the Vercel API before performing any logic or database modifications to maintain a single source of truth.
