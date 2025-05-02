/**
 * Table Insights Module
 * Provides data insights and chatbot functionality
 */

// Generate insights from data
function generateInsights(data) {
    if (!data || data.length === 0) {
        return;
    }
    
    const insightsContent = document.getElementById('insightsContent');
    insightsContent.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><div class="loading-text">Generating insights...</div></div>';
    
    // Short timeout to allow UI to update
    setTimeout(() => {
        try {
            const insights = [];
            const columns = Object.keys(data[0]);
            
            // Determine column types
            const columnTypes = {};
            columns.forEach(column => {
                columnTypes[column] = determineColumnType(data, column);
            });
            
            // Basic data summary
            insights.push({
                title: 'Dataset Summary',
                content: `This dataset contains ${formatNumber(data.length)} rows and ${columns.length} columns. 
                    ${columns.filter(col => columnTypes[col] === 'numeric').length} numeric columns, 
                    ${columns.filter(col => columnTypes[col] === 'date').length} date columns, and 
                    ${columns.filter(col => columnTypes[col] === 'categorical').length} categorical columns.`
            });
            
            // Analyze numeric columns
            const numericColumns = columns.filter(col => columnTypes[col] === 'numeric');
            numericColumns.forEach(column => {
                const numericInsights = analyzeNumericColumn(data, column);
                if (numericInsights) {
                    insights.push(numericInsights);
                }
            });
            
            // Analyze categorical columns
            const categoricalColumns = columns.filter(col => columnTypes[col] === 'categorical');
            categoricalColumns.forEach(column => {
                const categoricalInsights = analyzeCategoricalColumn(data, column);
                if (categoricalInsights) {
                    insights.push(categoricalInsights);
                }
            });
            
            // Analyze date columns
            const dateColumns = columns.filter(col => columnTypes[col] === 'date');
            dateColumns.forEach(column => {
                const dateInsights = analyzeDateColumn(data, column);
                if (dateInsights) {
                    insights.push(dateInsights);
                }
            });
            
            // Find correlations between numeric columns
            if (numericColumns.length >= 2) {
                const correlationInsights = findCorrelations(data, numericColumns);
                if (correlationInsights) {
                    insights.push(correlationInsights);
                }
            }
            
            // Display insights
            displayInsights(insights);
            
            // Store insights for chatbot
            tableAnalysisState.insights = insights;
            
        } catch (error) {
            console.error('Error generating insights:', error);
            insightsContent.innerHTML = '<p class="empty-state">Failed to generate insights</p>';
        }
    }, 100);
}

// Analyze numeric column
function analyzeNumericColumn(data, column) {
    // Extract values
    const values = data.map(item => parseFloat(item[column])).filter(val => !isNaN(val));
    
    if (values.length === 0) return null;
    
    // Calculate statistics
    const stats = calculateNumericStats(values);
    
    // Check for outliers (values more than 3 standard deviations from the mean)
    const outlierThreshold = stats.stdDev * 3;
    const outliers = values.filter(val => Math.abs(val - stats.mean) > outlierThreshold);
    const outlierPercentage = (outliers.length / values.length) * 100;
    
    // Check distribution
    const skewness = calculateSkewness(values, stats.mean, stats.stdDev);
    
    let distributionText = '';
    if (Math.abs(skewness) < 0.5) {
        distributionText = 'The data appears to be normally distributed.';
    } else if (skewness > 0.5) {
        distributionText = 'The data is positively skewed (right-tailed).';
    } else {
        distributionText = 'The data is negatively skewed (left-tailed).';
    }
    
    // Format insight
    return {
        title: `Analysis of ${column}`,
        content: `The average ${column} is ${formatNumber(stats.mean)} (median: ${formatNumber(stats.median)}), 
            ranging from ${formatNumber(stats.min)} to ${formatNumber(stats.max)}. 
            ${distributionText}
            ${outlierPercentage > 1 ? `Found ${formatNumber(outliers.length)} outliers (${outlierPercentage.toFixed(1)}% of values).` : ''}`
    };
}

