# Complete 3D Simulation Template (Three.js)

CRITICAL: For chemistry and physics practical simulations, generate a 3D Canvas using Three.js. Students should see the experiment in 3D — they can orbit around the beaker, see the liquid surface from above, watch bubbles rise in 3D space, and drag chemicals in a 3D environment.

## Why 3D Matters for Practicals

- **Chemistry**: Students see the beaker from all angles, watch precipitate settle to the bottom, see liquid pour in 3D
- **Physics**: Light rays through 3D glass blocks, pendulum swinging in 3D space, circuit components with realistic depth
- **Engagement**: 3D is more immersive and memorable than flat 2D drawings

## Complete 3D Chemistry Lab Template

Copy this ENTIRE template and adapt it for the specific experiment:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{experimentTitle}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: #0a0a1a; }
    
    #app { display: flex; width: 100%; height: 100%; }
    
    #canvas-container { flex: 1; position: relative; min-width: 0; }
    #canvas-container canvas { width: 100% !important; height: 100% !important; display: block; }
    
    #controls-panel {
      width: 320px; flex-shrink: 0; overflow-y: auto;
      background: rgba(15,23,42,0.95); border-left: 1px solid rgba(255,255,255,0.1);
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    
    .control-group {
      background: rgba(30,41,59,0.8); border-radius: 10px; padding: 12px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .control-group h3 { color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    
    .slider-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    .slider-row label { color: #CBD5E1; font-size: 12px; min-width: 80px; }
    .slider-row input[type="range"] { flex: 1; accent-color: #60A5FA; }
    .slider-row .value { color: #60A5FA; font-family: monospace; font-size: 13px; font-weight: 600; min-width: 60px; text-align: right; }
    
    .chemical-shelf { display: flex; flex-wrap: wrap; gap: 6px; }
    .chemical-bottle {
      padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600;
      cursor: grab; user-select: none; transition: transform 0.15s, box-shadow 0.15s;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .chemical-bottle:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .chemical-bottle:active { cursor: grabbing; transform: scale(0.95); }
    
    .preset-btn {
      padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
      background: rgba(96,165,250,0.15); color: #60A5FA; border: 1px solid rgba(96,165,250,0.3);
      cursor: pointer; transition: all 0.2s;
    }
    .preset-btn:hover { background: rgba(96,165,250,0.3); }
    .preset-btn.active { background: rgba(96,165,250,0.4); border-color: #60A5FA; }
    
    #live-data {
      position: absolute; top: 12px; right: 12px; z-index: 100;
      background: rgba(15,23,42,0.9); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      padding: 12px 16px; min-width: 180px;
      font-family: 'JetBrains Mono', monospace; font-size: 13px;
    }
    #live-data .title { color: #94A3B8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
    #live-data .row { display: flex; justify-content: space-between; margin: 4px 0; }
    #live-data .label { color: #94A3B8; }
    #live-data .val { font-weight: 600; }
    
    #observation-panel {
      position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 100;
      background: rgba(15,23,42,0.9); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      padding: 12px 16px; font-size: 13px; color: #E2E8F0;
      border-left: 3px solid #60A5FA;
      display: none; /* shown when reaction happens */
    }
    
    #equation-bar {
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 100;
      background: rgba(15,23,42,0.9); backdrop-filter: blur(12px);
      border: 1px solid rgba(96,165,250,0.3); border-radius: 10px;
      padding: 10px 20px; font-family: monospace; font-size: 14px; color: #60A5FA;
      display: none; /* shown with chemical equation */
    }
    
    @media (max-width: 768px) {
      #app { flex-direction: column; }
      #controls-panel { width: 100%; max-height: 40vh; border-left: none; border-top: 1px solid rgba(255,255,255,0.1); }
    }
  </style>
</head>
<body>
  <div id="app">
    <div id="canvas-container"></div>
    <div id="controls-panel">
      
      <!-- Live Data Panel -->
      <div id="live-data">
        <div class="title">⚡ Live Measurements</div>
        <div class="row"><span class="label">pH:</span><span class="val" id="live-ph" style="color:#34D399;">7.0</span></div>
        <div class="row"><span class="label">Temperature:</span><span class="val" id="live-temp" style="color:#F59E0B;">25.0 °C</span></div>
        <div class="row"><span class="label">Concentration:</span><span class="val" id="live-conc" style="color:#60A5FA;">0.50 mol/L</span></div>
      </div>
      
      <!-- Chemical Shelf (drag to beaker) -->
      <div class="control-group">
        <h3>🧪 Chemical Shelf (drag to beaker)</h3>
        <div class="chemical-shelf">
          <div class="chemical-bottle" draggable="true" data-chemical="hcl" style="background:rgba(255,224,102,0.2); color:#FFE066;">HCl</div>
          <div class="chemical-bottle" draggable="true" data-chemical="naoh" style="background:rgba(144,238,144,0.2); color:#90EE90;">NaOH</div>
          <div class="chemical-bottle" draggable="true" data-chemical="zn" style="background:rgba(192,192,192,0.2); color:#C0C0C0;">Zn</div>
          <div class="chemical-bottle" draggable="true" data-chemical="cuso4" style="background:rgba(65,105,225,0.2); color:#4169E1;">CuSO₄</div>
        </div>
      </div>
      
      <!-- Variable Controls -->
      <div class="control-group">
        <h3>🎛️ Experiment Controls</h3>
        <div class="slider-row">
          <label>Concentration</label>
          <input type="range" id="slider-conc" min="0.01" max="2.0" step="0.01" value="0.5">
          <span class="value" id="val-conc">0.50 M</span>
        </div>
        <div class="slider-row">
          <label>Temperature</label>
          <input type="range" id="slider-temp" min="0" max="100" step="0.5" value="25">
          <span class="value" id="val-temp">25.0 °C</span>
        </div>
        <div class="slider-row">
          <label>Volume</label>
          <input type="range" id="slider-vol" min="10" max="500" step="5" value="100">
          <span class="value" id="val-vol">100 mL</span>
        </div>
      </div>
      
      <!-- Presets -->
      <div class="control-group">
        <h3>⚡ Quick Presets</h3>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <button class="preset-btn" data-preset="strong-acid">Strong Acid</button>
          <button class="preset-btn" data-preset="weak-acid">Weak Acid</button>
          <button class="preset-btn" data-preset="neutral">Neutral</button>
          <button class="preset-btn" data-preset="strong-base">Strong Base</button>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="control-group">
        <div style="display:flex; gap:8px;">
          <button id="btn-reset" class="preset-btn" style="flex:1;">⟲ Reset</button>
          <button id="btn-clear" class="preset-btn" style="flex:1;">🗑️ Clear Beaker</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Three.js from CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <!-- OrbitControls for mouse rotation -->
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  
  <script>
    // ============================================================
    // STATE — ALL simulation data in one reactive object
    // ============================================================
    const state = {
      concentration: 0.5,
      temperature: 25,
      volume: 100,
      pH: 7.0,
      chemicalsInBeaker: [],
      solutionColor: '#00CC00',
      solutionLevel: 0.3,
      bubbles: [],
      precipitate: [],
      phase: 'idle', // idle | mixing | reacting | complete
    };
    
    // ============================================================
    // SCIENTIFIC CALCULATIONS (the actual chemistry)
    // ============================================================
    function recalculate() {
      // pH from concentration (simplified strong acid model)
      if (state.chemicalsInBeaker.includes('hcl')) {
        state.pH = -Math.log10(state.concentration);
        state.solutionColor = pHToColor(state.pH);
      } else if (state.chemicalsInBeaker.includes('naoh')) {
        state.pH = 14 + Math.log10(state.concentration);
        state.solutionColor = pHToColor(state.pH);
      } else {
        state.pH = 7.0;
        state.solutionColor = '#00CC00';
      }
    }
    
    function pHToColor(pH) {
      if (pH < 1) return '#FF0000';
      if (pH < 3) return '#FF4444';
      if (pH < 5) return '#FFAA00';
      if (pH < 6) return '#FFDD00';
      if (pH < 7) return '#BBFF00';
      if (pH === 7) return '#00CC00';
      if (pH < 8) return '#00BB44';
      if (pH < 10) return '#0088FF';
      if (pH < 12) return '#4400CC';
      return '#8800FF';
    }
    
    // ============================================================
    // THREE.JS SCENE SETUP
    // ============================================================
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 3, 5);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    
    // Orbit controls (student can rotate/zoom the 3D view)
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();
    
    // ============================================================
    // LIGHTING (realistic lab environment)
    // ============================================================
    const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-3, 4, -2);
    scene.add(fillLight);
    
    const rimLight = new THREE.PointLight(0xff8844, 0.4, 10);
    rimLight.position.set(-2, 3, -3);
    scene.add(rimLight);
    
    // ============================================================
    // LAB BENCH (wooden table)
    // ============================================================
    const benchGeom = new THREE.BoxGeometry(6, 0.15, 4);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.8 });
    const bench = new THREE.Mesh(benchGeom, benchMat);
    bench.position.y = -0.075;
    bench.receiveShadow = true;
    scene.add(bench);
    
    // ============================================================
    // 3D BEAKER (glass cylinder with liquid)
    // ============================================================
    const beakerGroup = new THREE.Group();
    beakerGroup.position.set(0, 0.075, 0);
    scene.add(beakerGroup);
    
    // Glass body (transparent cylinder, open top)
    const glassGeom = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 32, 1, true);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transmission: 0.9,
      thickness: 0.1,
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.y = 0.75;
    glass.castShadow = true;
    beakerGroup.add(glass);
    
    // Glass bottom (opaque disc)
    const bottomGeom = new THREE.CircleGeometry(0.6, 32);
    const bottomMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.1,
    });
    const bottom = new THREE.Mesh(bottomGeom, bottomMat);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.01;
    beakerGroup.add(bottom);
    
    // Liquid (dynamic — updates with state)
    const liquidGeom = new THREE.CylinderGeometry(0.58, 0.58, 0.01, 32);
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(state.solutionColor),
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.1,
    });
    const liquid = new THREE.Mesh(liquidGeom, liquidMat);
    liquid.position.y = 0.01 + 1.5 * state.solutionLevel;
    beakerGroup.add(liquid);
    
    // Graduation marks (white lines on glass)
    for (let i = 1; i <= 5; i++) {
      const markGeom = new THREE.BoxGeometry(0.08, 0.005, 0.005);
      const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      const mark = new THREE.Mesh(markGeom, markMat);
      mark.position.set(-0.6, i * 0.25, 0);
      beakerGroup.add(mark);
    }
    
    // ============================================================
    // BUBBLE SYSTEM (gas evolution)
    // ============================================================
    const bubbleGroup = new THREE.Group();
    beakerGroup.add(bubbleGroup);
    
    function createBubble3D() {
      const r = 0.02 + Math.random() * 0.03;
      const geom = new THREE.SphereGeometry(r, 8, 8);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.3,
      });
      const bubble = new THREE.Mesh(geom, mat);
      bubble.position.set(
        (Math.random() - 0.5) * 0.4,
        0.1 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4
      );
      bubble.userData = {
        speed: 0.005 + Math.random() * 0.01,
        wobbleSpeed: 2 + Math.random() * 3,
        wobbleAmount: 0.02 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      };
      bubbleGroup.add(bubble);
      return bubble;
    }
    
    function updateBubbles3D(time) {
      bubbleGroup.children.forEach(b => {
        const d = b.userData;
        b.position.y += d.speed;
        b.position.x += Math.sin(time * d.wobbleSpeed + d.phase) * d.wobbleAmount * 0.02;
        b.position.z += Math.cos(time * d.wobbleSpeed + d.phase) * d.wobbleAmount * 0.02;
        
        // Remove when above liquid surface
        if (b.position.y > 1.5 * state.solutionLevel + 0.1) {
          bubbleGroup.remove(b);
          b.geometry.dispose();
          b.material.dispose();
        }
      });
    }
    
    // ============================================================
    // REACTION ANIMATION
    // ============================================================
    function triggerReaction(chemical) {
      state.chemicalsInBeaker.push(chemical);
      state.phase = 'reacting';
      
      // Determine reaction
      const hasHCl = state.chemicalsInBeaker.includes('hcl');
      const hasZn = state.chemicalsInBeaker.includes('zn');
      const hasNaOH = state.chemicalsInBeaker.includes('naoh');
      const hasCuSO4 = state.chemicalsInBeaker.includes('cuso4');
      
      let reaction = null;
      if (hasHCl && hasZn) {
        reaction = {
          equation: 'Zn(s) + 2HCl(aq) → ZnCl₂(aq) + H₂(g)',
          gas: true,
          colorChange: { from: '#FFE066', to: '#E8E8E8' },
          tempChange: +8,
          observation: 'Bubbles of colourless gas (H₂) produced. Zinc granules dissolve. Solution becomes warm.',
        };
      } else if (hasHCl && hasNaOH) {
        reaction = {
          equation: 'HCl + NaOH → NaCl + H₂O',
          gas: false,
          colorChange: { from: '#FFE066', to: '#FFFFFF' },
          tempChange: +15,
          observation: 'Neutralization reaction. Solution becomes warm. No visible change (both clear → clear).',
        };
      } else if (hasCuSO4 && hasZn) {
        reaction = {
          equation: 'CuSO₄(aq) + Zn(s) → ZnSO₄(aq) + Cu(s)',
          gas: false,
          colorChange: { from: '#4169E1', to: '#E8E8E8' },
          precipitate: { color: '#B87333' },
          tempChange: +5,
          observation: 'Blue solution fades. Red-brown copper metal deposits on zinc.',
        };
      }
      
      if (reaction) {
        // Show equation
        const eqBar = document.getElementById('equation-bar');
        eqBar.textContent = reaction.equation;
        eqBar.style.display = 'block';
        
        // Show observation
        const obsPanel = document.getElementById('observation-panel');
        obsPanel.innerHTML = `<strong>Observation:</strong> ${reaction.observation}`;
        obsPanel.style.display = 'block';
        
        // Update temperature
        state.temperature += reaction.tempChange;
        
        // Animate color change
        animateColorChange(reaction.colorChange.from, reaction.colorChange.to, 2000);
        
        // Create bubbles if gas producing
        if (reaction.gas) {
          state.bubbleInterval = setInterval(() => {
            for (let i = 0; i < 3; i++) createBubble3D();
          }, 100);
          setTimeout(() => clearInterval(state.bubbleInterval), 3000);
        }
        
        // Update liquid level
        state.solutionLevel = Math.min(state.solutionLevel + 0.1, 0.8);
      }
      
      recalculate();
      updateLiveDataPanel();
    }
    
    function animateColorChange(from, to, duration) {
      const start = new THREE.Color(from);
      const end = new THREE.Color(to);
      const startTime = Date.now();
      
      function animate() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        liquidMat.color.lerpColors(start, end, ease);
        requestAnimationFrame(animate);
      }
      animate();
    }
    
    // ============================================================
    // UI EVENT HANDLERS (reactive — changes update 3D immediately)
    // ============================================================
    
    // Sliders
    document.getElementById('slider-conc').addEventListener('input', function() {
      state.concentration = parseFloat(this.value);
      document.getElementById('val-conc').textContent = state.concentration.toFixed(2) + ' M';
      recalculate();
      updateLiveDataPanel();
    });
    
    document.getElementById('slider-temp').addEventListener('input', function() {
      state.temperature = parseFloat(this.value);
      document.getElementById('val-temp').textContent = state.temperature.toFixed(1) + ' °C';
      updateLiveDataPanel();
    });
    
    document.getElementById('slider-vol').addEventListener('input', function() {
      state.volume = parseFloat(this.value);
      document.getElementById('val-vol').textContent = state.volume + ' mL';
      state.solutionLevel = state.volume / 500 * 0.8;
      liquid.position.y = 0.01 + 1.5 * state.solutionLevel;
      updateLiveDataPanel();
    });
    
    // Presets
    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presets = {
          'strong-acid': { conc: 1.0, temp: 25, vol: 100, chemical: 'hcl' },
          'weak-acid': { conc: 0.01, temp: 25, vol: 100, chemical: 'hcl' },
          'neutral': { conc: 0.0000001, temp: 25, vol: 100, chemical: null },
          'strong-base': { conc: 1.0, temp: 25, vol: 100, chemical: 'naoh' },
        };
        const p = presets[btn.dataset.preset];
        if (!p) return;
        
        state.concentration = p.conc;
        state.temperature = p.temp;
        state.volume = p.vol;
        state.chemicalsInBeaker = p.chemical ? [p.chemical] : [];
        
        document.getElementById('slider-conc').value = p.conc;
        document.getElementById('val-conc').textContent = p.conc.toFixed(2) + ' M';
        document.getElementById('slider-temp').value = p.temp;
        document.getElementById('val-temp').textContent = p.temp + ' °C';
        document.getElementById('slider-vol').value = p.vol;
        document.getElementById('val-vol').textContent = p.vol + ' mL';
        
        state.solutionLevel = p.vol / 500 * 0.8;
        liquid.position.y = 0.01 + 1.5 * state.solutionLevel;
        
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        recalculate();
        updateLiveDataPanel();
      });
    });
    
    // Chemical drag-and-drop
    document.querySelectorAll('.chemical-bottle').forEach(bottle => {
      bottle.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', bottle.dataset.chemical);
      });
    });
    
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const chemical = e.dataTransfer.getData('text/plain');
      if (chemical) triggerReaction(chemical);
    });
    
    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
      state.concentration = 0.5;
      state.temperature = 25;
      state.volume = 100;
      state.chemicalsInBeaker = [];
      state.solutionLevel = 0.3;
      state.phase = 'idle';
      liquidMat.color.set('#00CC00');
      liquid.position.y = 0.01 + 1.5 * state.solutionLevel;
      document.getElementById('slider-conc').value = 0.5;
      document.getElementById('val-conc').textContent = '0.50 M';
      document.getElementById('slider-temp').value = 25;
      document.getElementById('val-temp').textContent = '25.0 °C';
      document.getElementById('slider-vol').value = 100;
      document.getElementById('val-vol').textContent = '100 mL';
      document.getElementById('equation-bar').style.display = 'none';
      document.getElementById('observation-panel').style.display = 'none';
      // Clear bubbles
      while (bubbleGroup.children.length > 0) {
        const b = bubbleGroup.children[0];
        bubbleGroup.remove(b);
        b.geometry.dispose();
        b.material.dispose();
      }
      recalculate();
      updateLiveDataPanel();
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => {
      state.chemicalsInBeaker = [];
      state.phase = 'idle';
      liquidMat.color.set('#00CC00');
      document.getElementById('equation-bar').style.display = 'none';
      document.getElementById('observation-panel').style.display = 'none';
      while (bubbleGroup.children.length > 0) {
        const b = bubbleGroup.children[0];
        bubbleGroup.remove(b);
        b.geometry.dispose();
        b.material.dispose();
      }
      recalculate();
      updateLiveDataPanel();
    });
    
    // ============================================================
    // LIVE DATA PANEL UPDATE
    // ============================================================
    function updateLiveDataPanel() {
      document.getElementById('live-ph').textContent = state.pH.toFixed(1);
      document.getElementById('live-temp').textContent = state.temperature.toFixed(1) + ' °C';
      document.getElementById('live-conc').textContent = state.concentration.toFixed(2) + ' mol/L';
      
      const phEl = document.getElementById('live-ph');
      phEl.style.color = state.pH < 7 ? '#EF4444' : state.pH > 7 ? '#8B5CF6' : '#34D399';
    }
    
    // ============================================================
    // ANIMATION LOOP
    // ============================================================
    const clock = new THREE.Clock();
    
    function animate() {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      
      controls.update();
      
      // Update bubbles
      updateBubbles3D(time);
      
      // Liquid surface wobble (subtle)
      if (state.solutionLevel > 0) {
        liquid.position.y = 0.01 + 1.5 * state.solutionLevel + Math.sin(time * 2) * 0.003;
      }
      
      renderer.render(scene, camera);
    }
    
    animate();
    
    // ============================================================
    // RESPONSIVE RESIZE
    // ============================================================
    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    
    // ============================================================
    // POST MESSAGE LISTENER (widget actions)
    // ============================================================
    window.addEventListener('message', (event) => {
      const { type, state: msgState } = event.data;
      if (type === 'SET_WIDGET_STATE' && msgState) {
        Object.entries(msgState).forEach(([key, value]) => {
          if (key === 'concentration') {
            state.concentration = value;
            document.getElementById('slider-conc').value = value;
            document.getElementById('val-conc').textContent = value.toFixed(2) + ' M';
          }
          // ... handle other variables
        });
        recalculate();
        updateLiveDataPanel();
      }
    });
  </script>
