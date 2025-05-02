const generateSQL = require('./query_generation');
const validateQuery = require('./query_validation');
const executeQuery = require('./execution');
const { getInitialStats } = require('./stats_collection');
const extractSchema = require('./schema_extraction');
const { getTableSchema } = require('./schema_extraction');

async function processUserQuery(userQuery, insights) {
    try {
        console.log("Starting query processing for:", userQuery);
        
        const sqlQuery = await generateSQL(userQuery, insights);
        console.log("Generated SQL:", sqlQuery);
        
        validateQuery(sqlQuery);
        console.log("Query validated successfully");
        
        const result = await executeQuery(sqlQuery);
        console.log("Query executed successfully");
        
        return { success: true, data: result };
    } catch (error) {
        console.error("Error in processUserQuery:", error);
        return { success: false, error: error.message };
    }
}

module.exports = { 
    processUserQuery, 
    extractSchema, 
    getTableSchema,
    getInitialStats,
    generateSQL,
    validateQuery,
    executeQuery
};
