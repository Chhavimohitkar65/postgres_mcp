const { pool } = require("../config");

async function executeQuery(sqlQuery) {
    try {
        console.log("Executing SQL:", sqlQuery);
        const result = await pool.query(sqlQuery);
        console.log("Execution result:", result.rows);
        return result.rows;
    } catch (error) {
        console.error("Error executing query:", error);
        throw error;
    }
}

module.exports = executeQuery;