</body>
</html>
```

## 3D Physics Experiment Template

For physics experiments, replace the beaker with the appropriate apparatus:

```javascript
// ============================================================
// 3D OPTICAL BENCH (for refraction, lens experiments)
// ============================================================
function createOpticalBench() {
  const group = new THREE.Group();
  
  // Bench surface
  const benchGeom = new THREE.BoxGeometry(8, 0.05, 0.6);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const bench = new THREE.Mesh(benchGeom, benchMat);
  bench.position.y = 0;
  group.add(bench);
  
  // Ruler markings
  for (let i = -3; i <= 3; i += 0.5) {
    const markGeom = new THREE.BoxGeometry(0.01, 0.001, 0.02);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mark = new THREE.Mesh(markGeom, markMat);
    mark.position.set(i, 0.026, 0.3);
    group.add(mark);
  }
  
  // Convex lens
  const lensGeom = new THREE.TorusGeometry(0.4, 0.02, 16, 32);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    transmission: 0.8,
  });
  const lens = new THREE.Mesh(lensGeom, lensMat);
  lens.position.set(0, 0.4, 0);
  lens.rotation.y = Math.PI / 2;
  group.add(lens);
  
  // Light source (laser)
  const sourceGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
  const sourceMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const source = new THREE.Mesh(sourceGeom, sourceMat);
  source.position.set(-3, 0.2, 0);
  source.rotation.z = Math.PI / 2;
  group.add(source);
  
  // Light beam (ray)
  const rayGeom = new THREE.CylinderGeometry(0.005, 0.005, 6, 8);
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
  const ray = new THREE.Mesh(rayGeom, rayMat);
  ray.position.set(0, 0.4, 0);
  ray.rotation.z = Math.PI / 2;
  group.add(ray);
  
  // Screen
  const screenGeom = new THREE.BoxGeometry(0.02, 1, 0.8);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const screen = new THREE.Mesh(screenGeom, screenMat);
  screen.position.set(3, 0.5, 0);
  group.add(screen);
  
  return { group, lens, ray, screen, source };
}

