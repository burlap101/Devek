// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Client } from 'pg';
import * as os from 'os'; // Import os module

let client: Client;

export function activate(context: vscode.ExtensionContext) {
    console.log('Devek.dev is now active!');

    // Retrieve the computer name (hostname)
    const computerName = os.hostname();

    // Create a PostgreSQL client
    client = new Client({
        connectionString: 'postgres://tsdbadmin:ceudmufilo1ne1pw@kk8civvmu8.dqyl5m0bpf.tsdb.cloud.timescale.com:38026/tsdb?sslmode=require',
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Connect to the database
    client.connect()
        .then(() => console.log('Connected to TimescaleDB!'))
        .catch(err => console.error('Database connection error:', err));

    // Example of using client later in the code
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            const changes = event.contentChanges;
            const timestamp = new Date().toISOString();

            changes.forEach(change => {
                const { range, text } = change;
                const { start, end } = range;

                // Insert data into the database, including the computer name
                const query = `
                    INSERT INTO code_changes (
                        document_uri, timestamp, start_line, start_character,
                        end_line, end_character, text, computer_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `;
                const values = [
                    document.uri.toString(),
                    timestamp,
                    start.line,
                    start.character,
                    end.line,
                    end.character,
                    text,
                    computerName
                ];

                client.query(query, values).catch(err => console.error('Error inserting data:', err));
            });
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (client) {
        client.end().then(() => console.log('Database connection closed.'));
    }
}
