# Drag-and-Drop Chemical Mixing Pattern

When generating chemistry simulations, include a draggable chemical shelf and a target beaker/vessel. Students drag chemicals to the beaker to trigger reactions.

## Layout

```
┌─────────────────────────────────────────────┐
│  CHEMICAL SHELF (top, horizontal row)        │
│  [Water💧] [Vinegar🧪] [Baking Soda⚪]      │
│  [Salt🧂] [Sugar🍬] [Lemon Juice🍋]        │
├─────────────────────────────────────────────┤
│                                              │
│   BEAKER (center, drop target)               │
│   ┌──────────────┐                           │
│   │  ~~~liquid~~~│  ← fill level changes     │
│   │              │  ← color changes          │
│   │  ○○ bubbles  │  ← reaction effects       │
│   └──────────────┘                           │
│                                              │
├─────────────────────────────────────────────┤
│  MIXED CHEMICALS (below beaker)              │
│  Current: Water + Vinegar                    │
│  [Clear Mixture] [Undo Last]                 │
├─────────────────────────────────────────────┤
│  REACTION RESULT                             │
│  "Vinegar + Baking Soda → CO₂ bubbles!"      │
│  pH: 3.2 | Temp: 22°C                        │
└─────────────────────────────────────────────┘
```

## HTML Structure

```html
<!-- Chemical Shelf -->
<div id="chemical-shelf" style="display:flex; gap:12px; padding:16px; background:rgba(15,23,42,0.9); border-radius:12px; flex-wrap:wrap; justify-content:center;">
  <div class="chemical-bottle" draggable="true" data-chemical="water" data-color="#00aaff" data-pH="7"
    style="cursor:grab; padding:12px 20px; background:rgba(255,255,255,0.1); border:2px solid rgba(255,255,255,0.2); border-radius:12px; text-align:center; user-select:none; transition:all 0.2s;">
    <div style="font-size:24px;">💧</div>
    <div style="color:#E2E8F0; font-size:13px; margin-top:4px;">Water</div>
    <div style="color:#94A3B8; font-size:11px;">H₂O</div>
  </div>
  <!-- Repeat for each chemical -->
</div>

<!-- Drop Target (Beaker) -->
<div id="beaker-zone" style="position:relative; width:200px; height:250px; margin:20px auto;">
  <svg id="beaker-svg" width="200" height="250" viewBox="0 0 200 250">
    <!-- Beaker outline -->
    <path d="M40,20 L40,200 Q40,230 100,230 Q160,230 160,200 L160,20" 
          fill="none" stroke="rgba(180,220,255,0.8)" stroke-width="3"/>
    <!-- Liquid fill (dynamic) -->
    <rect id="liquid-fill" x="42" y="200" width="116" height="0" 
          fill="rgba(0,170,255,0.4)" rx="2">
      <animate attributeName="height" dur="0.5s" fill="freeze"/>
    </rect>
    <!-- Meniscus curve -->
    <path id="meniscus" d="" fill="rgba(0,170,255,0.3)" stroke="none"/>
    <!-- Bubble container -->
    <g id="bubble-container"></g>
  </svg>
  <!-- Drop indicator -->
  <div id="drop-indicator" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); 
       color:rgba(255,255,255,0.3); font-size:14px; pointer-events:none; text-align:center;">
    Drop chemicals here
  </div>
</div>

<!-- Mixed Chemicals List -->
<div id="mixed-list" style="padding:12px; background:rgba(15,23,42,0.9); border-radius:8px; min-height:40px;">
  <div style="color:#94A3B8; font-size:12px;">Mixed: <span id="mixed-names">None</span></div>
</div>

<!-- Reaction Result -->
<div id="reaction-result" style="padding:16px; background:rgba(15,23,42,0.95); border-radius:12px; border-left:3px solid #60A5FA; display:none;">
  <div style="color:#E2E8F0; font-size:14px; font-weight:600;" id="reaction-title"></div>
  <div style="color:#94A3B8; font-size:13px; margin-top:4px;" id="reaction-description"></div>
  <div style="color:#60A5FA; font-size:12px; margin-top:8px; font-family:monospace;" id="reaction-equation"></div>
</div>
```