// ============================================================
// 3D PENDULUM
// ============================================================
function createPendulum3D() {
  const group = new THREE.Group();
  
  // Stand
  const standGeom = new THREE.BoxGeometry(0.05, 2, 0.05);
  const standMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
  const stand = new THREE.Mesh(standGeom, standMat);
  stand.position.y = 1;
  group.add(stand);
  
  // Crossbar
  const barGeom = new THREE.BoxGeometry(1, 0.03, 0.03);
  const bar = new THREE.Mesh(barGeom, standMat);
  bar.position.y = 2;
  group.add(bar);
  
  // Pivot
  const pivotGeom = new THREE.SphereGeometry(0.03, 16, 16);
  const pivotMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
  const pivot = new THREE.Mesh(pivotGeom, pivotMat);
  pivot.position.y = 2;
  group.add(pivot);
  
  // String (thin cylinder)
  const stringGeom = new THREE.CylinderGeometry(0.005, 0.005, 1.5, 8);
  const stringMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  const string = new THREE.Mesh(stringGeom, stringMat);
  string.position.y = 1.25;
  group.add(string);
  
  // Bob (sphere)
  const bobGeom = new THREE.SphereGeometry(0.1, 32, 32);
  const bobMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.3, roughness: 0.4 });
  const bob = new THREE.Mesh(bobGeom, bobMat);
  bob.position.y = 0.5;
  bob.castShadow = true;
  group.add(bob);
  
  return { group, string, bob, pivot };
}

