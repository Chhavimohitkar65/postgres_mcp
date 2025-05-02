const { pool } = require("../config");

async function getInitialStats() {
    return {
        table_counts: await getTableCounts(),
        data_type_distribution: await getDataTypeDistribution(),
        query_performance: await getQueryPerformance()
    };
}

async function getTableCounts() {
    const result = await pool.query(`
        SELECT table_name, 
               (xpath('/row/cnt/text()', 
               query_to_xml(format('SELECT count(*) as cnt FROM %I', table_name), 
               false, true, '')))[1]::text::int AS row_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
    `);
    return result.rows;
}

async function getDataTypeDistribution() {
    const result = await pool.query(`
        SELECT data_type, COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY data_type
    `);
    return result.rows.reduce((acc, row) => {
        acc[row.data_type] = row.count;
        return acc;
    }, {});
}

async function getQueryPerformance() {
    // Placeholder implementation
    return {
        average_response_time: 120,
        most_common_query_type: 'SELECT',
        query_success_rate: 98.5
    };
}

module.exports = {
    getInitialStats,
    getTableCounts,
    getDataTypeDistribution,
    getQueryPerformance
}; 