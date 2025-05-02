const { pool } = require("../config");

async function extractSchema() {
    try {
        // Step 1: Get all tables
        const tableQuery = `
            SELECT 
                t.table_name as name,
                pg_stat_user_tables.n_live_tup as row_count
            FROM 
                information_schema.tables t
            JOIN 
                pg_stat_user_tables ON t.table_name = pg_stat_user_tables.relname
            WHERE 
                t.table_schema = 'public'
                AND t.table_type = 'BASE TABLE'
            ORDER BY 
                t.table_name
        `;
        const tableResult = await pool.query(tableQuery);
        
        // Step 2: Get all columns
        const columnQuery = `
            SELECT 
                table_name,
                column_name as name,
                data_type as type,
                is_nullable,
                column_default as default_value
            FROM 
                information_schema.columns
            WHERE 
                table_schema = 'public'
            ORDER BY 
                table_name, ordinal_position
        `;
        const columnResult = await pool.query(columnQuery);
        
        // Group columns by table
        const columnsMap = {};
        columnResult.rows.forEach(column => {
            if (!columnsMap[column.table_name]) {
                columnsMap[column.table_name] = [];
            }
            columnsMap[column.table_name].push({
                name: column.name,
                type: column.type,
                nullable: column.is_nullable === 'YES',
                default: column.default_value
            });
        });
        
        // Format the final response
        return {
            tables: tableResult.rows,
            columnsMap: columnsMap
        };
    } catch (error) {
        console.error("Schema extraction error:", error);
        return { tables: [], columnsMap: {} };
    }
}

// Helper function to get table schema by name
async function getTableSchema(tableName) {
    try {
        const query = `
            SELECT 
                column_name as name,
                data_type as type,
                is_nullable,
                column_default as default_value
            FROM 
                information_schema.columns
            WHERE 
                table_schema = 'public'
                AND table_name = $1
            ORDER BY 
                ordinal_position
        `;
        const result = await pool.query(query, [tableName]);
        
        return {
            name: tableName,
            columns: result.rows.map(col => ({
                name: col.name,
                type: col.type,
                nullable: col.is_nullable === 'YES',
                default: col.default_value
            }))
        };
    } catch (error) {
        console.error(`Error getting schema for table ${tableName}:`, error);
        return { name: tableName, columns: [] };
    }
}

module.exports = extractSchema;
module.exports.getTableSchema = getTableSchema;
