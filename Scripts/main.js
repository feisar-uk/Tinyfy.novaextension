// Track which dependencies are actually available
const dependencies = {
    npm: false,
    terser: false,
    lightningcss: false
};

exports.activate = async function() {
    console.log("Activating Tinyfy extension...");

    // STEP 1: Check if Node/NPM is installed
    const npmCheck = await checkCommand("npm", ["-v"]);
    dependencies.npm = npmCheck.success;

    if (!dependencies.npm) {
        showNotification(
            "dependency-error",
            "NPM Not Found",
            "Node.js and NPM are required. Please install them to use this extension.",
            "https://nodejs.org/en/download"
        );
        console.error("NPM not found. Aborting activation.");
        return;
    }

    console.log(`NPM version ${npmCheck.version} detected.`);

    // STEP 2: Check for Terser (if enabled)
    const terserEnabled = nova.config.get("terser.enabled", "boolean") ?? true;
    if (terserEnabled) {
        const terserCheck = await checkCommand("npm", ["list", "-g", "terser", "--depth=0"]);
        dependencies.terser = terserCheck.success;

        if (!dependencies.terser) {
            console.error("Terser not found but is enabled in settings.");
            showNotification(
                "dependency-error-terser",
                "Terser Not Found",
                "Please install it with:\nnpm install terser -g",
                "https://github.com/terser/terser?tab=readme-ov-file#install"
            );
        } else {
            // Get the actual version with a separate command
            const versionCheck = await checkCommand("terser", ["--version"]);
            console.log(`Terser version ${versionCheck.version} is installed and enabled.`);
        }
    }

    // STEP 3: Check for Lightning CSS (if enabled)
    const lightningEnabled = nova.config.get("lightningcss.enabled", "boolean") ?? true;
    if (lightningEnabled) {
        const lightningCheck = await checkCommand("npm", ["list", "-g", "lightningcss-cli", "--depth=0"]);
        dependencies.lightningcss = lightningCheck.success;

        if (!dependencies.lightningcss) {
            console.error("Lightning CSS not found but is enabled in settings.");
            showNotification(
                "dependency-error-lightningcss",
                "Lightning CSS Not Found",
                "Please install it with: \nnpm install lightningcss-cli -g",
                "https://lightningcss.dev/docs.html#from-the-cli"
            );
        } else {
            // Get the actual version with a separate command
            const versionCheck = await checkCommand("lightningcss", ["--version"]);
            console.log(`Lightning CSS version ${versionCheck.version} is installed and enabled.`);
        }
    }

    console.log("Registering save listeners...");

    // Register save listener only for new editors
    // Note: This will catch existing editors when they're first accessed
    nova.workspace.onDidAddTextEditor(editor => {
        editor.onDidSave(handleSave);
    });
};

// Format bytes for display
function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
}

// Check if a command-line tool is available and return its version
function checkCommand(command, args = []) {
    return new Promise(resolve => {
        const process = new Process("/usr/bin/env", {
            args: [command, ...args],
            stdio: "pipe"
        });

        let output = "";

        process.onStdout((line) => {
            output += line.trim();
        });

        process.onDidExit(status => {
            if (status === 0) {
                resolve({ success: true, version: output });
            } else {
                resolve({ success: false, version: null });
            }
        });

        process.start();
    });
}

// Show a notification with optional action
function showNotification(id, title, body, url = null) {
    const notification = new NotificationRequest(id);
    notification.title = title;
    notification.body = body;

    if (url) {
        notification.actions = ["Learn More"];
        nova.notifications.add(notification).then(reply => {
            if (reply.actionIdx === 0) {
                nova.openURL(url);
            }
        });
    } else {
        nova.notifications.add(notification);
    }
}

// Check if a file is remote (not accessible via local filesystem)
function isRemoteFile(filePath) {
    try {
        const stats = nova.fs.stat(filePath);
        return stats === undefined || stats === null;
    } catch (e) {
        return true;
    }
}

