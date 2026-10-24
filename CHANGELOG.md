## Version 1.7 (24th October 2026)

- Adds support for `.mjs` Javascript module files (thanks [TheDigitalOrchard](https://github.com/TheDigitalOrchard))

## Version 1.6 (31st August 2026)

- Removed the now redundant code and Setting option to strip the trailing newline from the output since switching to file-based I/O (thanks [mbeekhuis](https://github.com/mbeekhuis))

## Version 1.5 (27th August 2026)

- Fixed an issue where minifying certain JavaScript files could hang indefinitely - Terser now reads and writes via file paths instead of piping the source through stdin (thanks [mbeekhuis](https://github.com/mbeekhuis))
- Removed some redundant code

## Version 1.4 (19th July 2026)

- Added configurable Terser flags (thanks [mbeekhuis](https://github.com/mbeekhuis))
- Added option to remove the trailing newline Terser's CLI appends to minified output (thanks [mbeekhuis](https://github.com/mbeekhuis))
- Added configurable Lightning CSS flags
- Now logs the full CLI invocation for each minifier to the Extension Console

## Version 1.3 (11th July 2026)

- Code optimisations and enhancements
- Fix extension not activating for CSS files if a JS file is not present (thanks [swinggraphics](https://github.com/swinggraphics))

## Version 1.2 (2nd January 2026)

- A notification is no longer shown when saving non-CSS or JS files on a remote server
- Updated README to explain extension limitations

## Version 1.1 (24th October 2025)

- If an error occurs while parsing a file, a notification will show the line and column numbers where the error occurred, and the editor will try to jump to that location in the file
- Improved the extension icon on retina displays and optimised file size

## Version 1.0 (21st October 2025)

- Initial release
