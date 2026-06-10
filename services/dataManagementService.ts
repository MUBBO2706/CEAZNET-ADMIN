import type { TableDetails } from '../types';
import { dbMain } from './supabaseService';


/**
 * Calls a Supabase RPC function to reset the ID (identity) sequence of a given table in the MAIN database.
 * The next inserted row will have ID 1.
 * Requires a PostgreSQL function 'admin_reset_sequence' to exist in the database.
 * @param tableName The name of the table (e.g., 'update_news_logs').
 */
export async function resetTableSequence(tableName: string) {
    return await dbMain.rpc('admin_reset_sequence', { target_table_name: tableName });
}

/**
 * Calls a Supabase RPC function to truncate a given table in the MAIN database, deleting all its data.
 * This is a highly destructive operation.
 * Requires a PostgreSQL function 'admin_truncate_table' to exist in the database.
 * @param tableName The name of the table (e.g., 'update_news_logs').
 */
export async function resetTableData(tableName: string) {
    return await dbMain.rpc('admin_truncate_table', { target_table_name: tableName });
}

/**
 * Calls a Supabase RPC function to drop a given table in the MAIN database.
 * This is a highly destructive operation.
 * Requires a PostgreSQL function 'admin_drop_table' to exist in the database.
 * @param tableName The name of the table (e.g., 'update_news_logs').
 */
export async function dropTable(tableName: string) {
    return await dbMain.rpc('admin_drop_table', { target_table_name: tableName });
}

/**
 * Fetches basic details for a given table from the Main database.
 * @param tableName The name of the table.
 */
export async function fetchAllTables(): Promise<{ data: { name: string, has_sequence?: boolean }[] | null, error: any }> {
    try {
        const { data, error } = await dbMain.rpc('get_all_tables');
        if (error) throw error;
        
        const tables = data.map((item: any) => {
            if (typeof item === 'string') {
                return { name: item };
            }
            return { name: item.table_name, has_sequence: item.has_sequence };
        });
        return { data: tables, error: null };
    } catch (error) {
        console.error("Error fetching all tables:", error);
        return { data: null, error };
    }
}

/**
 * Fetches basic details for a given table from the Main database.
 * @param tableName The name of the table.
 * @param limit Number of rows to fetch (default 30).
 * @param offset Number of rows to skip (default 0).
 */
export async function fetchTableDetails(tableName: string, limit: number = 30, offset: number = 0): Promise<{ data: TableDetails | null, error: any }> {
    try {
        // Try ordering by created_at descending first (best for accurate recent rows, especially with UUID tables)
        let rowsRes = await dbMain.from(tableName).select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        
        // Fallback for tables without a 'created_at' column
        if (rowsRes.error) {
            rowsRes = await dbMain.from(tableName).select('*').order('id', { ascending: false }).range(offset, offset + limit - 1);
        }

        // Fallback for tables without an 'id' or 'created_at' column
        if (rowsRes.error) {
            rowsRes = await dbMain.from(tableName).select('*').range(offset, offset + limit - 1);
            if (rowsRes.error) throw rowsRes.error;
        }

        const countRes = await dbMain.from(tableName).select('*', { count: 'exact', head: true });
        if (countRes.error) throw countRes.error;

        const rowCount = countRes.count || 0;
        const recentRows = rowsRes.data || [];
        const columns = recentRows.length > 0 ? Object.keys(recentRows[0]) : [];

        return {
            data: {
                tableName,
                rowCount,
                columns,
                recentRows,
            },
            error: null,
        };
    } catch (error) {
        console.error(`Error fetching details for table ${tableName}:`, error);
        return { data: null, error };
    }
}

/**
 * Updates a specific row in a given table.
 * @param tableName The name of the table.
 * @param id The ID of the row to update.
 * @param updatedData The new data object.
 * @param idColumn The name of the ID column (defaults to 'id').
 */
export async function updateTableRow(tableName: string, id: string | number, updatedData: any, idColumn: string = 'id'): Promise<{ error: any }> {
    try {
        const { error } = await dbMain.from(tableName).update(updatedData).eq(idColumn, id);
        return { error };
    } catch (error) {
        console.error(`Error updating row ${id} in table ${tableName}:`, error);
        return { error };
    }
}