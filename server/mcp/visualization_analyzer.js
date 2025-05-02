const { pool } = require("../config");

/**
 * Analyzes query results and recommends appropriate visualizations
 * @param {Array} data - Query result data
 * @param {string} userQuery - Original natural language query
 * @return {Object} Visualization recommendations and metadata
 */
async function analyzeForVisualization(data, userQuery) {
    if (!data || data.length === 0) {
        return { recommendation: "none", reason: "No data available" };
    }
    
    // For extremely large datasets, sample the data for analysis
    const sampleData = data.length > 10000 ? getSampleData(data) : data;
    console.log(`Analyzing ${sampleData.length} rows out of ${data.length} total rows`);
    
    const columnTypes = determineColumnTypes(sampleData[0]);
    const columnCount = Object.keys(sampleData[0]).length;
    const rowCount = data.length; // Keep the actual row count
    
    // Analyze data patterns (only on sample data for large datasets)
    const patterns = detectPatterns(sampleData);
    
    // Detect query intent from user query
    const intent = detectQueryIntent(userQuery);
    
    // Generate visualization recommendations
    const recommendations = generateRecommendations(sampleData, columnTypes, intent, rowCount, columnCount, patterns);
    
    // For large datasets, add performance considerations
    const performanceConsiderations = rowCount > 5000 ? getPerformanceConsiderations(rowCount, columnCount) : null;
    
    return {
        recommendations,
        metadata: {
            rowCount,
            columnCount,
            columnTypes,
            detectablePatterns: patterns,
            performanceNote: performanceConsiderations
        }
    };
}

/**
 * Get a representative sample of data for analysis
 * @param {Array} data - Full dataset
 * @returns {Array} Sample dataset
 */
function getSampleData(data) {
    const sampleSize = Math.min(1000, Math.ceil(data.length * 0.1));
    
    if (data.length <= sampleSize) {
        return data;
    }
    
    // Stratified sampling - take from beginning, middle and end
    const result = [];
    const thirdSize = Math.floor(sampleSize / 3);
    
    // First third from the beginning
    for (let i = 0; i < thirdSize; i++) {
        result.push(data[i]);
    }
    
    // Middle third
    const midStart = Math.floor(data.length / 2) - Math.floor(thirdSize / 2);
    for (let i = 0; i < thirdSize; i++) {
        result.push(data[midStart + i]);
    }
    
    // Last third from the end
    for (let i = 0; i < thirdSize; i++) {
        result.push(data[data.length - thirdSize + i]);
    }
    
    // Fill any remaining slots with random samples
    const remaining = sampleSize - result.length;
    if (remaining > 0) {
        const usedIndices = new Set(result.map((_, i) => i));
        
        for (let i = 0; i < remaining; i++) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * data.length);
            } while (usedIndices.has(randomIndex));
            
            usedIndices.add(randomIndex);
            result.push(data[randomIndex]);
        }
    }
    
    return result;
}

/**
 * Performance considerations for large datasets
 */
function getPerformanceConsiderations(rowCount, columnCount) {
    const considerations = [];
    
    if (rowCount > 100000) {
        considerations.push("Dataset is very large (>100K rows). Consider server-side pagination.");
    } else if (rowCount > 10000) {
        considerations.push("Large dataset (>10K rows). Client-side rendering might be slow.");
    }
    
    if (columnCount > 15) {
        considerations.push("Many columns detected. Consider horizontal scrolling or column selection.");
    }
    
    if (rowCount > 5000 && columnCount > 10) {
        considerations.push("For this data volume, consider using data grid components with virtualization.");
    }
    
    return considerations;
}

/**
 * Determine column data types from sample data
 */
function determineColumnTypes(sampleRow) {
    const types = {};
    
    for (const [key, value] of Object.entries(sampleRow)) {
        if (typeof value === 'number') {
            types[key] = 'numeric';
        } else if (typeof value === 'boolean') {
            types[key] = 'boolean';
        } else if (value instanceof Date) {
            types[key] = 'date';
        } else if (typeof value === 'string') {
            // Try to identify if string is actually a date or numeric
            if (!isNaN(Date.parse(value))) {
                types[key] = 'date';
            } else if (!isNaN(value) && value.trim() !== '') {
                types[key] = 'numeric';
            } else {
                types[key] = 'text';
            }
        } else {
            types[key] = 'unknown';
        }
    }
    
    return types;
}

/**
 * Detect the intent of the user's query
 */
function detectQueryIntent(userQuery) {
    const lowerQuery = userQuery.toLowerCase();
    
    // Check for exact row requests
    if (lowerQuery.match(/row\s+(?:number\s+)?\d+/i) || 
        lowerQuery.match(/\d+(?:st|nd|rd|th)\s+row/i) ||
        lowerQuery.match(/id\s+(?:=|is|equals?)?\s*\d+/i)) {
        return 'specific_row';
    }
    
    // Common intent patterns
    if (lowerQuery.includes('compare') || lowerQuery.includes('comparison')) {
        return 'comparison';
    } else if (lowerQuery.includes('trend') || lowerQuery.includes('over time')) {
        return 'trend';
    } else if (lowerQuery.includes('distribution') || lowerQuery.includes('spread')) {
        return 'distribution';
    } else if (lowerQuery.includes('relationship') || lowerQuery.includes('correlation')) {
        return 'relationship';
    } else if (lowerQuery.includes('composition') || lowerQuery.includes('breakdown')) {
        return 'composition';
    } else {
        return 'general';
    }
}

/**
 * Detect patterns in the data that might influence visualization
 */