## JavaScript Implementation

```javascript
// Chemical data
const chemicals = {
  water:       { name:'Water',       formula:'H₂O',      color:'#00aaff', pH:7,  state:'liquid' },
  vinegar:     { name:'Vinegar',     formula:'CH₃COOH',  color:'#ffeeaa', pH:3,  state:'liquid' },
  'baking-soda':{ name:'Baking Soda', formula:'NaHCO₃',  color:'#ffffff', pH:9,  state:'solid' },
  salt:        { name:'Salt',        formula:'NaCl',      color:'#eeeeee', pH:7,  state:'solid' },
  sugar:       { name:'Sugar',       formula:'C₁₂H₂₂O₁₁', color:'#fff5e6', pH:7, state:'solid' },
  'lemon-juice':{ name:'Lemon Juice', formula:'C₆H₈O₇',  color:'#ffff99', pH:2,  state:'liquid' },
};

// Reaction rules
const reactions = {
  'vinegar+baking-soda': {
    title: 'Acid-Base Reaction!',
    description: 'Vinegar reacts with baking soda to produce carbon dioxide gas.',
    equation: 'CH₃COOH + NaHCO₃ → CH₃COONa + H₂O + CO₂↑',
    visualization: 'bubbles',
    color: '#ffeeaa',
    temperature: 'rises'
  },
  'water+salt': {
    title: 'Dissolution',
    description: 'Salt dissolves in water to form a saline solution.',
    equation: 'NaCl(s) → Na⁺(aq) + Cl⁻(aq)',
    visualization: 'color-change',
    color: '#e0f0ff'
  },
  'water+sugar': {
    title: 'Dissolution',
    description: 'Sugar dissolves in water to form a sweet solution.',
    equation: 'C₁₂H₂₂O₁₁(s) → C₁₂H₂₂O₁₁(aq)',
    visualization: 'color-change',
    color: '#fff8e6'
  },
  'vinegar+lemon-juice': {
    title: 'Acid Mixture',
    description: 'Two acids mixed — no reaction, but pH drops further.',
    equation: 'No reaction (both acidic)',
    visualization: 'none',
    color: '#ffee88'
  }
};

// State
let mixedChemicals = [];
let liquidLevel = 0;
let liquidColor = 'rgba(0,170,255,0.4)';

// Drag and drop
document.querySelectorAll('.chemical-bottle').forEach(bottle => {
  bottle.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('chemical', bottle.dataset.chemical);
    bottle.style.opacity = '0.5';
    bottle.style.transform = 'scale(0.95)';
  });
  
  bottle.addEventListener('dragend', (e) => {
    bottle.style.opacity = '1';
    bottle.style.transform = 'scale(1)';
  });
  
  // Touch support
  bottle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    bottle.dataset.dragging = touch.clientX + ',' + touch.clientY;
    bottle.style.opacity = '0.7';
  });
  
  bottle.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    bottle.style.transform = `translate(${touch.clientX - parseFloat(bottle.dataset.startX)}px, ${touch.clientY - parseFloat(bottle.dataset.startY)}px)`;
  });
  
  bottle.addEventListener('touchend', (e) => {
    bottle.style.opacity = '1';
    bottle.style.transform = '';
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.closest('#beaker-zone')) {
      addChemical(bottle.dataset.chemical);
    }
  });
});

const beakerZone = document.getElementById('beaker-zone');
beakerZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  beakerZone.style.borderColor = '#60A5FA';
  beakerZone.style.background = 'rgba(96,165,250,0.1)';
});

beakerZone.addEventListener('dragleave', () => {
  beakerZone.style.borderColor = '';
  beakerZone.style.background = '';
});

beakerZone.addEventListener('drop', (e) => {
  e.preventDefault();
  beakerZone.style.borderColor = '';
  beakerZone.style.background = '';
  const chemicalId = e.dataTransfer.getData('chemical');
  if (chemicalId) addChemical(chemicalId);
});

function addChemical(id) {
  if (mixedChemicals.includes(id)) return;
  mixedChemicals.push(id);
  
  // Update liquid
  liquidLevel = Math.min(mixedChemicals.length * 0.25, 0.8);
  const chem = chemicals[id];
  
  // Blend colors
  liquidColor = blendColors(mixedChemicals.map(c => chemicals[c].color));
  
  // Animate liquid fill
  updateBeaker(liquidLevel, liquidColor);
  
  // Update mixed list
  document.getElementById('mixed-names').textContent = 
    mixedChemicals.map(c => chemicals[c].name).join(' + ');
  
  // Check for reaction
  checkReaction();
}

function blendColors(colorIds) {
  // Simple average of RGB values
  let r = 0, g = 0, b = 0;
  colorIds.forEach(hex => {
    const c = hexToRgb(hex);
    r += c.r; g += c.g; b += c.b;
  });
  const n = colorIds.length;
  return `rgba(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)},0.6)`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function updateBeaker(level, color) {
  const fill = document.getElementById('liquid-fill');
  const maxHeight = 180;
  const height = level * maxHeight;
  const y = 200 - height;
  
  fill.setAttribute('y', y);
  fill.setAttribute('height', height);
  fill.setAttribute('fill', color);
}

function checkReaction() {
  // Sort chemicals alphabetically to match reaction keys
  const sorted = [...mixedChemicals].sort();
  
  // Check all possible pairs
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const key = sorted[i] + '+' + sorted[j];
      if (reactions[key]) {
        showReaction(reactions[key]);
        return;
      }
    }
  }
  
  // No reaction found
  hideReaction();
}

function showReaction(rxn) {
  const result = document.getElementById('reaction-result');
  result.style.display = 'block';
  document.getElementById('reaction-title').textContent = rxn.title;
  document.getElementById('reaction-description').textContent = rxn.description;
  document.getElementById('reaction-equation').textContent = rxn.equation;
  
  // Trigger visualization
  if (rxn.visualization === 'bubbles') startBubbles();
  if (rxn.visualization === 'color-change') animateColorChange(rxn.color);
}

function hideReaction() {
  document.getElementById('reaction-result').style.display = 'none';
  stopBubbles();
}

// Bubble animation
let bubbleInterval = null;
function startBubbles() {
  const container = document.getElementById('bubble-container');
  stopBubbles();
  bubbleInterval = setInterval(() => {
    const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const x = 60 + Math.random() * 80;
    const startY = 180;
    const r = 3 + Math.random() * 5;
    bubble.setAttribute('cx', x);
    bubble.setAttribute('cy', startY);
    bubble.setAttribute('r', r);
    bubble.setAttribute('fill', 'rgba(255,255,255,0.6)');
    container.appendChild(bubble);
    
    // Animate upward
    let y = startY;
    const anim = setInterval(() => {
      y -= 2;
      bubble.setAttribute('cy', y);
      if (y < 30) {
        clearInterval(anim);
        bubble.remove();
      }
    }, 30);
  }, 200);
}

function stopBubbles() {
  if (bubbleInterval) clearInterval(bubbleInterval);
}

function animateColorChange(targetColor) {
  const fill = document.getElementById('liquid-fill');
  fill.style.transition = 'fill 1s ease';
  fill.setAttribute('fill', targetColor);
}
```

## Key Design Rules
1. Chemicals are draggable from a shelf to a beaker
2. Each chemical adds to the mixture (no duplicates)
3. Liquid level rises with each chemical added
4. Liquid color blends from all chemicals
5. Reactions trigger automatically when matching pairs are combined
6. Bubbles animate for gas-producing reactions
7. Color transitions animate for dissolution reactions
8. Touch support for mobile devices
9. Undo button to remove last chemical
10. Clear button to empty the beaker
