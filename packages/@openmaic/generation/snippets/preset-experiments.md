# Preset Experiments Pattern

Every simulation should include preset buttons that configure the experiment to a specific scenario. This reduces cognitive load and gives students quick starting points.

## Layout

```
┌─────────────────────────────────────────────┐
│  PRESETS: [Strong Acid] [Weak Acid] [Base]  │
│           [Neutral] [Custom]                 │
├─────────────────────────────────────────────┤
│                                              │
│   MAIN VISUALIZATION                         │
│   (configured to selected preset)            │
│                                              │
└─────────────────────────────────────────────┘
```

## HTML Structure

```html
<div id="preset-bar" style="display:flex; gap:8px; padding:12px 16px; background:rgba(15,23,42,0.9); 
     border-radius:10px; flex-wrap:wrap; align-items:center;">
  <span style="color:#94A3B8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-right:8px;">
    Presets:
  </span>
  <button class="preset-btn active" data-preset="strong-acid" 
    style="padding:6px 14px; border:1px solid rgba(96,165,250,0.3); background:rgba(96,165,250,0.15); 
           color:#60A5FA; border-radius:6px; font-size:12px; cursor:pointer; transition:all 0.2s;">
    Strong Acid
  </button>
  <button class="preset-btn" data-preset="weak-acid"
    style="padding:6px 14px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); 
           color:#94A3B8; border-radius:6px; font-size:12px; cursor:pointer; transition:all 0.2s;">
    Weak Acid
  </button>
  <button class="preset-btn" data-preset="base"
    style="padding:6px 14px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); 
           color:#94A3B8; border-radius:6px; font-size:12px; cursor:pointer; transition:all 0.2s;">
    Base
  </button>
  <button class="preset-btn" data-preset="neutral"
    style="padding:6px 14px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); 
           color:#94A3B8; border-radius:6px; font-size:12px; cursor:pointer; transition:all 0.2s;">
    Neutral
  </button>
</div>
```

## JavaScript Implementation