// Analyze categorical column
function analyzeCategoricalColumn(data, column) {
    // Count occurrences of each category
    const categoryCounts = {};
    data.forEach(item => {
        const category = item[column];
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });
    
    // Calculate unique values and most common
    const uniqueValues = Object.keys(categoryCounts);
    const sortedCategories = uniqueValues.sort((a, b) => categoryCounts[b] - categoryCounts[a]);
    
    // Check if there's too many unique values (potentially an ID column)
    if (uniqueValues.length > 100) {
        return {
            title: `Analysis of ${column}`,
            content: `This column has ${formatNumber(uniqueValues.length)} unique values, 
                which suggests it might be an identifier or have high cardinality.`
        };
    }
    
    // Get top categories
    const topCategories = sortedCategories.slice(0, 3);
    const topPercentage = topCategories.reduce((acc, category) => {
        return acc + (categoryCounts[category] / data.length) * 100;
    }, 0);
    
    // Format insight
    return {
        title: `Analysis of ${column}`,
        content: `This column has ${formatNumber(uniqueValues.length)} unique values. 
            The most common values are: ${topCategories.map(cat => `"${cat}" (${Math.round((categoryCounts[cat] / data.length) * 100)}%)`).join(', ')}. 
            These top ${topCategories.length} categories account for ${Math.round(topPercentage)}% of the data.`
    };
}

// Analyze date column
function analyzeDateColumn(data, column) {
    // Parse dates
    const dates = data.map(item => new Date(item[column])).filter(date => !isNaN(date.getTime()));
    
    if (dates.length === 0) return null;
    
    // Sort dates
    const sortedDates = [...dates].sort((a, b) => a - b);
    
    // Calculate time range
    const minDate = sortedDates[0];
    const maxDate = sortedDates[sortedDates.length - 1];
    const daysDifference = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
    
    // Check for patterns
    let timePattern = '';
    
    // Check if dates are mostly weekdays
    const weekdayCount = dates.filter(date => date.getDay() > 0 && date.getDay() < 6).length;
    const weekdayPercentage = (weekdayCount / dates.length) * 100;
    
    if (weekdayPercentage > 90) {
        timePattern = 'The dates are predominantly on weekdays, suggesting business-day-related data.';
    }
    
    // Check for monthly patterns
    const monthCounts = Array(12).fill(0);
    dates.forEach(date => {
        monthCounts[date.getMonth()]++;
    });
    
    const maxMonth = monthCounts.indexOf(Math.max(...monthCounts));
    const maxMonthPercentage = (monthCounts[maxMonth] / dates.length) * 100;
    
    if (maxMonthPercentage > 30) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        timePattern += ` ${monthNames[maxMonth]} has the highest concentration of dates (${maxMonthPercentage.toFixed(1)}%).`;
    }
    
    // Format insight
    return {
        title: `Analysis of ${column}`,
        content: `The date range spans ${formatNumber(daysDifference)} days, 
            from ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}. 
            ${timePattern}`
    };
}

// Find correlations between numeric columns
function findCorrelations(data, numericColumns) {
    if (numericColumns.length < 2) return null;
    
    // Calculate all pairwise correlations
    const correlations = [];
    
    for (let i = 0; i < numericColumns.length; i++) {
        for (let j = i + 1; j < numericColumns.length; j++) {
            const column1 = numericColumns[i];
            const column2 = numericColumns[j];
            
            // Extract paired values (filter out rows with missing data)
            const pairs = data.filter(item => 
                !isNaN(parseFloat(item[column1])) && isFinite(item[column1]) &&
                !isNaN(parseFloat(item[column2])) && isFinite(item[column2])
            ).map(item => ({
                x: parseFloat(item[column1]),
                y: parseFloat(item[column2])
            }));
            
            if (pairs.length < 10) continue; // Not enough data
            
            // Calculate correlation coefficient
            const correlation = calculateCorrelation(pairs);
            
            // Only include significant correlations
            if (Math.abs(correlation) > 0.5) {
                correlations.push({
                    column1,
                    column2,
                    correlation
                });
            }
        }
    }
    
    // Sort by absolute correlation (strongest first)
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    
    // Take top 3 correlations
    const topCorrelations = correlations.slice(0, 3);
    
    if (topCorrelations.length === 0) {
        return {
            title: 'Correlation Analysis',
            content: 'No significant correlations were found between the numeric columns.'
        };
    }
    
    // Format insight
    return {
        title: 'Correlation Analysis',
        content: `Found ${correlations.length} significant correlations. Top correlations: 
            ${topCorrelations.map(corr => {
                let strength = '';
                if (Math.abs(corr.correlation) > 0.8) strength = 'very strong';
                else if (Math.abs(corr.correlation) > 0.6) strength = 'strong';
                else strength = 'moderate';
                
                let direction = corr.correlation > 0 ? 'positive' : 'negative';
                
                return `${corr.column1} and ${corr.column2} have a ${strength} ${direction} correlation (${corr.correlation.toFixed(2)})`;
            }).join('; ')}.`
    };
}

// Calculate skewness
function calculateSkewness(values, mean, stdDev) {
    if (values.length < 3) return 0;
    
    let sum = 0;
    values.forEach(value => {
        sum += Math.pow((value - mean) / stdDev, 3);
    });
    
    return sum / values.length;
}

