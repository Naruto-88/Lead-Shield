const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!code.includes('PremiumTiltCard')) {
  code = code.replace(/^import React/, "import PremiumTiltCard from '../components/ui/PremiumTiltCard';\nimport React");
}

let currentIndex = 0;
let replacedCount = 0;

while (true) {
  const substr = code.substring(currentIndex);
  const match = substr.match(/<div className="[^"]*bg-white[^"]*shadow[^"]*">/);
  if (!match) break;
  
  const startIndex = currentIndex + match.index;
  const matchLength = match[0].length;
  
  const classMatch = match[0].match(/className="([^"]+)"/);
  const className = classMatch ? classMatch[1] : '';
  
  // We remove bg-white and text colors that clash with dark theme
  let newClassName = className.replace(/bg-white\/?\d*/g, '').replace(/text-\[#082b36\]/g, 'text-white').replace(/border-\[#096260\]\/\d+/g, '');
  const newOpen = `<PremiumTiltCard className="${newClassName}">`;
  
  code = code.substring(0, startIndex) + newOpen + code.substring(startIndex + matchLength);
  
  let depth = 1;
  let searchIndex = startIndex + newOpen.length;
  
  while (depth > 0 && searchIndex < code.length) {
    const nextOpen = code.indexOf('<div', searchIndex);
    const nextClose = code.indexOf('</div', searchIndex);
    
    if (nextClose === -1) break;
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      searchIndex = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        code = code.substring(0, nextClose) + '</PremiumTiltCard>' + code.substring(nextClose + 6);
        break;
      }
      searchIndex = nextClose + 6;
    }
  }
  
  currentIndex = startIndex + newOpen.length;
  replacedCount++;
}

// Add neon glows to UI buttons
code = code.replace(/bg-\[#096260\] text-white shadow-md ring-1 ring-white\/10/g, 'bg-[#170933] text-[#00ffff] neon-glow-cyan ring-1 ring-[#00ffff]/50 border border-[#00ffff]/20');
code = code.replace(/text-\[#5fb4a9\] hover:bg-white\/5/g, 'text-[#b026ff] hover:bg-[#170933]/50 hover:text-[#00ffff] transition-all');

// Convert basic texts to dark mode compatible colors
code = code.replace(/text-\[#082b36\]/g, 'text-white');
code = code.replace(/text-gray-500/g, 'text-gray-300');
code = code.replace(/text-gray-600/g, 'text-gray-300');
code = code.replace(/text-\[#5fb4a9\]/g, 'text-[#00ffff]');
code = code.replace(/text-\[#096260\]/g, 'text-[#00ffff]');

fs.writeFileSync('src/pages/Dashboard.tsx', code);
console.log(`Rewrote dashboard successfully! Replaced ${replacedCount} cards.`);
