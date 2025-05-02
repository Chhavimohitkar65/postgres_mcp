const { GoogleGenerativeAI } = require("@google/generative-ai");
const getFewShotExamples = require('./examples');
const extractSchema = require('./schema_extraction');
const { pool } = require("../config");

const genAI = new GoogleGenerativeAI("AIzaSyB4hiLV6LGufxe_FQlH2TnNPZUVyEtTyVA");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Keep a cache of primary keys for tables to optimize queries
const primaryKeyCache = {};

/**
 * Get primary key for a table - helps with optimized row access
 * @param {string} tableName - Name of the table
 * @returns {Promise<string|null>} Primary key column name or null if not found
 */
async function getPrimaryKey(tableName) {
    // Check cache first
    if (primaryKeyCache[tableName]) {
        return primaryKeyCache[tableName];
    }
    
    try {
        const query = `
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = $1::regclass
            AND    i.indisprimary;
        `;
        
        const result = await pool.query(query, [tableName]);
        
        if (result.rows.length > 0) {
            primaryKeyCache[tableName] = result.rows[0].attname;
            return result.rows[0].attname;
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting primary key for ${tableName}:`, error);
        return null;
    }
}

/**
 * Get available indexes for a table - helps with query optimization hints
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} List of indexed columns
 */
async function getTableIndexes(tableName) {
    try {
        const query = `
            SELECT
                indexrelid::regclass AS index_name,
                idx.indrelid::regclass AS table_name,
                array_agg(a.attname) AS column_names
            FROM
                pg_index AS idx
            JOIN
                pg_class AS i ON i.oid = idx.indexrelid
            JOIN
                pg_attribute AS a ON a.attrelid = idx.indrelid AND a.attnum = ANY(idx.indkey)
            WHERE
                idx.indrelid = $1::regclass
            GROUP BY
                indexrelid, idx.indrelid
            ORDER BY
                indexrelid;
        `;
        
        const result = await pool.query(query, [tableName]);
        return result.rows;
    } catch (error) {
        console.error(`Error getting indexes for ${tableName}:`, error);
        return [];
    }
}

/**
 * Determines if a query is asking for a specific row
 * @param {string} userQuery - The user's natural language query
 * @returns {Object|null} Object with row information or null
 */
function parseRowRequest(userQuery) {
    const lowerQuery = userQuery.toLowerCase();
    
    // Look for patterns like "row 123" or "row number 123" or "row #123"
    const rowNumberPatterns = [
        /row\s+(?:number\s+)?(\d+)/i,
        /row\s+#(\d+)/i,
        /(\d+)(?:st|nd|rd|th)\s+row/i
    ];
    
    for (const pattern of rowNumberPatterns) {
        const match = lowerQuery.match(pattern);
        if (match && match[1]) {
            return { 
                type: 'row_number',
                rowNumber: parseInt(match[1], 10)
            };
        }
    }
    
    // Look for patterns like "id 123"
    const idPatterns = [
        /(?:id|pk|primary key|key)\s+(?:=|is|equals?|:)?\s*(\d+)/i
    ];
    
    for (const pattern of idPatterns) {
        const match = lowerQuery.match(pattern);
        if (match && match[1]) {
            return {
                type: 'primary_key',
                value: match[1]
            };
        }
    }
    
    return null;
}

/**
 * Extracts table name from a user query
 * @param {string} userQuery - The user's natural language query
 * @param {Array} tables - List of available tables
 * @returns {string|null} Table name or null if not found
 */
function extractTableName(userQuery, tables) {
    const lowerQuery = userQuery.toLowerCase();
    
    // Try direct matching first
    for (const table of tables) {
        const tableName = table.table_name.toLowerCase();
        if (lowerQuery.includes(`table ${tableName}`) || 
            lowerQuery.includes(`from ${tableName}`) || 
            lowerQuery.includes(`in ${tableName}`)) {
            return table.table_name;
        }
    }
    
    // If no direct match, try to find any table mentioned in the query
    for (const table of tables) {
        const tableName = table.table_name.toLowerCase();
        if (lowerQuery.includes(tableName)) {
            return table.table_name;
        }
    }
    
    return null;
}

/**
 * Generate SQL query optimized for specific use cases
 * @param {string} userQuery - User's natural language query
 * @param {Object} insights - DB insights for context
 * @returns {Promise<string>} Generated SQL query
 */
async function generateSQL(userQuery, insights) {
    try {
        console.log("Generating SQL for:", userQuery);
        
        const schema = await extractSchema();
        const examples = getFewShotExamples();
        
        // Get unique tables with their columns
        const tables = Array.from(new Set(
            schema.tables.map(table => ({
                table_name: table.name,
                columns: schema.columnsMap[table.name] || []
            }))
        ));
        
        // Check if this is a specific row request
        const rowRequest = parseRowRequest(userQuery);
        if (rowRequest) {
            const tableName = extractTableName(userQuery, tables);
            
            if (tableName && rowRequest.type === 'row_number') {
                // Get primary key for optimization
                const pk = await getPrimaryKey(tableName);
                
                if (pk) {
                    // Use primary key to efficiently fetch the row
                    return `SELECT * FROM ${tableName} ORDER BY ${pk} LIMIT 1 OFFSET ${rowRequest.rowNumber - 1}`;
                } else {
                    // Fallback to regular row fetch
                    return `SELECT * FROM ${tableName} LIMIT 1 OFFSET ${rowRequest.rowNumber - 1}`;
                }
            } else if (tableName && rowRequest.type === 'primary_key') {
                // Get primary key for the table
                const pk = await getPrimaryKey(tableName);
                
                if (pk) {
                    return `SELECT * FROM ${tableName} WHERE ${pk} = ${rowRequest.value}`;
                }
            }
        }
        
        // Get table indexes for optimization hints
        let indexInfo = [];
        if (insights && insights.table_counts) {
            for (const table of insights.table_counts) {
                const indexes = await getTableIndexes(table.table_name);
                indexInfo.push({ table: table.table_name, indexes });
            }
        }
        
        const prompt = `
            Database Schema: ${JSON.stringify(schema)}
            
            Available Indexes: ${JSON.stringify(indexInfo)}
            
            Current Database Insights:
            ${JSON.stringify(insights)}
            
            Few-shot examples:
            ${examples}
            
            User Query:
            "${userQuery}"
            
            Please generate an optimized SQL query based on the above schema, insights, and user query.
            Use appropriate indexing when available. Consider query performance.
            If the user is asking for a specific row or record, ensure the query efficiently retrieves just that row.
            Only return SQL, no explanations.
        `;
        
        console.log("Sending prompt to Gemini");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const sql = response.text();
        
        // Remove backticks from the generated SQL
        return sql.replace(/```sql/g, '').replace(/```/g, '').trim();
    } catch (error) {
        console.error("Error in generateSQL:", error);
        throw error;
    }
}

module.exports = generateSQL;
