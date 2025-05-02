import psycopg2
from collections import defaultdict

def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="postgres",
        user="postgres",
        password="chhavi@123"
    )

def get_initial_stats():
    stats = {
        'table_counts': get_table_counts(),
        'data_type_distribution': get_data_type_distribution(),
        'query_performance': get_query_performance()
    }
    return stats

def get_table_counts():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name, 
               (xpath('/row/cnt/text()', 
               query_to_xml(format('SELECT count(*) as cnt FROM %I', table_name), 
               false, true, '')))[1]::text::int AS row_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    return [{'table_name': row[0], 'row_count': row[1]} for row in results]

def get_data_type_distribution():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT data_type, COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY data_type
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    return {row[0]: row[1] for row in results}

def get_query_performance():
    # Placeholder for query performance stats
    return {
        'average_response_time': 120,
        'most_common_query_type': 'SELECT',
        'query_success_rate': 98.5
    } 