// Handle file save events
function handleSave(editor) {
    try {
        const syntax = editor.document.syntax;
        const filePath = editor.document.path;

        if (!filePath) {
            return;
        }

        // Check if file is remote and skip processing
        if (isRemoteFile(filePath)) {
            showNotification(
                "remote-file-unsupported",
                "Minification Skipped",
                `Cannot process remote file: ${nova.path.basename(filePath)}.\nOnly local files are supported.`
            );
            console.log(`Skipping minification for remote file: ${filePath}`);
            return;
        }

        // Handle JavaScript files
        if (syntax === "javascript") {
            const terserEnabled = nova.config.get("terser.enabled", "boolean") ?? true;
            if (!terserEnabled) {
                console.log("JS minification is disabled in settings.");
                return;
            }

            // Skip already minified files
            if (filePath.endsWith(".min.js")) {
                console.log("Skipping already minified JS file.");
                return;
            }

            minifyJS(editor, filePath);
        }
        // Handle CSS files
        else if (syntax === "css") {
            const lightningEnabled = nova.config.get("lightningcss.enabled", "boolean") ?? true;
            if (!lightningEnabled) {
                console.log("CSS minification is disabled in settings.");
                return;
            }

            // Skip already minified files
            if (filePath.endsWith(".min.css")) {
                console.log("Skipping already minified CSS file.");
                return;
            }

            minifyCSS(editor, filePath);
        }
    } catch (error) {
        console.error("Error in handleSave:", error);
        showNotification("minify-error", "Minification Error", `Unexpected error: ${error.message}`);
    }
}

// Minify JavaScript using Terser
async function minifyJS(editor, inputPath) {
    // Check if Terser is actually installed
    if (!dependencies.terser) {
        console.error("Attempted to minify JS but Terser is not installed.");
        return;
    }

    const suffix = nova.config.get("terser.outputSuffix", "string") || ".min.js";
    const outputPath = inputPath.replace(/\.js$/, suffix);

    if (inputPath === outputPath) {
        console.error("Input and output paths are the same. Aborting to prevent overwrite.");
        return;
    }

    try {
        const fileContent = nova.fs.open(inputPath, "r");
        const content = fileContent.read();
        fileContent.close();

        if (!content || content.length === 0) {
            throw new Error("Input file is empty");
        }

        const originalSize = content.length;
        const startTime = Date.now();

        const minifiedContent = await runMinifier(
            ["npx", "terser", "--compress", "--mangle"],
            content,
            "Terser"
        );

        // Write the minified output
        const outputFile = nova.fs.open(outputPath, "w");
        outputFile.write(minifiedContent);
        outputFile.close();

        const duration = Date.now() - startTime;
        const minifiedSize = minifiedContent.length;
        const savedAmount = originalSize - minifiedSize;
        const filename = nova.path.basename(outputPath);

        showNotification(
            "minify-success",
            "JS Minified Successfully",
            `${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`
        );
        console.log(`${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`);

    } catch (error) {
        // Try to parse Terser error format: "Parse error at filename:line,col"
        // Example: "Parse error at 0:114,5" where 0 is the filename, 114 is line, 5 is column
        const parseErrorMatch = error.message.match(/Parse error at [^:]+:(\d+),(\d+)/i);

        if (parseErrorMatch) {
            const line = parseInt(parseErrorMatch[1], 10);
            const column = parseInt(parseErrorMatch[2], 10);

            // Try to jump to the error location in the editor
            jumpToError(editor, line, column);

            showNotification(
                "minify-error",
                "Error Parsing JavaScript",
                `Check near line ${line}, column ${column} for the error.`
            );
            console.error(`JS Parse Error at line ${line}, column ${column}:`, error.message);
        } else {
            showNotification(
                "minify-error",
                "JS Minification Failed",
                error.message
            );
            console.error("JS Minification failed:", error);
        }
    }
}

