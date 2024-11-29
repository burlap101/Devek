import * as vscode from 'vscode';
import * as os from 'os';
import WebSocket from 'ws'; // Import WebSocket library

let ws: WebSocket | null = null;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Devek.dev is now active!');

    // Retrieve the computer name (hostname)
    const computerName = os.hostname();

    // Dynamically determine the environment
    const environment = vscode.env.appName || 'Unknown';

    // Connect to WebSocket server
    const wsUrl = 'ws://localhost:8080'; // Replace with your WebSocket server URL
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Connected to WebSocket server.');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('Disconnected from WebSocket server.');
    });

    // Listen for document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            const changes = event.contentChanges;
            const timestamp = new Date().toISOString();

            changes.forEach(change => {
                const { range, text } = change;
                const { start, end } = range;

                // Prepare change data
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

                // Send change data to WebSocket server
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(changeData));
                    console.log('Sent data to WebSocket server:', changeData);
                } else {
                    console.error('WebSocket is not connected.');
                }
            });
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (ws) {
        ws.close();
        console.log('WebSocket connection closed.');
    }
}