// Calculate correlation coefficient
function calculateCorrelation(pairs) {
    const n = pairs.length;
    
    // Calculate means
    const mean_x = pairs.reduce((sum, pair) => sum + pair.x, 0) / n;
    const mean_y = pairs.reduce((sum, pair) => sum + pair.y, 0) / n;
    
    // Calculate variances and covariance
    let variance_x = 0;
    let variance_y = 0;
    let covariance = 0;
    
    pairs.forEach(pair => {
        const dx = pair.x - mean_x;
        const dy = pair.y - mean_y;
        variance_x += dx * dx;
        variance_y += dy * dy;
        covariance += dx * dy;
    });
    
    variance_x /= n;
    variance_y /= n;
    covariance /= n;
    
    // Calculate correlation
    if (variance_x === 0 || variance_y === 0) return 0;
    return covariance / (Math.sqrt(variance_x) * Math.sqrt(variance_y));
}

// Display insights in the UI
function displayInsights(insights) {
    const insightsContent = document.getElementById('insightsContent');
    insightsContent.innerHTML = '';
    
    if (!insights || insights.length === 0) {
        insightsContent.innerHTML = '<p class="empty-state">No insights available</p>';
        return;
    }
    
    insights.forEach(insight => {
        const insightItem = document.createElement('div');
        insightItem.className = 'insight-item';
        
        const title = document.createElement('h4');
        title.textContent = insight.title;
        
        const content = document.createElement('p');
        content.textContent = insight.content;
        
        insightItem.appendChild(title);
        insightItem.appendChild(content);
        insightsContent.appendChild(insightItem);
    });
}

// Initialize chatbot
function initChatbot() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    const toggleChatbot = document.getElementById('toggleChatbot');
    const chatbotContainer = document.querySelector('.chatbot-container');
    
    // Toggle chatbot visibility
    toggleChatbot.addEventListener('click', () => {
        chatbotContainer.classList.toggle('collapsed');
        const isCollapsed = chatbotContainer.classList.contains('collapsed');
        toggleChatbot.innerHTML = isCollapsed ? 
            '<i class="ri-arrow-down-s-line"></i>' : 
            '<i class="ri-arrow-up-s-line"></i>';
    });
    
    // Send message on button click
    sendChatBtn.addEventListener('click', () => {
        sendChatMessage();
    });
    
    // Send message on Enter key
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    });
    
    // Initially collapse chatbot
    chatbotContainer.classList.add('collapsed');
}

// Send chat message
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    const userMessageElement = document.createElement('div');
    userMessageElement.className = 'user-message';
    userMessageElement.textContent = message;
    chatMessages.appendChild(userMessageElement);
    
    // Clear input
    chatInput.value = '';
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Process user message and generate response
    generateChatbotResponse(message);
}

// Generate chatbot response
function generateChatbotResponse(message) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Create response element with loading indicator
    const botMessageElement = document.createElement('div');
    botMessageElement.className = 'bot-message';
    botMessageElement.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    chatMessages.appendChild(botMessageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Process message
    setTimeout(() => {
        const response = processChatbotMessage(message);
        botMessageElement.textContent = response;
        
        // Scroll to bottom again after content is updated
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);
}

// Process chatbot message and generate response
function processChatbotMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check if data is available
    if (!tableAnalysisState.data || tableAnalysisState.data.length === 0) {
        return "Please select a table and analyze the data first, then I can help you interpret the results.";
    }
    
    // Check for explanation requests
    if (lowerMessage.includes('explain') && lowerMessage.includes('chart')) {
        return explainChart();
    }
    
    // Check for trend requests
    if (lowerMessage.includes('trend') || lowerMessage.includes('pattern')) {
        return describeTrends();
    }
    
    // Check for summary requests
    if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
        return summarizeData();
    }
    
    // Check for insight requests
    if (lowerMessage.includes('insight') || lowerMessage.includes('analysis')) {
        return describeInsights();
    }
    
    // Check for specific column questions
    const columns = Object.keys(tableAnalysisState.data[0]);
    for (const column of columns) {
        if (lowerMessage.includes(column.toLowerCase())) {
            return describeColumn(column);
        }
    }
    
    // Default response
    return "I can help explain the data and visualizations. Try asking me to explain the chart, describe trends, summarize the data, or ask about a specific column.";
}

