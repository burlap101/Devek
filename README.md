# **Devek.dev**

Track every keystroke in your code with precise timestamps and save the data to **TimescaleDB** for detailed analysis and insights.

---

## **Features**

- **Keystroke Tracking**: Automatically logs every code change you make in VS Code.
- **Timestamps**: Records the exact time for each change.
- **Database Integration**: Saves the data to a TimescaleDB instance for analytics and historical tracking.
- **Productivity Insights**: Use your data to analyze coding patterns, identify bottlenecks, and improve efficiency.

---

## **Requirements**

- **TimescaleDB Instance**: 
  - Ensure you have a TimescaleDB instance running.
  - Provide the connection string in the extension's settings.

- **VS Code 1.70.0 or later**.

---

## **Extension Settings**

This extension contributes the following settings:

- `devekDev.dbConnection`: Set the TimescaleDB connection string.
- `devekDev.enableTracking`: Enable or disable keystroke tracking.

---

## **Known Issues**

- High-frequency changes in large files may result in increased memory usage.
- Ensure stable database connectivity to avoid data loss during tracking.

---

## **Release Notes**

### 1.0.0
- Initial release of **Devek.dev**.
- Features:
  - Tracks all keystrokes in the editor.
  - Saves changes to TimescaleDB with timestamps.

---

## **Extension Guidelines**

Ensure you follow the extension guidelines and best practices while using this extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

## **For more information**

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy using Devek.dev!**
