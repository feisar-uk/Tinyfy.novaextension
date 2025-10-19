// Track which dependencies are actually available
const dependencies = {
    npm: false,
    terser: false,
    lightningcss: false
};

exports.activate = async function() {
    console.log("Activating Tinyfier extension...");

    // STEP 1: Check if Node/NPM is installed
    const npmCheck = await checkCommand("npm", ["--version"]);
    dependencies.npm = npmCheck.success;

    if (!dependencies.npm) {
        showNotification(
            "dependency-error",
            "NPM Not Found",
            "Node.js and NPM are required. Please install them to use this extension.",
            "https://nodejs.org/"
        );
        console.error("NPM not found. Aborting activation.");
        return;
    }

    console.log(`NPM version ${npmCheck.version} detected.`);

    // STEP 2: Check for Terser (if enabled)
    const terserEnabled = nova.config.get("terser.enabled", "boolean") ?? true;
    if (terserEnabled) {
        const terserCheck = await checkCommand("npx", ["terser", "--version"]);
        dependencies.terser = terserCheck.success;

        if (!dependencies.terser) {
            showNotification(
                "dependency-error",
                "Terser Not Found",
                "Terser could not be found. Install it with: npm install -g terser",
                "https://www.npmjs.com/package/terser"
            );
            console.error("Terser not found but is enabled in settings.");
        } else {
            console.log(`Terser version ${terserCheck.version} is installed and enabled.`);
        }
    }

    // STEP 3: Check for Lightning CSS (if enabled)
    const lightningEnabled = nova.config.get("lightningcss.enabled", "boolean") ?? true;
    if (lightningEnabled) {
        const lightningCheck = await checkCommand("npx", ["lightningcss", "--version"]);
        dependencies.lightningcss = lightningCheck.success;

        if (!dependencies.lightningcss) {
            showNotification(
                "dependency-error",
                "Lightning CSS Not Found",
                "Lightning CSS could not be found. Install it with: npm install -g lightningcss-cli",
                "https://www.npmjs.com/package/lightningcss-cli"
            );
            console.error("Lightning CSS not found but is enabled in settings.");
        } else {
            console.log(`Lightning CSS version ${lightningCheck.version} is installed and enabled.`);
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
                console.log("Terser is disabled in settings.");
                return;
            }

            // Skip already minified files
            if (filePath.endsWith(".min.js")) {
                console.log("Skipping already minified JS file.");
                return;
            }

            minifyJS(filePath);
        }
        // Handle CSS files
        else if (syntax === "css" || syntax === "scss" || syntax === "less") {
            const lightningEnabled = nova.config.get("lightningcss.enabled", "boolean") ?? true;
            if (!lightningEnabled) {
                console.log("Lightning CSS is disabled in settings.");
                return;
            }

            // Skip already minified files
            if (filePath.endsWith(".min.css")) {
                console.log("Skipping already minified CSS file.");
                return;
            }

            minifyCSS(filePath);
        }
    } catch (error) {
        console.error("Error in handleSave:", error);
        showNotification("minify-error", "Minification Error", `Unexpected error: ${error.message}`);
    }
}

// Minify JavaScript using Terser
async function minifyJS(inputPath) {
    // Check if Terser is actually installed
    if (!dependencies.terser) {
        showNotification(
            "tool-not-installed",
            "Terser Not Installed",
            "Cannot minify JavaScript. Please install Terser: npm install -g terser",
            "https://www.npmjs.com/package/terser"
        );
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
            "Terser: Minified Successfully",
            `${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`
        );
        console.log(`${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`);

    } catch (error) {
        showNotification(
            "minify-error",
            "Terser: Minification Failed",
            error.message
        );
        console.error("JS Minification failed:", error);
    }
}

// Minify CSS using Lightning CSS
async function minifyCSS(inputPath) {
    // Check if Lightning CSS is actually installed
    if (!dependencies.lightningcss) {
        showNotification(
            "tool-not-installed",
            "Lightning CSS Not Installed",
            "Cannot minify CSS. Please install Lightning CSS: npm install -g lightningcss-cli",
            "https://www.npmjs.com/package/lightningcss-cli"
        );
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
            "Lightning CSS: Minified Successfully",
            `${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`
        );
        console.log(`${filename} processed in ${duration}ms (saved ${formatBytes(savedAmount)})`);

    } catch (error) {
        showNotification(
            "minify-error",
            "Lightning CSS: Minification Failed",
            error.message
        );
        console.error("CSS Minification failed:", error);
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

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
};