// Pendulum physics
function updatePendulum3D(pendulum, angle, length) {
  const bobX = length * Math.sin(angle);
  const bobY = 2 - length * Math.cos(angle);
  
  pendulum.bob.position.x = bobX;
  pendulum.bob.position.y = bobY;
  
  // Update string to connect pivot to bob
  const midX = bobX / 2;
  const midY = (2 + bobY) / 2;
  pendulum.string.position.x = midX;
  pendulum.string.position.y = midY;
  pendulum.string.rotation.z = -angle;
  pendulum.string.scale.y = length / 1.5;
}
```

## Key Rules for 3D Simulations

1. **Use Three.js from CDN** — `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
2. **Always include OrbitControls** — students can rotate, zoom, pan the 3D view
3. **Glass materials use MeshPhysicalMaterial** — `transmission: 0.9` for realistic glass
4. **Liquids use MeshPhysicalMaterial** — `transparent: true, opacity: 0.7` with dynamic color
5. **Bubbles are small spheres** — created dynamically, move upward, removed at surface
6. **Shadows enabled** — `renderer.shadowMap.enabled = true` for depth
7. **All slider changes update 3D immediately** — no re-render delay
8. **Drag-and-drop works on the 3D canvas** — drop chemical on canvas → triggers reaction in 3D
9. **Preset buttons instantly reconfigure** — all 3D objects update position/color/material
10. **Responsive** — `window.resize` handler updates camera aspect and renderer size
