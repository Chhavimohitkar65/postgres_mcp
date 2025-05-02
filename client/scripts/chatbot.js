class ChatbotManager {
    constructor() {
        this.chatHistory = [];
        this.isProcessing = false;
        this.container = document.getElementById('chatbotContainer');
        this.messageList = document.getElementById('chatMessages');
        this.inputField = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendMessage');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    async sendMessage() {
        if (this.isProcessing || !this.inputField.value.trim()) return;
        
        const userMessage = this.inputField.value.trim();
        this.inputField.value = '';
        
        this.addMessageToChat('user', userMessage);
        this.isProcessing = true;
        this.showTypingIndicator();
        
        try {
            // Get current context from database
            const context = await database.getChatbotContext();
            
            // Send message to chatbot API with context
            const response = await this.askChatbot(userMessage, context);
            
            this.hideTypingIndicator();
            this.addMessageToChat('bot', response.message);
            
            // Handle any suggested actions from the response
            if (response.actions) {
                this.handleSuggestedActions(response.actions);
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('error', 'Sorry, I encountered an error. Please try again.');
        } finally {
            this.isProcessing = false;
        }
    }
    
    async askChatbot(message, context) {
        const response = await fetch('/api/mcp/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                context: {
                    currentTable: context.currentTable,
                    tableSchema: context.tableSchema,
                    recentData: context.recentData,
                    tableStats: context.tableStats,
                    chatHistory: this.chatHistory
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get chatbot response');
        }
        
        return await response.json();
    }
    
    addMessageToChat(type, content) {
        const message = document.createElement('div');
        message.className = `chat-message ${type}-message`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        message.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessage(content)}</div>
                <div class="message-timestamp">${timestamp}</div>
            </div>
        `;
        
        this.messageList.appendChild(message);
        this.messageList.scrollTop = this.messageList.scrollHeight;
        
        // Add to chat history
        this.chatHistory.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
        
        // Keep chat history limited to last 50 messages
        if (this.chatHistory.length > 50) {
            this.chatHistory.shift();
        }
    }
    
    formatMessage(content) {
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Convert code blocks
        content = content.replace(
            /\`\`\`([^`]+)\`\`\`/g,
            '<pre><code>$1</code></pre>'
        );
        
        // Convert inline code
        content = content.replace(
            /\`([^`]+)\`/g,
            '<code>$1</code>'
        );
        
        return content;
    }
    
    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        this.messageList.appendChild(indicator);
        this.messageList.scrollTop = this.messageList.scrollHeight;
    }
    
    hideTypingIndicator() {
        const indicator = this.messageList.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    handleSuggestedActions(actions) {
        actions.forEach(action => {
            switch (action.type) {
                case 'filter':
                    this.applyTableFilter(action.column, action.value);
                    break;
                case 'sort':
                    this.applyTableSort(action.column, action.direction);
                    break;
                case 'navigate':
                    this.navigateToPage(action.page);
                    break;
                case 'highlight':
                    this.highlightTableCells(action.column, action.value);
                    break;
            }
        });
    }
    
    applyTableFilter(column, value) {
        // Implement table filtering
        if (window.tableAnalysisState) {
            window.tableAnalysisState.filters = window.tableAnalysisState.filters || {};
            window.tableAnalysisState.filters[column] = value;
            window.renderDataTable();
        }
    }
    
    applyTableSort(column, direction) {
        // Implement table sorting
        if (window.tableAnalysisState) {
            window.tableAnalysisState.sortColumn = column;
            window.tableAnalysisState.sortDirection = direction;
            window.renderDataTable();
        }
    }
    
    navigateToPage(page) {
        // Implement page navigation
        if (window.navigateToPage) {
            window.navigateToPage(page);
        }
    }
    
    highlightTableCells(column, value) {
        // Implement cell highlighting
        const table = document.querySelector('.data-table');
        if (!table) return;
        
        const cells = table.querySelectorAll(`td[data-column="${column}"]`);
        cells.forEach(cell => {
            if (cell.textContent.includes(value)) {
                cell.classList.add('highlighted');
            }
        });
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            cells.forEach(cell => cell.classList.remove('highlighted'));
        }, 3000);
    }
}

// Initialize chatbot when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ChatbotManager();
}); 