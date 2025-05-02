import pandas as pd
from sqlalchemy import create_engine, MetaData, Table
from google.generativeai import GenerativeModel
from concurrent.futures import ThreadPoolExecutor

# Database connection
engine = create_engine('postgresql://postgres:chhavi@123@localhost/postgres')
metadata = MetaData(bind=engine)

def get_table_metadata(table_name):
    """Optimized metadata extraction for a single table"""
    table = Table(table_name, metadata, autoload_with=engine)
    return {
        'table_name': table_name,
        'columns': [{'name': col.name, 'type': str(col.type)} for col in table.columns]
    }

def get_table_stats(table_name):
    """Optimized statistics collection using single query"""
    stats_query = f"""
        SELECT 
            COUNT(*) AS row_count,
            pg_size_pretty(pg_total_relation_size('{table_name}')) AS table_size
        FROM {table_name}
    """
    return pd.read_sql(stats_query, engine).iloc[0].to_dict()

def generate_tabular_insights():
    """Optimized insights generation using parallel processing and minimal queries"""
    # Get all table names
    tables = engine.table_names()
    
    # Use ThreadPool for parallel processing
    with ThreadPoolExecutor() as executor:
        # Get metadata and stats in parallel
        metadata_futures = {executor.submit(get_table_metadata, table): table for table in tables}
        stats_futures = {executor.submit(get_table_stats, table): table for table in tables}
        
        # Collect results
        insights = []
        for future in metadata_futures:
            table_name = metadata_futures[future]
            try:
                metadata = future.result()
                stats = stats_futures[executor.submit(get_table_stats, table_name)].result()
                
                insights.append({
                    'table_name': table_name,
                    'schema': metadata['columns'],
                    'row_count': stats['row_count'],
                    'table_size': stats['table_size']
                })
            except Exception as e:
                print(f"Error processing table {table_name}: {e}")
    
    return insights

async def generate_sql(user_query):
    try:
        # Generate optimized tabular insights
        insights = generate_tabular_insights()
        
        # Initialize Gemini model
        model = GenerativeModel("gemini-2.0-flash")
        
        # Create prompt with insights
        prompt = f"""
        Database Schema and Statistics:
        {insights}
        
        User Query:
        {user_query}
        
        Generate SQL query based on the above database schema and statistics.
        """
        
        # Generate SQL
        response = await model.generate_content(prompt)
        sql = response.text
        
        return sql
    
    except Exception as e:
        print(f"Error in generate_sql: {e}")
        raise e 