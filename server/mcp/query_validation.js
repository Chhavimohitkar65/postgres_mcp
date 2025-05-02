const extractSchema = require('./schema_extraction');

/**
 * Validates a SQL query for security and correctness
 * @param {string} sql - SQL query to validate
 */
async function validateQuery(sql) {
    // Normalize SQL
    const normalizedSQL = sql.trim().toLowerCase();
    
    // Allow information_schema queries
    if (normalizedSQL.includes('information_schema')) {
        return true;
    }
    
    // Allow specific row fetches with LIMIT/OFFSET or WHERE with primary keys
    if (normalizedSQL.includes('limit') || 
        normalizedSQL.includes('offset') || 
        normalizedSQL.includes('where') ||
        normalizedSQL.includes('row_number()')) {
        // Still needs to be SELECT
        if (!normalizedSQL.startsWith('select')) {
            throw new Error('Only SELECT queries are allowed');
        }
    } else if (!normalizedSQL.startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
    }
    
    const schema = await extractSchema();
    
    // Check for forbidden keywords
    const forbiddenKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE'];
    const upperQuery = sql.toUpperCase();
    
    for (const keyword of forbiddenKeywords) {
        if (upperQuery.includes(keyword) && !upperQuery.includes(`"${keyword}"`) && !upperQuery.includes(`'${keyword}'`)) {
            throw new Error(`Query contains forbidden keyword: ${keyword}`);
        }
    }
    
    // Basic schema validation for table names
    const tablesInSchema = new Set(schema.tables.map(table => table.name.toLowerCase()));
    const tablesInQuery = sql.match(/FROM\s+(\w+)/gi) || [];
    
    tablesInQuery.forEach(tableMatch => {
        const tableName = tableMatch.replace(/FROM\s+/i, '').trim().toLowerCase();
        if (!tablesInSchema.has(tableName)) {
            throw new Error(`Table ${tableName} does not exist`);
        }
    });
}

module.exports = validateQuery;
