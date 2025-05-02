/**
 * Test Runner Script
 * 
 * This script:
 * 1. Starts the server
 * 2. Runs tests
 * 3. Shuts down the server
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue.bold('🚀 Starting MCP server and running tests'));
console.log(chalk.blue('=============================================='));

// Create a variable to store server process
let serverProcess = null;

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: ['ignore', 'pipe', 'pipe']
});

// Store the process
serverProcess = server;

server.stdout.on('data', (data) => {
    // Display server output
    process.stdout.write(chalk.cyan(`[Server] ${data.toString()}`));
    
    // Check if the server is ready
    if (data.toString().includes('Server running on http://localhost:5001')) {
        console.log(chalk.green('✅ Server started successfully'));
        console.log(chalk.blue('Running tests...'));
        
        // Give the server a moment to fully initialize
        setTimeout(runTests, 1000);
    }
});

server.stderr.on('data', (data) => {
    process.stderr.write(chalk.red(`[Server Error] ${data.toString()}`));
});

// Handle server exit
server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error(chalk.red(`❌ Server exited with code ${code}`));
    }
});

// Function to run tests
function runTests() {
    const tests = spawn('node', ['test.js'], {
        stdio: 'inherit'
    });
    
    tests.on('exit', (code) => {
        console.log(chalk.blue('=============================================='));
        if (code === 0) {
            console.log(chalk.green.bold('✅ Tests completed successfully'));
        } else {
            console.log(chalk.red.bold(`❌ Tests failed with code ${code}`));
        }
        
        // Shut down the server properly
        console.log(chalk.blue('Shutting down server...'));
        
        // Kill the server - use different method based on platform
        if (serverProcess) {
            serverProcess.kill();
        }
        
        // Exit with the test result code
        setTimeout(() => {
            process.exit(code);
        }, 500);
    });
}

// Handle script termination
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️ Test run interrupted'));
    if (serverProcess) {
        serverProcess.kill();
    }
    process.exit(1);
}); 