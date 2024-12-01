import * as vscode from 'vscode';
import * as os from 'os';
import WebSocket from 'ws';

let ws: any = null;
let authToken: any = null;
// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Devek.dev is now active!');

    // Load saved token from storage
    authToken = context.globalState.get('devekAuthToken');

    // Register login command
    let loginCommand = vscode.commands.registerCommand('devek.login', async () => {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'email@example.com'
        });

        if (!email) return;

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });

        if (!password) return;

        connectToWebSocket(context, { action: 'login', data: { email, password } });
    });

    // Register logout command
    let logoutCommand = vscode.commands.registerCommand('devek.logout', () => {
        authToken = null;
        context.globalState.update('devekAuthToken', null);
        if (ws) ws.close();
        vscode.window.showInformationMessage('Logged out successfully');
    });

    context.subscriptions.push(loginCommand, logoutCommand);

    // Connect with auth token if available
    if (authToken) {
        connectToWebSocket(context);
    } else {
        vscode.window.showInformationMessage('Please log in to use Devek.dev', 'Login')
            .then(selection => {
                if (selection === 'Login') {
                    vscode.commands.executeCommand('devek.login');
                }
            });
    }
}

function connectToWebSocket(context: vscode.ExtensionContext, loginData?: any) {
    const computerName = os.hostname();
    const environment = vscode.env.appName || 'Unknown';
    const wsUrl = 'wss://ws.devek.dev';
    
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Connected to WebSocket server.');
        
        // Send auth token if available
        if (authToken) {
            ws.send(JSON.stringify({ type: 'auth', token: authToken }));
        }
        // Send login data if provided
        else if (loginData) {
            ws.send(JSON.stringify(loginData));
        }
    });

    ws.on('message', (data: any) => {
        try {
            const response = JSON.parse(data.toString());
            
            if (response.status === 'success' && response.token) {
                // Save token and show success message
                authToken = response.token;
                context.globalState.update('devekAuthToken', authToken);
                vscode.window.showInformationMessage('Successfully logged in to Devek.dev');
            } else if (response.status === 'error') {
                vscode.window.showErrorMessage(response.message);
                if (response.message.includes('Authentication failed')) {
                    authToken = null;
                    context.globalState.update('devekAuthToken', null);
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    ws.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        vscode.window.showErrorMessage('Failed to connect to Devek.dev');
    });

    ws.on('close', () => {
        console.log('Disconnected from WebSocket server.');
    });

    // Listen for document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!authToken) return; // Don't send changes if not authenticated

            const document = event.document;
            const changes = event.contentChanges;
            const timestamp = new Date().toISOString();

            changes.forEach(change => {
                const { range, text } = change;
                const { start, end } = range;

                const changeData = {
                    document_uri: document.uri.toString(),
                    timestamp: timestamp,
                    start_line: start.line,
                    start_character: start.character,
                    end_line: end.line,
                    end_character: end.character,
                    text: text,
                    computer_name: computerName,
                    environment: environment
                };

                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'change', data: changeData }));
                }
            });
        })
    );
}

export function deactivate() {
    if (ws) {
        ws.close();
        console.log('WebSocket connection closed.');
    }
}