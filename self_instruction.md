# Self Instruction Manual for Future Modifications

This document contains strict rules for myself to follow when updating or adding new features to this application. The goal is to maintain code quality, consistency, and a great user experience.

---

## 1. CSS & Theming: **Always Use CSS Variables**

**Golden Rule:** **NEVER** use hardcoded colors (e.g., `bg-red-500`, `text-gray-900`). This is non-negotiable. Every color must be theme-aware.

### The Process:

1.  **Identify the Need:** When adding a new UI element (a button, a card, a new text color), determine the colors it needs.
2.  **Check for Existing Variables:** Before writing any new CSS, look in `index.html` inside the `<style>` tag. Check both the `:root` (light mode) and `html.dark` (dark mode) sections for a variable that semantically matches your need (e.g., `--danger` for errors, `--accent-color` for primary actions, `--text-secondary` for muted text).
3.  **Create New Variables if Necessary:** If a suitable variable does not exist:
    *   **DO NOT** take a shortcut and use a Tailwind class like `bg-blue-500`.
    *   You **MUST** add a new variable to `index.html`.
    *   Define it for light mode in `:root`.
    *   Define its corresponding dark mode equivalent in `html.dark`. Choose colors that match the existing theme's aesthetic (e.g., brighter, more saturated colors for dark mode text/borders).
    *   Use a clear, semantic name (e.g., `--diff-added-bg`, `--chat-link-text`).
4.  **Implement:** Use your chosen (or newly created) variable in your CSS.
    *   **Example:** `background-color: var(--diff-added-bg);`

**Why?** This ensures that every single component automatically adapts to both light and dark modes, preventing unreadable text, jarring color clashes, and maintaining a professional, polished look across the entire application.

---

## 2. Database Modifications: **Context & Schema Migrations**

**Golden Rule:** Before making any changes to the database, edge functions, or backend logic, you **MUST** verify the current state using the reference API.

### The Process:

1.  **Fetch Latest Migration History:**
    *   Execute the following command via `shell_exec` to get the latest SQL history:
        `npx -y tsx -e "fetch('https://sql-migration.vercel.app/export.json', { headers: { 'x-api-key': 'sk_sync_b4k92jdm10' } }).then(res=>res.text()).then(console.log).catch(console.error)"`
2.  **Reference GitHub (Optional):**
    *   If edge function structure or further context is needed, refer to `https://api.github.com/repos/mubasshir12/SQL-Migration-/contents`.
3.  **Analyze & Implement:**
    *   Study the schema, functions, and triggers to avoid duplicates.
    *   Ensure all SQL is idempotent and maintains existing relationships.
4.  **Communicate and Document:**
    *   **Provide SQL in Chat:** Give the complete script to the user.
    *   **Update SQL Reference File:** Add the script to `database_sql.md`.

**Why?** This ensures synchronization with the remote migration history and prevents breaking changes or schema drift.

---
**Follow these rules strictly. No exceptions.**
