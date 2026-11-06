// Simple script to replace hardcoded hex colors with Tailwind utility classes
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const patterns = ['src/**/*.tsx','src/**/*.ts','src/**/*.js','src/**/*.jsx','src/**/*.css'];

const replacements = [
  [/bg\[#140D0A\]/g, 'bg-ink'],
  [/bg\[#241612\]/g, 'bg-surfaceCard'],
  [/bg\[#2F1D15\]/g, 'bg-surfaceRaised'],
  [/bg\[#38220F\]/g, 'bg-surfaceDark'],
  [/bg\[#3F2319\]/g, 'bg-border'],
  [/bg\[#55321F\]/g, 'bg-borderSoft'],
  [/bg\[#D28A4C\]/g, 'bg-primary'],
  [/bg\[#E89B55\]/g, 'bg-textAccent'],
  [/bg\[#F5F1EB\]/g, 'bg-foreground'],
  [/bg\[#F7F3EC\]/g, 'bg-textPrimary'],
  [/bg\[#CFB28C\]/g, 'bg-textSecondary'],
  [/bg\[#B39463\]/g, 'bg-secondary'],
  [/bg\[#F0805F\]/g, 'bg-textCoral'],
  [/text\[#140D0A\]/g, 'text-ink'],
  [/text\[#F5F1EB\]/g, 'text-foreground'],
  [/text\[#241612\]/g, 'text-surfaceCard'],
  [/text\[#2F1D15\]/g, 'text-surfaceRaised'],
  [/text\[#38220F\]/g, 'text-surfaceDark'],
  [/text\[#3F2319\]/g, 'text-border'],
  [/text\[#55321F\]/g, 'text-borderSoft'],
  [/text\[#D28A4C\]/g, 'text-primary'],
  [/text\[#E89B55\]/g, 'text-textAccent'],
  [/text\[#F7F3EC\]/g, 'text-textPrimary'],
  [/text\[#CFB28C\]/g, 'text-textSecondary'],
  [/text\[#B39463\]/g, 'text-secondary'],
  [/text\[#F0805F\]/g, 'text-textCoral'],
  [/border\[#140D0A\]/g, 'border-ink'],
  [/border\[#F5F1EB\]/g, 'border-foreground'],
  [/border\[#241612\]/g, 'border-surfaceCard'],
  [/border\[#2F1D15\]/g, 'border-surfaceRaised'],
  [/border\[#38220F\]/g, 'border-surfaceDark'],
  [/border\[#3F2319\]/g, 'border-border'],
  [/border\[#55321F\]/g, 'border-borderSoft'],
  [/border\[#D28A4C\]/g, 'border-primary'],
  [/border\[#E89B55\]/g, 'border-textAccent'],
  [/border\[#CFB28C\]/g, 'border-textSecondary'],
  [/border\[#B39463\]/g, 'border-secondary'],
  [/border\[#F0805F\]/g, 'border-textCoral']
];

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const [regex, repl] of replacements) {
    content = content.replace(regex, repl);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
}

patterns.forEach(pattern => {
  glob.sync(pattern, { cwd: path.resolve(__dirname, '..') }).forEach(f => processFile(path.resolve(__dirname, '..', f)));
});

console.log('Replacement complete');
