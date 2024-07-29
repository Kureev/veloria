const fs = require('fs')
const path = require('path')
const pjson = require('../package.json')
const child_process = require('child_process')

// Compile TypeScript
child_process.execSync('tsc')

// Path to the output file
const outputPath = path.join(__dirname, '..', pjson.main)

// Read the compiled file
const compiledCode = fs.readFileSync(outputPath, 'utf8')

// Shebang to be added
const shebang = '#!/usr/bin/env node\n'

// Write the shebang and the compiled code back to the file
fs.writeFileSync(outputPath, shebang + compiledCode, 'utf8')

// Make the file executable
fs.chmodSync(outputPath, '755')