```javascript
// Preset definitions
const presets = {
  'strong-acid': {
    name: 'Strong Acid (HCl)',
    chemicals: ['hydrochloric-acid'],
    volume: 50,
    pH: 1.0,
    temperature: 22,
    color: 'rgba(255,200,100,0.5)',
    description: '0.1M Hydrochloric acid — fully dissociated, pH = 1',
    icon: '🧪'
  },
  'weak-acid': {
    name: 'Weak Acid (CH₃COOH)',
    chemicals: ['acetic-acid'],
    volume: 50,
    pH: 3.0,
    temperature: 22,
    color: 'rgba(255,240,180,0.5)',
    description: '0.1M Acetic acid — partially dissociated, pH = 3',
    icon: '🍋'
  },
  'base': {
    name: 'Strong Base (NaOH)',
    chemicals: ['sodium-hydroxide'],
    volume: 50,
    pH: 13.0,
    temperature: 22,
    color: 'rgba(200,200,255,0.5)',
    description: '0.1M Sodium hydroxide — fully dissociated, pH = 13',
    icon: '⚗️'
  },
  'neutral': {
    name: 'Neutral (Water)',
    chemicals: ['water'],
    volume: 50,
    pH: 7.0,
    temperature: 22,
    color: 'rgba(100,200,255,0.3)',
    description: 'Pure water — neutral, pH = 7',
    icon: '💧'
  },
  'titration-start': {
    name: 'Titration: Start',
    chemicals: ['hcl', 'phenolphthalein'],
    volume: 25,
    pH: 1.0,
    temperature: 22,
    color: 'rgba(255,200,100,0.3)',
    description: '25ml of 0.1M HCl with phenolphthalein — colourless',
    icon: '🔬'
  },
  'titration-endpoint': {
    name: 'Titration: Endpoint',
    chemicals: ['hcl', 'naoh', 'phenolphthalein'],
    volume: 50,
    pH: 7.0,
    temperature: 25,
    color: 'rgba(255,180,200,0.5)',
    description: '25ml HCl + 25ml NaOH — pale pink endpoint reached',
    icon: '🎯'
  },
  'flame-test-sodium': {
    name: 'Flame Test: Sodium',
    chemicals: ['sodium-chloride'],
    flameColor: '#FFD700',
    description: 'Sodium chloride on platinum wire — intense yellow flame',
    icon: '🔥'
  },
  'flame-test-copper': {
    name: 'Flame Test: Copper',
    chemicals: ['copper-sulphate'],
    flameColor: '#00FF7F',
    description: 'Copper(II) sulphate on platinum wire — green/blue flame',
    icon: '🔥'
  }
};

// State
let currentPreset = null;

// Apply preset
function applyPreset(presetId) {
  const preset = presets[presetId];
  if (!preset) return;
  
  currentPreset = presetId;
  
  // Update visual state
  document.querySelectorAll('.preset-btn').forEach(btn => {
    if (btn.dataset.preset === presetId) {
      btn.classList.add('active');
      btn.style.borderColor = 'rgba(96,165,250,0.3)';
      btn.style.background = 'rgba(96,165,250,0.15)';
      btn.style.color = '#60A5FA';
    } else {
      btn.classList.remove('active');
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.color = '#94A3B8';
    }
  });
  
  // Smooth transition to preset values
  animateToPreset(preset);
  
  // Show description
  showPresetDescription(preset);
}

function animateToPreset(preset) {
  // Animate pH slider
  const phSlider = document.getElementById('ph-slider');
  if (phSlider) {
    animateSlider(phSlider, parseFloat(phSlider.value), preset.pH, 500);
  }
  
  // Animate volume
  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    animateSlider(volumeSlider, parseFloat(volumeSlider.value), preset.volume, 500);
  }
  
  // Animate temperature
  const tempDisplay = document.getElementById('temp-display');
  if (tempDisplay) {
    animateValue(tempDisplay, parseFloat(tempDisplay.textContent), preset.temperature, 500);
  }
  
  // Update liquid color
  const liquid = document.getElementById('liquid-fill');
  if (liquid) {
    liquid.style.transition = 'fill 0.5s ease';
    liquid.setAttribute('fill', preset.color);
  }
}

function animateSlider(slider, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    slider.value = from + (to - from) * eased;
    slider.dispatchEvent(new Event('input'));
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function animateValue(element, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = (from + (to - from) * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function showPresetDescription(preset) {
  const desc = document.getElementById('preset-description');
  if (desc) {
    desc.textContent = preset.description;
    desc.style.opacity = '0';
    setTimeout(() => desc.style.opacity = '1', 50);
  }
}

// Event listeners
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

// Keyboard shortcuts for presets (1-5 keys)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const presetKeys = Object.keys(presets);
  const index = parseInt(e.key) - 1;
  if (index >= 0 && index < presetKeys.length) {
    applyPreset(presetKeys[index]);
  }
});
```

## Preset Categories by Subject

### Chemistry
| Preset | Description |
|---|---|
| Strong Acid | HCl, pH 1 |
| Weak Acid | CH₃COOH, pH 3 |
| Strong Base | NaOH, pH 13 |
| Neutral | Water, pH 7 |
| Titration Start | HCl + indicator |
| Titration Endpoint | Pink colour |
| Flame Test Na | Yellow flame |
| Flame Test Cu | Green flame |

### Physics
| Preset | Description |
|---|---|
| Earth Gravity | 9.81 m/s² |
| Moon Gravity | 1.62 m/s² |
| Mars Gravity | 3.72 m/s² |
| Zero Gravity | 0 m/s² |
| Ohm's Law R=10Ω | V=12V, I=1.2A |
| Ohm's Law R=100Ω | V=12V, I=0.12A |
| Simple Pendulum L=1m | T=2s |
| Spring k=100N/m | F=100x |

### Math
| Preset | Description |
|---|---|
| y = x | Linear, slope 1 |
| y = x² | Quadratic |
| y = sin(x) | Sine wave |
| y = 1/x | Hyperbola |
| Triangle | 3-4-5 right triangle |
| Circle r=1 | Unit circle |

## Key Design Rules
1. Presets are always visible (not hidden in a menu)
2. Active preset is highlighted (blue border/background)
3. Applying a preset animates smoothly (no jumps)
4. Each preset shows a brief description
5. Keyboard shortcuts (1-5) for quick access
6. Presets configure ALL relevant variables at once
7. "Custom" option returns to manual control
8. Presets are context-sensitive (chemistry presets for chemistry sims, physics for physics)
