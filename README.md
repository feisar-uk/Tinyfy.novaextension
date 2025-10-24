# Tinyfy Extension for Nova

**Tinyfy** is an extension for the [Nova](https://nova.app) code editor from [Panic](https://panic.com), that  automatically minifies local `.js` and `.css` files on save, using [Terser](https://terser.org) for JS minification and [Lightning CSS](https://lightningcss.dev) for CSS minification.

Terser and Lightning CSS are both up-to-date and supported CLI tools. Alternatives such as `uglifycss`, `csso` and `uglify-js` are deprecated.

Tested with Nova 13.3 on macOS Sequoia 15.7.1

## Features

- Automatically checks for Node, Terser, and Lightning CSS on activation, and prompts for installation if needed
- Shows the time taken and how many bytes were saved during minification
- Alerts you when an error occurs parsing a file and will try to jump the editor to the line and column of the error
- Alerts you when minification is skipped for remote files
- Lets you disable CSS and JS minification separately
- Allows you to customise the minified file extension (e.g. `.min.js`  or `.min.css`)
- Skips files that are already minified
- Provides detailed logging in the Extension Console for every action

## Screenshot

![](https://www.feisar.uk/tinyfy/tinyfy.png)

## Requirements

Tinyfy requires some additional tools to be installed on your Mac:

- Current version of [Node.js](https://nodejs.org/en/download) and NPM
- [Terser](https://github.com/terser/terser) to minify JavaScript
- [Lightning CSS](https://github.com/parcel-bundler/lightningcss) CLI package to minify CSS

## Installation

### Installing Node.js and NPM

Follow your preferred installation method here: [https://nodejs.org/en/download](https://nodejs.org/en/download)

### Installing Lightning CSS standalone CLI

From the command line, enter:

`npm install lightningcss-cli -g`

### Installing Terser

From the command line, enter:

`npm install terser -g`

### Installing Tinify

- Relaunch Nova after installing Node, Terser and Lightning CSS
- In Nova, navigate to **Extensions > Extension Library...**
- Search for "Tinyfy"
- Click the **Install** button

## Using Tinyfy

When Tinyfy is active, it automatically minifies local `.js` and `.css` files on save, adding a `.min` prefix to the filename extension.
To avoid conflicts, it’s best to disable any other Nova extensions that also handle minification.
You can tweak the file extension or turn off minification entirely in the Extension settings.

### Configuration

To configure global settings, open **Extensions → Extension Library...** then select Tinyfy's **Settings** tab.

- You can disable CSS or JS minification by unchecking the corresponding checkbox
- You can change the filename extension of minified files by updating the **Output Suffix** text box