function detectPatterns(data) {
    if (!data || data.length === 0) {
        return [];
    }
    
    const patterns = [];
    const firstRow = data[0];
    
    // Check for time series data
    const hasDateColumn = Object.keys(firstRow).some(key => {
        const sample = firstRow[key];
        return sample instanceof Date || (!isNaN(Date.parse(sample)) && typeof sample === 'string');
    });
    
    if (hasDateColumn) {
        patterns.push('time_series');
    }
    
    // Check if data might represent geospatial information
    const hasGeoColumns = Object.keys(firstRow).some(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('country') || lowerKey.includes('city') || 
               lowerKey.includes('state') || lowerKey.includes('region') ||
               lowerKey.includes('latitude') || lowerKey.includes('longitude');
    });
    
    if (hasGeoColumns) {
        patterns.push('geospatial');
    }
    
    // Check for hierarchical data
    const hasPotentialHierarchy = Object.keys(firstRow).some(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('parent') || lowerKey.includes('child') || 
               lowerKey.includes('level') || lowerKey.includes('category') ||
               lowerKey.includes('subcategory');
    });
    
    if (hasPotentialHierarchy) {
        patterns.push('hierarchical');
    }
    
    return patterns;
}

/**
 * Generate visualization recommendations based on data analysis
 */
function generateRecommendations(data, columnTypes, intent, rowCount, columnCount, patterns) {
    const numericColumns = Object.entries(columnTypes)
        .filter(([_, type]) => type === 'numeric')
        .map(([name, _]) => name);
    
    const textColumns = Object.entries(columnTypes)
        .filter(([_, type]) => type === 'text')
        .map(([name, _]) => name);
    
    const dateColumns = Object.entries(columnTypes)
        .filter(([_, type]) => type === 'date')
        .map(([name, _]) => name);
    
    const recommendations = [];
    
    // For specific row requests, always recommend table view first
    if (intent === 'specific_row') {
        recommendations.push({
            type: 'data_table',
            suitability: 'high',
            reason: 'Specific row data requested'
        });
        
        // Possibly add detail view recommendation
        recommendations.push({
            type: 'detail_view',
            suitability: 'high',
            reason: 'Individual record display'
        });
        
        return recommendations;
    }
    
    // Trend analysis (time series)
    if (dateColumns.length > 0 && numericColumns.length > 0) {
        const chartType = rowCount > 1000 ? 'area_chart' : 'line_chart';
        const suitability = patterns.includes('time_series') ? 'high' : 'medium';
        
        recommendations.push({
            type: chartType,
            suitability,
            xAxis: dateColumns[0],
            yAxis: numericColumns.slice(0, 3), // Limit to 3 lines for readability
            reason: 'Time series data detected',
            performance: rowCount > 5000 ? 'Use data aggregation for better performance' : null
        });
    }
    
    // Comparative analysis
    if (numericColumns.length > 0 && textColumns.length > 0) {
        // For larger datasets, consider horizontal bar instead of vertical
        const chartType = rowCount > 20 ? 'horizontal_bar_chart' : 'bar_chart';
        
        recommendations.push({
            type: chartType,
            suitability: 'high',
            xAxis: textColumns[0],
            yAxis: numericColumns[0],
            reason: 'Categorical comparison',
            performance: rowCount > 50 ? 'Consider limiting to top N categories' : null
        });
    }
    
    // Distribution analysis
    if (numericColumns.length > 0) {
        recommendations.push({
            type: 'histogram',
            suitability: 'medium',
            data: numericColumns[0],
            reason: 'Numeric distribution'
        });
    }
    
    // Correlation analysis
    if (numericColumns.length >= 2) {
        recommendations.push({
            type: rowCount > 1000 ? 'heatmap' : 'scatter_plot',
            suitability: 'medium',
            xAxis: numericColumns[0],
            yAxis: numericColumns[1],
            reason: 'Potential correlation between numeric variables',
            performance: rowCount > 5000 ? 'Consider data sampling for scatter plots' : null
        });
    }
    
    // Composition analysis
    if (numericColumns.length > 0 && textColumns.length > 0) {
        // Only recommend pie charts for small category counts
        const categoryCount = data.reduce((set, row) => {
            set.add(row[textColumns[0]]);
            return set;
        }, new Set()).size;
        
        if (categoryCount <= 7) {
            recommendations.push({
                type: 'pie_chart',
                suitability: 'medium',
                labels: textColumns[0],
                values: numericColumns[0],
                reason: 'Composition of categories (few categories)'
            });
        } else {
            recommendations.push({
                type: 'treemap',
                suitability: 'medium',
                labels: textColumns[0],
                values: numericColumns[0],
                reason: 'Composition with many categories'
            });
        }
    }
    
    // Hierarchical data
    if (patterns.includes('hierarchical')) {
        recommendations.push({
            type: 'treemap',
            suitability: 'high',
            reason: 'Hierarchical data structure detected'
        });
    }
    
    // Geospatial data
    if (patterns.includes('geospatial')) {
        recommendations.push({
            type: 'map',
            suitability: 'high',
            reason: 'Geographic data detected'
        });
    }
    
    // If there are too many columns or rows, recommend table view with pagination
    if (columnCount > 10 || rowCount > 1000) {
        recommendations.push({
            type: 'data_table',
            suitability: 'high',
            reason: 'Complex data with many variables',
            performance: rowCount > 10000 ? 'Use server-side pagination' : 'Use client-side pagination'
        });
    }
    
    // Sort recommendations by suitability
    return recommendations.sort((a, b) => {
        const suitabilityScore = { 'high': 3, 'medium': 2, 'low': 1 };
        return suitabilityScore[b.suitability] - suitabilityScore[a.suitability];
    });
}

module.exports = { analyzeForVisualization }; 