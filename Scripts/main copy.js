// Track which dependencies are actually available
const dependencies = {
    npm: false,
    terser: false,
    lightningcss: false
};

exports.activate = async function() {
    console.log("Activating Minifier extension (Terser + Lightning CSS)...");

    // STEP 1: Check if Node/NPM is installed
    dependencies.npm = await checkCommand("npm", ["--version"]);
    if (!dependencies.npm) {
        showDependencyError(
            "NPM Not Found",
            "Node.js and NPM are required. Please install them to use this extension.",
            "https://nodejs.org/"
        );
        console.error("NPM not found. Aborting activation.");
        return;
    }

    // STEP 2: Check for Terser (if enabled)
    const terserEnabled = nova.config.get("terser.enabled", "boolean") ?? true;
    if (terserEnabled) {
        dependencies.terser = await checkCommand("npx", ["terser", "--version"]);
        if (!dependencies.terser) {
            showDependencyError(
                "Terser Not Found",
                "Terser could not be found. Install it with: npm install -g terser",
                "https://www.npmjs.com/package/terser"
            );
            console.error("Terser not found but is enabled in settings.");
        } else {
            console.log("Terser is installed and enabled.");
        }
    }

    // STEP 3: Check for Lightning CSS (if enabled)
    const lightningEnabled = nova.config.get("lightningcss.enabled", "boolean") ?? true;
    if (lightningEnabled) {
        dependencies.lightningcss = await checkCommand("npx", ["lightningcss", "--version"]);
        if (!dependencies.lightningcss) {
            showDependencyError(
                "Lightning CSS Not Found",
                "Lightning CSS could not be found. Install it with: npm install -g lightningcss-cli",
                "https://www.npmjs.com/package/lightningcss-cli"
            );
            console.error("Lightning CSS not found but is enabled in settings.");
        } else {
            console.log("Lightning CSS is installed and enabled.");
        }
    }

    console.log("Registering save listeners...");

    // Register save listeners for all editors
    nova.workspace.textEditors.forEach(editor => {
        editor.onDidSave(handleSave);
    });
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

// Check if a command-line tool is available
function checkCommand(command, args = []) {
    return new Promise(resolve => {
        const process = new Process("/usr/bin/env", {
            args: [command, ...args],
            stdio: "ignore"
        });
        process.onDidExit(status => {
            resolve(status === 0);
        });
        process.start();
    });
}

// Show a notification with an optional action
function showDependencyError(title, body, url) {
    const request = new NotificationRequest("dependency-error");
    request.title = title;
    request.body = body;
    if (url) {
        request.actions = ["Learn More"];
    }

    nova.notifications.add(request).then(reply => {
        if (reply.actionIdx === 0) {
            nova.openURL(url);
        }
    });
}

// Handle file save events
function handleSave(editor) {
    const syntax = editor.document.syntax;
    const filePath = editor.document.path;

    if (!filePath) {
        return;
    }

    const checkRemote = nova.fs.stat(filePath);

    if (checkRemote === undefined) {
        // File is likely remote or inaccessible. Show notification and abort.
        const notification = new NotificationRequest("remote-file-unsupported");
        notification.title = "Minification Skipped";
        notification.body = `Cannot process remote file: ${nova.path.basename(filePath)}. \nOnly local files are supported.`;
        nova.notifications.add(notification);
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
}

// Minify JavaScript using Terser
async function minifyJS(inputPath) {
    // Check if Terser is actually installed
    if (!dependencies.terser) {
        const notification = new NotificationRequest("terser-not-installed");
        notification.title = "Terser Not Installed";
        notification.body = "Cannot minify JavaScript. Please install Terser: npm install -g terser";
        notification.actions = ["Learn More"];
        nova.notifications.add(notification).then(reply => {
            if (reply.actionIdx === 0) {
                nova.openURL("https://www.npmjs.com/package/terser");
            }
        });
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
        // Read the file content (works for both local and remote files)
        const fileContent = await nova.fs.open(inputPath, "r");
        const content = fileContent.read();
        fileContent.close();

        const originalSize = content.length;
        const startTime = Date.now();

        await new Promise((resolve, reject) => {
            const process = new Process("/usr/bin/env", {
                args: ["npx", "terser", "--compress", "--mangle"],
                stdio: "pipe",
                shell: false
            });

            let stderrOutput = "";
            let stdoutOutput = "";

            // Send the file content to stdin
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
                console.error("Terser Error:", line.trim());
            });

            process.onDidExit(async (status) => {
                if (status === 0) {
                    // Write the minified output to the destination file
                    try {
                        const outputFile = await nova.fs.open(outputPath, "w");
                        outputFile.write(stdoutOutput);
                        outputFile.close();
                        resolve(status);
                    } catch (writeError) {
                        reject(new Error(`Failed to write output file: ${writeError.message}`));
                    }
                } else {
                    reject(new Error(`Terser failed with status ${status}. Error: ${stderrOutput.trim()}`));
                }
            });

            process.start();
        });

        const duration = Date.now() - startTime;
        const filename = nova.path.basename(outputPath);

        // Try to get size information for the notification
        let savedInfo = "";
        if (originalSize !== null) {
            try {
                const minifiedStats = await nova.fs.stat(outputPath);
                const savedAmount = originalSize - minifiedStats.size;
                savedInfo = ` (saved ${formatBytes(savedAmount)})`;
            } catch (e) {
                console.log("Could not stat output file for size comparison.");
            }
        }

        const notification = new NotificationRequest("terser-success");
        notification.title = "Terser: Minified Successfully";
        notification.body = `${filename} processed in ${duration}ms${savedInfo}`;
        nova.notifications.add(notification);

    } catch (error) {
        const notification = new NotificationRequest("terser-failed");
        notification.title = "Terser: Minification Failed";
        notification.body = `An error occurred: ${error.message}`;
        console.error("JS Minification failed:", error);
        nova.notifications.add(notification);
    }
}

