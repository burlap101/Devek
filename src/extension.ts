import * as vscode from 'vscode';
import * as os from 'os';
import WebSocket from 'ws';

let ws: WebSocket | null = null;
let authToken: any = null;
let statusBarItem: vscode.StatusBarItem;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000;

interface WebSocketMessage {
    type: 'auth' | 'change' | 'login';
    data?: any;
    token?: string;
    status?: string;
    message?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Devek.dev is now active!');

    // Initialize status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    // Load saved token from storage
    authToken = context.globalState.get('devekAuthToken');
    updateStatusBar('initializing');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('devek.login', () => showLoginWebview(context)),
        vscode.commands.registerCommand('devek.logout', () => handleLogout(context)),
        vscode.commands.registerCommand('devek.reconnect', () => connectToWebSocket(context))
    );

    // Initialize connection
    if (authToken) {
        connectToWebSocket(context);
    } else {
        updateStatusBar('disconnected');
        showLoginPrompt();
    }
}

function showLoginWebview(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'devekLogin',
        'Devek.dev Login',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getLoginHtml();

    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'login':
                    await handleLoginAttempt(context, message.email, message.password);
                    panel.dispose();
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getLoginHtml() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .container {
                    max-width: 400px;
                    margin: 0 auto;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                input {
                    width: 100%;
                    padding: 8px;
                    margin-top: 5px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .error {
                    color: var(--vscode-errorForeground);
                    margin-top: 10px;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Login to Devek.dev</h2>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <div class="error" id="error-message"></div>
                <button onclick="login()">Login</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                function login() {
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    const errorElement = document.getElementById('error-message');
                    
                    if (!email || !password) {
                        errorElement.textContent = 'Please fill in all fields';
                        errorElement.style.display = 'block';
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'login',
                        email: email,
                        password: password
                    });
                }
            </script>
        </body>
        </html>
    `;
}

async function handleLoginAttempt(context: vscode.ExtensionContext, email: string, password: string) {
    updateStatusBar('connecting');
    connectToWebSocket(context, { type: 'login', data: { email, password } });
}

function handleLogout(context: vscode.ExtensionContext) {
    authToken = null;
    context.globalState.update('devekAuthToken', null);
    if (ws) ws.close();
    updateStatusBar('disconnected');
    showLoginPrompt();
}

function updateStatusBar(status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'initializing') {
    const statusMap = {
        connected: {
            text: '$(check) Devek.dev',
            tooltip: 'Connected to Devek.dev - Click to view options',
            command: 'devek.showMenu'
        },
        connecting: {
            text: '$(loading~spin) Devek.dev',
            tooltip: 'Connecting to Devek.dev...',
            command: undefined
        },
        disconnected: {
            text: '$(plug) Devek.dev',
            tooltip: 'Click to login to Devek.dev',
            command: 'devek.login'
        },
        error: {
            text: '$(error) Devek.dev',
            tooltip: 'Connection error - Click to retry',
            command: 'devek.reconnect'
        },
        initializing: {
            text: '$(loading~spin) Devek.dev',
            tooltip: 'Initializing Devek.dev...',
            command: undefined
        }
    };

    const currentStatus = statusMap[status];
    statusBarItem.text = currentStatus.text;
    statusBarItem.tooltip = currentStatus.tooltip;
    statusBarItem.command = currentStatus.command;
    statusBarItem.show();
}

function showLoginPrompt() {
    vscode.window.showInformationMessage(
        'Please login to use Devek.dev',
        'Login',
        'Learn More'
    ).then(selection => {
        if (selection === 'Login') {
            vscode.commands.executeCommand('devek.login');
        } else if (selection === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://devek.dev'));
        }
    });
}

function connectToWebSocket(context: vscode.ExtensionContext, loginData?: WebSocketMessage) {
    const computerName = os.hostname();
    const environment = vscode.env.appName || 'Unknown';
    const wsUrl = process.env.DEVEK_WS_URL || 'ws://localhost:8080';
    
    if (ws) {
        ws.close();
    }

    ws = new WebSocket(wsUrl);
    updateStatusBar('connecting');

    ws.on('open', () => {
        console.log('Connected to WebSocket server.');
        reconnectAttempts = 0;
        
        if (authToken) {
            ws?.send(JSON.stringify({ type: 'auth', token: authToken }));
        } else if (loginData) {
            ws?.send(JSON.stringify(loginData));
        }
    });

    ws.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString()) as WebSocketMessage;
            
            if (response.status === 'success' && response.token) {
                authToken = response.token;
                context.globalState.update('devekAuthToken', authToken);
                updateStatusBar('connected');
                vscode.window.showInformationMessage('Successfully connected to Devek.dev');
            } else if (response.status === 'error') {
                vscode.window.showErrorMessage(response.message || 'An error occurred');
                if (response.message?.includes('Authentication failed')) {
                    authToken = null;
                    context.globalState.update('devekAuthToken', null);
                    updateStatusBar('disconnected');
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            updateStatusBar('error');
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        updateStatusBar('error');
        handleReconnection(context);
    });

    ws.on('close', () => {
        console.log('Disconnected from WebSocket server.');
        if (authToken) {
            updateStatusBar('error');
            handleReconnection(context);
        }
    });

    // Listen for document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!authToken || !ws || ws.readyState !== WebSocket.OPEN) return;

            const document = event.document;
            const changes = event.contentChanges;
            const timestamp = new Date().toISOString();

            changes.forEach(change => {
                const { range, text } = change;
                const { start, end } = range;

                const changeData: WebSocketMessage = {
                    type: 'change',
                    data: {
                        document_uri: document.uri.toString(),
                        timestamp,
                        start_line: start.line,
                        start_character: start.character,
                        end_line: end.line,
                        end_character: end.character,
                        text,
                        computer_name: computerName,
                        environment
                    }
                };

                ws?.send(JSON.stringify(changeData));
            });
        })
    );
}

function handleReconnection(context: vscode.ExtensionContext) {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
            if (authToken) {
                connectToWebSocket(context);
            }
        }, RECONNECT_INTERVAL);
    } else {
        vscode.window.showErrorMessage(
            'Failed to connect to Devek.dev. Would you like to try again?',
            'Retry',
            'Cancel'
        ).then(selection => {
            if (selection === 'Retry') {
                reconnectAttempts = 0;
                connectToWebSocket(context);
            }
        });
    }
}

export function deactivate() {
    if (ws) {
        ws.close();
        console.log('WebSocket connection closed.');
    }
}