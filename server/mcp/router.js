const express = require('express');
const router = express.Router();
const { 
    processUserQuery, 
    extractSchema, 
    getInitialStats,
    generateSQL,
    validateQuery,
    executeQuery 
} = require('./__init__');
const { getTableSchema } = require('./schema_extraction');
const { analyzeForVisualization } = require('./visualization_analyzer');
const { pool } = require('../config');

// Query execution performance tracking
const queryPerformanceStats = {
    totalQueries: 0,
    averageTime: 0,
    slowestQuery: { query: '', time: 0 },
    queryTypes: {},
    responseTimeHistory: []
};

// Get database schema
router.get('/schema', async (req, res) => {
    try {
        const schema = await extractSchema();
        
        // Transform the schema object into an array format expected by tests
        const schemaArray = [];
        
        // For each table in the schema
        schema.tables.forEach(table => {
            const tableName = table.name;
            
            // For each column in this table
            if (schema.columnsMap[tableName]) {
                schema.columnsMap[tableName].forEach(column => {
                    schemaArray.push({
                        table_name: tableName,
                        column_name: column.name,
                        data_type: column.type,
                        is_nullable: column.nullable ? 'YES' : 'NO',
                        column_default: column.default
                    });
                });
            }
        });
        
        res.json(schemaArray);
    } catch (error) {
        console.error('Error extracting schema:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get schema for a specific table
router.get('/schema/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        const tableSchema = await getTableSchema(tableName);
        res.json(tableSchema);
    } catch (error) {
        console.error(`Error getting schema for table ${req.params.tableName}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get initial database statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getInitialStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting initial stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process NLP query and return data
router.post('/query', async (req, res) => {
    try {
        const startTime = Date.now();
        const { query, insights, page = 1, pageSize = 50 } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }
        
        const result = await processUserQuery(query, insights, { page, pageSize });
        
        // Track query performance
        updateQueryPerformance(query, Date.now() - startTime);
        
        res.json(result);
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate SQL query from natural language
router.post('/generate-sql', async (req, res) => {
    try {
        const { query, insights } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }
        
        const sql = await generateSQL(query, insights);
        res.json({ sql });
    } catch (error) {
        console.error('Error generating SQL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Execute raw SQL query with pagination
router.post('/execute', async (req, res) => {
    try {
        const startTime = Date.now();
        const { sql, page = 1, pageSize = 50 } = req.body;
        
        if (!sql) {
            return res.status(400).json({ error: "SQL query is required" });
        }
        
        // Validate query for security
        validateQuery(sql);
        
        // Get total count
        const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM')
                           .replace(/ORDER BY .*/i, '')
                           .replace(/LIMIT .*/i, '')
                           .replace(/OFFSET .*/i, '');
        
        const countResult = await executeQuery(countSql);
        const total = parseInt(countResult[0].total);
        
        // Add pagination to the query
        const offset = (page - 1) * pageSize;
        let paginatedSql = sql;
        
        // Remove existing LIMIT and OFFSET if present
        paginatedSql = paginatedSql.replace(/LIMIT .*/i, '').replace(/OFFSET .*/i, '');
        
        // Add new LIMIT and OFFSET
        paginatedSql += ` LIMIT ${pageSize} OFFSET ${offset}`;
        
        const result = await executeQuery(paginatedSql);
        
        // Track query performance
        updateQueryPerformance(sql, Date.now() - startTime);
        
        // Get column information
        const columnsSql = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = $1
        `;
        
        // Extract table name from the query
        const tableMatch = sql.match(/FROM\s+([^\s,;]+)/i);
        const tableName = tableMatch ? tableMatch[1].replace(/["\[\]]/g, '') : null;
        
        let columns = [];
        if (tableName) {
            const columnsResult = await pool.query(columnsSql, [tableName]);
            columns = columnsResult.rows;
        }
        
        res.json({
            data: result,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            },
            columns,
            _metadata: {
                executionTime: Date.now() - startTime,
                query: paginatedSql
            }
        });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific row by number
router.get('/row/:table/:rowNumber', async (req, res) => {
    try {
        const { table, rowNumber } = req.params;
        const startTime = Date.now();
        
        if (!table || !rowNumber || isNaN(Number(rowNumber))) {
            return res.status(400).json({ error: "Valid table name and row number are required" });
        }
        
        // First get primary key to optimize the query
        const pkQuery = `
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = $1::regclass
            AND    i.indisprimary;
        `;
        
        const pkResult = await pool.query(pkQuery, [table]);
        
        let sql;
        if (pkResult.rows.length > 0) {
            const pk = pkResult.rows[0].attname;
            sql = `SELECT * FROM ${table} ORDER BY ${pk} LIMIT 1 OFFSET ${Number(rowNumber) - 1}`;
        } else {
            sql = `SELECT * FROM ${table} LIMIT 1 OFFSET ${Number(rowNumber) - 1}`;
        }
        
        validateQuery(sql);
        const result = await executeQuery(sql);
        
        // Track query performance
        updateQueryPerformance(sql, Date.now() - startTime);
        
        if (result.length === 0) {
            return res.status(404).json({ error: `Row ${rowNumber} not found in table ${table}` });
        }
        
        res.json({ 
            data: result[0],
            _metadata: {
                table,
                rowNumber: Number(rowNumber),
                executionTime: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('Error fetching specific row:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get row by primary key
router.get('/row/:table/id/:id', async (req, res) => {
    try {
        const { table, id } = req.params;
        const startTime = Date.now();
        
        if (!table || !id) {
            return res.status(400).json({ error: "Valid table name and ID are required" });
        }
        
        // First get primary key to optimize the query
        const pkQuery = `
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = $1::regclass
            AND    i.indisprimary;
        `;
        
        const pkResult = await pool.query(pkQuery, [table]);
        
        if (pkResult.rows.length === 0) {
            return res.status(400).json({ error: `No primary key found for table ${table}` });
        }
        
        const pk = pkResult.rows[0].attname;
        const sql = `SELECT * FROM ${table} WHERE ${pk} = $1`;
        
        const result = await pool.query(sql, [id]);
        
        // Track query performance
        updateQueryPerformance(sql, Date.now() - startTime);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Record with ID ${id} not found in table ${table}` });
        }
        
        res.json({ 
            data: result.rows[0],
            _metadata: {
                table,
                id,
                executionTime: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('Error fetching row by ID:', error);
        res.status(500).json({ error: error.message });
    }
});

// Visual analysis recommendation
router.post('/visualize', async (req, res) => {
    try {
        const { data, query } = req.body;
        
        if (!data || !data.length) {
            return res.status(400).json({ error: "Query result data is required" });
        }
        
        if (!query) {
            return res.status(400).json({ error: "Original query text is required for context" });
        }
        
        const visualRecommendations = await analyzeForVisualization(data, query);
        res.json(visualRecommendations);
    } catch (error) {
        console.error('Error generating visualization recommendations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Combined query and visualization endpoint
router.post('/analyze', async (req, res) => {
    try {
        const startTime = Date.now();
        const { query, insights } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }
        
        // First process the query to get data
        const queryResult = await processUserQuery(query, insights);
        
        if (!queryResult.success) {
            return res.status(400).json(queryResult);
        }
        
        // Then analyze the data for visualization
        const visualRecommendations = await analyzeForVisualization(queryResult.data, query);
        
        // Track query performance
        updateQueryPerformance(query, Date.now() - startTime);
        
        // Return combined results
        res.json({
            success: true,
            data: queryResult.data,
            visualization: visualRecommendations,
            _metadata: {
                executionTime: Date.now() - startTime,
                rowCount: queryResult.data.length
            }
        });
    } catch (error) {
        console.error('Error in combined analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get performance metrics
router.get('/performance', (req, res) => {
    res.json({
        totalQueries: queryPerformanceStats.totalQueries,
        averageTime: queryPerformanceStats.averageTime,
        slowestQuery: queryPerformanceStats.slowestQuery,
        queryTypes: queryPerformanceStats.queryTypes,
        // Return recent history only to limit response size
        responseTimeHistory: queryPerformanceStats.responseTimeHistory.slice(-20)
    });
});

// Get database monitoring metrics
router.get('/monitor', async (req, res) => {
    try {
        // Get real connection stats
        const connectionStats = await pool.query(`
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity
            WHERE datname = current_database();
        `);

        // Get real query performance stats
        const queryStats = await pool.query(`
            SELECT 
                count(*) as total_queries,
                avg(EXTRACT(EPOCH FROM (now() - query_start))) as avg_query_time,
                max(EXTRACT(EPOCH FROM (now() - query_start))) as max_query_time
            FROM pg_stat_activity
            WHERE datname = current_database()
            AND query_start IS NOT NULL;
        `);

        // Get real table stats
        const tableStats = await pool.query(`
            SELECT 
                relname as table_name,
                n_live_tup as row_count,
                n_dead_tup as dead_rows,
                last_vacuum as last_cleanup
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 5;
        `);

        // Get real index stats
        const indexStats = await pool.query(`
            SELECT 
                schemaname as schema,
                relname as table,
                indexrelname as index,
                idx_scan as scans,
                idx_tup_read as rows_read
            FROM pg_stat_user_indexes
            ORDER BY idx_scan DESC
            LIMIT 5;
        `);

        // Get real cache stats
        const cacheStats = await pool.query(`
            SELECT 
                sum(heap_blks_read) as heap_reads,
                sum(heap_blks_hit) as heap_hits,
                sum(idx_blks_read) as index_reads,
                sum(idx_blks_hit) as index_hits
            FROM pg_statio_user_tables;
        `);

        res.json({
            connections: connectionStats.rows[0],
            queries: queryStats.rows[0],
            tables: tableStats.rows,
            indexes: indexStats.rows,
            cache: cacheStats.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting database metrics:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add a /metrics endpoint for database metrics
router.get('/metrics', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as size,
                (SELECT count(*) FROM pg_stat_activity) as connections,
                (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') as max_connections
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting database metrics:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all data from a selected table with pagination and filtering
router.get('/table/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        const { 
            page = 1, 
            limit = 100, 
            sortBy, 
            sortOrder = 'asc', 
            filters,
            columns 
        } = req.query;
        const startTime = Date.now();

        if (!tableName) {
            return res.status(400).json({ error: "Table name is required" });
        }

        // Validate table exists
        const tableExistsQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `;
        const tableExists = await pool.query(tableExistsQuery, [tableName]);
        
        if (!tableExists.rows[0].exists) {
            return res.status(404).json({ error: `Table ${tableName} not found` });
        }
        
        // Build column selection
        let columnSelection = '*';
        if (columns) {
            // Validate column names to prevent SQL injection
            const columnsArray = columns.split(',').map(col => col.trim());
            const validColumnsQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND column_name = ANY($2::text[]);
            `;
            const validColumns = await pool.query(validColumnsQuery, [tableName, columnsArray]);
            
            if (validColumns.rows.length === 0) {
                return res.status(400).json({ error: "None of the specified columns exist in the table" });
            }
            
            // Only use valid columns
            const validColumnNames = validColumns.rows.map(row => row.column_name);
            if (validColumnNames.length > 0) {
                columnSelection = validColumnNames.map(col => `"${col}"`).join(', ');
            }
        }
        
        // Build query with optional sorting and limiting
        let query = `SELECT ${columnSelection} FROM ${tableName}`;
        const queryParams = [];
        
        // Add filters if provided
        if (filters) {
            try {
                const filtersObj = typeof filters === 'string' ? JSON.parse(filters) : filters;
                const filterClauses = [];
                
                for (const [column, value] of Object.entries(filtersObj)) {
                    queryParams.push(value);
                    filterClauses.push(`"${column}" = $${queryParams.length}`);
                }
                
                if (filterClauses.length > 0) {
                    query += ` WHERE ${filterClauses.join(' AND ')}`;
                }
            } catch (error) {
                console.error('Error parsing filters:', error);
                return res.status(400).json({ error: "Invalid filters format" });
            }
        }
        
        // Add sorting
        if (sortBy) {
            // Validate sort column exists
            const sortColumnExistsQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = $2
                );
            `;
            const sortColumnExists = await pool.query(sortColumnExistsQuery, [tableName, sortBy]);
            
            if (sortColumnExists.rows[0].exists) {
                query += ` ORDER BY "${sortBy}" ${sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
            }
        }
        
        // Handle pagination
        if (limit !== 'all') {
            const limitValue = parseInt(limit, 10);
            const offset = (parseInt(page, 10) - 1) * limitValue;
            
            if (!isNaN(limitValue) && limitValue > 0) {
                query += ` LIMIT ${limitValue}`;
                
                if (!isNaN(offset) && offset > 0) {
                    query += ` OFFSET ${offset}`;
                }
            }
        }
        
        // Execute query
        const result = await pool.query(query, queryParams);
        
        // Get total row count for the table
        const countQuery = `SELECT COUNT(*) FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count, 10);
        
        res.json({
            success: true,
            data: result.rows,
            meta: {
                table: tableName,
                total: totalCount,
                page: parseInt(page, 10),
                limit: limit === 'all' ? totalCount : parseInt(limit, 10),
                pages: limit === 'all' ? 1 : Math.ceil(totalCount / parseInt(limit, 10)),
                executionTime: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('Error retrieving table data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update query performance statistics
 * @param {string} query - SQL or NL query
 * @param {number} time - Execution time in ms
 */
function updateQueryPerformance(query, time) {
    const sqlType = getSQLQueryType(query);
    
    // Update stats
    queryPerformanceStats.totalQueries++;
    
    // Update average time
    const prevTotal = queryPerformanceStats.averageTime * (queryPerformanceStats.totalQueries - 1);
    queryPerformanceStats.averageTime = (prevTotal + time) / queryPerformanceStats.totalQueries;
    
    // Update slowest query if this one is slower
    if (time > queryPerformanceStats.slowestQuery.time) {
        queryPerformanceStats.slowestQuery = {
            query: query.substring(0, 200), // Limit length
            time
        };
    }
    
    // Update query type stats
    if (!queryPerformanceStats.queryTypes[sqlType]) {
        queryPerformanceStats.queryTypes[sqlType] = { count: 0, totalTime: 0, averageTime: 0 };
    }
    
    queryPerformanceStats.queryTypes[sqlType].count++;
    queryPerformanceStats.queryTypes[sqlType].totalTime += time;
    queryPerformanceStats.queryTypes[sqlType].averageTime = 
        queryPerformanceStats.queryTypes[sqlType].totalTime / queryPerformanceStats.queryTypes[sqlType].count;
    
    // Add to history
    queryPerformanceStats.responseTimeHistory.push({
        time: Date.now(),
        executionTime: time,
        type: sqlType
    });
    
    // Limit history size
    if (queryPerformanceStats.responseTimeHistory.length > 100) {
        queryPerformanceStats.responseTimeHistory.shift();
    }
}

/**
 * Determine the type of SQL query
 * @param {string} query - SQL query string
 * @returns {string} Query type
 */
function getSQLQueryType(query) {
    const normalizedQuery = query.trim().toLowerCase();
    
    if (normalizedQuery.startsWith('select')) {
        if (normalizedQuery.includes('join')) {
            return 'SELECT_JOIN';
        }
        if (normalizedQuery.includes('group by')) {
            return 'SELECT_GROUP';
        }
        if (normalizedQuery.includes('order by')) {
            return 'SELECT_ORDER';
        }
        if (normalizedQuery.includes('limit')) {
            return 'SELECT_LIMIT';
        }
        return 'SELECT';
    }
    
    if (normalizedQuery.includes('information_schema')) {
        return 'SCHEMA_QUERY';
    }
    
    // If not SQL, assume NL query
    if (!normalizedQuery.includes('select') && 
        !normalizedQuery.includes('from') && 
        !normalizedQuery.includes('where')) {
        return 'NL_QUERY';
    }
    
    return 'OTHER';
}

module.exports = router; 