// Explain the main chart
function explainChart() {
    if (!tableAnalysisState.charts.main) {
        return "There's no chart to explain yet. Please analyze the data first.";
    }
    
    const chartType = tableAnalysisState.charts.main.config.type;
    const chartData = tableAnalysisState.charts.main.data;
    
    // Generate explanation based on chart type
    switch (chartType) {
        case 'line':
            return explainLineChart(chartData);
        case 'bar':
            return explainBarChart(chartData);
        case 'scatter':
            return explainScatterChart(chartData);
        case 'pie':
            return explainPieChart(chartData);
        default:
            return `This is a ${chartType} chart showing the relationship between the selected data points.`;
    }
}

// Explain line chart
function explainLineChart(chartData) {
    const label = chartData.datasets[0].label;
    const dataPoints = chartData.datasets[0].data;
    
    // Calculate trend
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];
    const trend = lastPoint > firstPoint ? 'increasing' : (lastPoint < firstPoint ? 'decreasing' : 'stable');
    
    // Find max and min points
    const maxPoint = Math.max(...dataPoints);
    const minPoint = Math.min(...dataPoints);
    
    return `This line chart shows the trend of ${label} over time. The overall trend is ${trend}. 
        The highest value is ${formatNumber(maxPoint)} and the lowest is ${formatNumber(minPoint)}. 
        The chart contains ${dataPoints.length} data points.`;
}

// Explain bar chart
function explainBarChart(chartData) {
    const labels = chartData.labels;
    const values = chartData.datasets[0].data;
    const label = chartData.datasets[0].label;
    
    // Find top categories
    const topIndices = [];
    for (let i = 0; i < 3 && i < values.length; i++) {
        topIndices.push(values.indexOf(Math.max(...values.filter((_, idx) => !topIndices.includes(idx)))));
    }
    
    const topCategories = topIndices.map(idx => `${labels[idx]} (${formatNumber(values[idx])})`);
    
    return `This bar chart shows ${label} by category. 
        The top ${topCategories.length} categories are: ${topCategories.join(', ')}. 
        The chart compares ${values.length} different categories.`;
}

// Explain scatter chart
function explainScatterChart(chartData) {
    const label = chartData.datasets[0].label;
    const points = chartData.datasets[0].data;
    
    return `This scatter plot shows the relationship between two numeric variables in ${label}. 
        It displays ${points.length} data points. 
        You can use this visualization to identify correlations or patterns between the two variables.`;
}

// Explain pie chart
function explainPieChart(chartData) {
    const labels = chartData.labels;
    const values = chartData.datasets[0].data;
    
    // Calculate total and percentages
    const total = values.reduce((sum, val) => sum + val, 0);
    const percentages = values.map(val => ((val / total) * 100).toFixed(1));
    
    // Find top categories
    const topIndices = [];
    for (let i = 0; i < 3 && i < values.length; i++) {
        topIndices.push(values.indexOf(Math.max(...values.filter((_, idx) => !topIndices.includes(idx)))));
    }
    
    const topCategories = topIndices.map(idx => `${labels[idx]} (${percentages[idx]}%)`);
    
    return `This pie chart shows the distribution of categories. 
        The largest ${topCategories.length} segments are: ${topCategories.join(', ')}. 
        The chart divides data into ${values.length} categories.`;
}

// Describe trends in the data
function describeTrends() {
    if (!tableAnalysisState.data || !tableAnalysisState.insights) {
        return "Please analyze the data first to identify trends.";
    }
    
    const data = tableAnalysisState.data;
    const insights = tableAnalysisState.insights;
    
    // Extract key trends from insights
    let trends = [];
    
    // Look for correlations
    const correlationInsight = insights.find(insight => insight.title === 'Correlation Analysis');
    if (correlationInsight && !correlationInsight.content.includes('No significant correlations')) {
        trends.push(correlationInsight.content);
    }
    
    // Look for trends in numeric columns
    const numericTrends = insights
        .filter(insight => insight.title.includes('Analysis of') && (
            insight.content.includes('skewed') || 
            insight.content.includes('outliers')
        ))
        .map(insight => insight.content);
    
    if (numericTrends.length > 0) {
        trends = trends.concat(numericTrends);
    }
    
    // Look for date patterns
    const dateTrends = insights
        .filter(insight => insight.title.includes('Analysis of') && (
            insight.content.includes('date range') || 
            insight.content.includes('pattern')
        ))
        .map(insight => insight.content);
    
    if (dateTrends.length > 0) {
        trends = trends.concat(dateTrends);
    }
    
    if (trends.length === 0) {
        return "I don't see any significant trends in this dataset. The data appears to be relatively uniform.";
    }
    
    return `Here are the key trends I've identified in the data:\n\n${trends.join('\n\n')}`;
}

