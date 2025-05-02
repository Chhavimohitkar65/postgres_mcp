const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "chhavi@123"
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error("Error acquiring client", err.stack);
    }
    console.log("Connected to PostgreSQL database");
    release();
});

module.exports = { pool };
