

**Tinyfy** automatically minimizes local `.js` and `.css` files on save.

For JS minification, it uses [Terser](https://github.com/terser/terser) - which is a maintained, ES6+ supporting fork of `uglify-es` and `uglify-js`.

For CSS minification, it uses [Lightning CSS](https://github.com/parcel-bundler/lightningcss) - which is an extremely fast CSS minifier written in Rust.


## Features

- Checks for Node, Terser and Lightning CSS on activation and prompts to install if necessary
- Notifies user of time taken and bytes saved
- Extensive logging for all functions
- Notifies user if file is remote that minification is skipped.

<!--
🎈 It can also be helpful to include a screenshot or GIF showing your extension in action:
-->

![](https://nova.app/images/en/dark/editor.png)

## Requirements

<!--
🎈 If your extension depends on external processes or tools that users will need to have, it's helpful to list those and provide links to their installers:
-->

Tinyfy requires some additional tools to be installed on your Mac:

- [Node.js 8.2.0](https://nodejs.org) and NPM 5.2.0 or newer
- [Terser](https://github.com/terser/terser) to minify JavaScript
- [Lightning CSS](https://github.com/parcel-bundler/lightningcss) to minify CSS

Installing Lightning CSS standalone CLI

npm install --save-dev lightningcss-cli

<!--
✨ Providing tips, tricks, or other guides for installing or configuring external dependencies can go a long way toward helping your users have a good setup experience:
-->

> To install the current stable version of Node, click the "Recommended for Most Users" button to begin the download. When that completes, double-click the **.pkg** installer to begin installation.

## Usage

<!--
🎈 If users will interact with your extension manually, describe those options:
-->

To run Tinyfy:

- Select the **Editor → Tinyfy** menu item; or
- Open the command palette and type `Tinyfy`

<!--
🎈 Alternatively, if your extension runs automatically (as in the case of a validator), consider showing users what they can expect to see:
-->

Tinyfy runs any time you open a local project, automatically lints all open files, then reports errors and warnings in Nova's **Issues** sidebar and the editor gutter:

![](https://nova.app/images/en/light/tools/sidebars.png)

### Configuration

<!--
🎈 If your extension offers global- or workspace-scoped preferences, consider pointing users toward those settings. For example:
-->

To configure global preferences, open **Extensions → Extension Library...** then select Tinyfy's **Preferences** tab.

You can also configure preferences on a per-project basis in **Project → Project Settings...**

<!--
👋 That's it! Happy developing!

P.S. If you'd like, you can remove these comments before submitting your extension 😉
-->