// Summarize the dataset
function summarizeData() {
    if (!tableAnalysisState.data || !tableAnalysisState.insights) {
        return "Please analyze the data first to generate a summary.";
    }
    
    const data = tableAnalysisState.data;
    const insights = tableAnalysisState.insights;
    
    // Get basic summary
    const summaryStat = insights.find(insight => insight.title === 'Dataset Summary');
    let summary = summaryStat ? summaryStat.content : `This dataset contains ${formatNumber(data.length)} rows and ${Object.keys(data[0]).length} columns.`;
    
    // Add key columns
    const columns = Object.keys(data[0]);
    summary += `\n\nKey columns include: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? ' and others' : ''}.`;
    
    // Add count of categorical and numeric columns
    const columnTypes = {};
    columns.forEach(column => {
        columnTypes[column] = determineColumnType(data, column);
    });
    
    const numericCount = columns.filter(col => columnTypes[col] === 'numeric').length;
    const categoricalCount = columns.filter(col => columnTypes[col] === 'categorical').length;
    const dateCount = columns.filter(col => columnTypes[col] === 'date').length;
    
    summary += `\n\nThe dataset contains ${numericCount} numeric columns, ${categoricalCount} categorical columns, and ${dateCount} date columns.`;
    
    return summary;
}

// Describe insights
function describeInsights() {
    if (!tableAnalysisState.insights) {
        return "Please analyze the data first to generate insights.";
    }
    
    const insights = tableAnalysisState.insights;
    
    // Take the first 3 insights
    const topInsights = insights.slice(0, 3);
    
    return `Here are the key insights from the data:\n\n${topInsights.map(insight => 
        `${insight.title}: ${insight.content}`
    ).join('\n\n')}`;
}

// Describe a specific column
function describeColumn(columnName) {
    if (!tableAnalysisState.data) {
        return "Please analyze the data first.";
    }
    
    const data = tableAnalysisState.data;
    
    // Check if column exists
    if (!data[0].hasOwnProperty(columnName)) {
        return `I couldn't find a column named "${columnName}" in the dataset.`;
    }
    
    // Determine column type
    const columnType = determineColumnType(data, columnName);
    
    // Generate description based on column type
    switch (columnType) {
        case 'numeric':
            return describeNumericColumn(data, columnName);
        case 'categorical':
            return describeCategoricalColumn(data, columnName);
        case 'date':
            return describeDateColumn(data, columnName);
        default:
            return `Column "${columnName}" contains mixed or undefined data types.`;
    }
}

// Describe numeric column
function describeNumericColumn(data, column) {
    // Extract values
    const values = data.map(item => parseFloat(item[column])).filter(val => !isNaN(val));
    
    if (values.length === 0) {
        return `Column "${column}" appears to be numeric but contains no valid numeric values.`;
    }
    
    // Calculate statistics
    const stats = calculateNumericStats(values);
    
    return `Column "${column}" is numeric with values ranging from ${formatNumber(stats.min)} to ${formatNumber(stats.max)}. 
        The average value is ${formatNumber(stats.mean)}, and the median is ${formatNumber(stats.median)}. 
        The standard deviation is ${formatNumber(stats.stdDev)}.`;
}

// Describe categorical column
function describeCategoricalColumn(data, column) {
    // Count occurrences of each category
    const categoryCounts = {};
    data.forEach(item => {
        const category = item[column];
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });
    
    // Calculate unique values and most common
    const uniqueValues = Object.keys(categoryCounts);
    const sortedCategories = uniqueValues.sort((a, b) => categoryCounts[b] - categoryCounts[a]);
    
    // Get top 3 categories
    const topCategories = sortedCategories.slice(0, 3);
    
    return `Column "${column}" is categorical with ${formatNumber(uniqueValues.length)} unique values. 
        The most common values are: ${topCategories.map(cat => 
            `"${cat}" (${Math.round((categoryCounts[cat] / data.length) * 100)}%)`
        ).join(', ')}.`;
}

// Describe date column
function describeDateColumn(data, column) {
    // Parse dates
    const dates = data.map(item => new Date(item[column])).filter(date => !isNaN(date.getTime()));
    
    if (dates.length === 0) {
        return `Column "${column}" appears to be a date column but contains no valid dates.`;
    }
    
    // Sort dates
    const sortedDates = [...dates].sort((a, b) => a - b);
    
    // Calculate time range
    const minDate = sortedDates[0];
    const maxDate = sortedDates[sortedDates.length - 1];
    const daysDifference = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
    
    return `Column "${column}" contains dates ranging from ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}, 
        spanning ${formatNumber(daysDifference)} days. 
        There are ${formatNumber(dates.length)} valid dates in this column.`;
} 