// Minify CSS using Lightning CSS
async function minifyCSS(inputPath) {
    // Check if Lightning CSS is actually installed
    if (!dependencies.lightningcss) {
        const notification = new NotificationRequest("lightningcss-not-installed");
        notification.title = "Lightning CSS Not Installed";
        notification.body = "Cannot minify CSS. Please install Lightning CSS: npm install -g lightningcss-cli";
        notification.actions = ["Learn More"];
        nova.notifications.add(notification).then(reply => {
            if (reply.actionIdx === 0) {
                nova.openURL("https://www.npmjs.com/package/lightningcss-cli");
            }
        });
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
        // Check if file is remote by trying to stat it
        let originalSize = null;
        try {
            const originalStats = await nova.fs.stat(inputPath);
            originalSize = originalStats?.size;
        } catch (e) {
            console.log("Could not stat file (likely remote), skipping size comparison.");
        }

        const startTime = Date.now();

        await new Promise((resolve, reject) => {
            const process = new Process("/usr/bin/env", {
                args: ["npx", "lightningcss", "--minify", inputPath, "-o", outputPath],
                stdio: "pipe",
                shell: false
            });

            let stderrOutput = "";
            process.onStderr((line) => {
                stderrOutput += line;
                console.error("Lightning CSS Error:", line.trim());
            });

            process.onDidExit((status) => {
                if (status === 0) {
                    resolve(status);
                } else {
                    reject(new Error(`Lightning CSS failed with status ${status}. Error: ${stderrOutput.trim()}`));
                }
            });

            process.start();
        });

        const duration = Date.now() - startTime;
        const filename = nova.path.basename(outputPath);

        // Try to get size information for the notification
        let savedInfo = "";
        if (originalSize !== null) {
            try {
                const minifiedStats = await nova.fs.stat(outputPath);
                const savedAmount = originalSize - minifiedStats.size;
                savedInfo = ` (saved ${formatBytes(savedAmount)})`;
            } catch (e) {
                console.log("Could not stat output file for size comparison.");
            }
        }

        const notification = new NotificationRequest("lightningcss-success");
        notification.title = "Lightning CSS: Minified Successfully";
        notification.body = `${filename} processed in ${duration}ms${savedInfo}`;
        nova.notifications.add(notification);

    } catch (error) {
        const notification = new NotificationRequest("lightningcss-failed");
        notification.title = "Lightning CSS: Minification Failed";
        notification.body = `An error occurred: ${error.message}`;
        console.error("CSS Minification failed:", error);
        nova.notifications.add(notification);
    }
}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
};