// Minify CSS using Lightning CSS
async function minifyCSS(editor, inputPath) {
    // Check if Lightning CSS is actually installed
    if (!dependencies.lightningcss) {
        console.error("Attempted to minify CSS but Lightning CSS is not installed.");
        return;
    }

    const suffix = nova.config.get("lightningcss.outputSuffix", "string") || ".min.css";
    const outputPath = inputPath.replace(/\.(css|scss|less)$/, suffix);

    if (inputPath === outputPath) {
        console.error("Input and output paths are the same. Aborting to prevent overwrite.");
        return;
    }

    try {
        const originalStats = nova.fs.stat(inputPath);
        const originalSize = originalStats.size;
        const startTime = Date.now();

        // Lightning CSS requires file paths, not stdin
        await new Promise((resolve, reject) => {
            const process = new Process("/usr/bin/env", {
                args: ["npx", "lightningcss", "--minify", inputPath, "-o", outputPath],
                stdio: "pipe",
                shell: false
            });

            let stderrOutput = "";

            process.onStderr((line) => {
                stderrOutput += line;
            });

            process.onDidExit((status) => {
                if (status === 0) {
                    resolve();
                } else {
                    const errorMsg = stderrOutput.trim() || `Process exited with status ${status}`;
                    reject(new Error(errorMsg));
                }
            });

            process.start();
        });

        const duration = Date.now() - startTime;
        const minifiedStats = nova.fs.stat(outputPath);
        const savedAmount = originalSize - minifiedStats.size;
        const filename = nova.path.basename(outputPath);

        showNotification(
            "minify-success",
            "CSS Minified Successfully",
            `${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`
        );
        console.log(`${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`);

    } catch (error) {
        // Try to parse Lightning CSS error format from Rust panic messages
        // Example: ErrorLocation { filename: "main.css", line: 304, column: 2 }
        const errorLocationMatch = error.message.match(/line:\s*(\d+),\s*column:\s*(\d+)/i);

        if (errorLocationMatch) {
            const line = parseInt(errorLocationMatch[1], 10);
            const column = parseInt(errorLocationMatch[2], 10);

            // Try to jump to the error location in the editor
            jumpToError(editor, line, column);

            // Try to extract the error kind for a better message
            const errorKindMatch = error.message.match(/kind:\s*(\w+)\(/i);
            const errorKind = errorKindMatch ? errorKindMatch[1] : "Parse Error";

            showNotification(
                "minify-error",
                `Error Parsing CSS: ${errorKind}`,
                `Check near line ${line}, column ${column} for the error.`
            );
            console.error(`CSS Error at line ${line}, column ${column}:`, error.message);
        } else {
            showNotification(
                "minify-error",
                "CSS Minification Failed",
                error.message
            );
            console.error("CSS Minification failed:", error);
        }
    }
}

// Run a minifier process with stdin/stdout
function runMinifier(args, content, toolName) {
    return new Promise((resolve, reject) => {
        const process = new Process("/usr/bin/env", {
            args: args,
            stdio: "pipe",
            shell: false
        });

        let stderrOutput = "";
        let stdoutOutput = "";

        const writer = process.stdin.getWriter();
        writer.ready.then(() => {
            writer.write(content);
            writer.close();
        });

        process.onStdout((line) => {
            stdoutOutput += line;
        });

        process.onStderr((line) => {
            stderrOutput += line;
        });

        process.onDidExit((status) => {
            if (status === 0) {
                if (!stdoutOutput || stdoutOutput.length === 0) {
                    reject(new Error(`${toolName} produced no output`));
                } else {
                    resolve(stdoutOutput);
                }
            } else {
                const errorMsg = stderrOutput.trim() || `Process exited with status ${status}`;
                reject(new Error(errorMsg));
            }
        });

        process.start();
    });
}

// Jump to a specific line and column in the editor
function jumpToError(editor, line, column) {
    // Terser uses 0-based line numbers, so we use them directly
    const lines = editor.document.getTextInRange(new Range(0, editor.document.length)).split('\n');

    // Calculate the character position in the document
    let position = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) {
        position += lines[i].length + 1; // +1 for newline character
    }
    position += column;

    // Ensure position doesn't exceed document length
    position = Math.min(position, editor.document.length);

    // Select the error position and scroll to it
    editor.selectedRange = new Range(position, position);
    editor.scrollToPosition(position);
}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
};
