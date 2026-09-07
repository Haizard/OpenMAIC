# Experiment-Specific Visualization Patterns

CRITICAL: Every simulation MUST have a visible, animated canvas visualization. The controls, panels, and buttons are SUPPORT — the canvas visualization is the MAIN EVENT. If you generate controls without a canvas, the simulation is broken.

## Rule #1: Canvas First, Controls Second

ALWAYS draw the experiment visualization FIRST, then add controls around it. Never generate a control panel without a matching canvas.

```javascript
// WRONG: Controls without visualization
<div id="controls">...</div>
<div id="data-panel">...</div>
// No canvas! Student sees nothing!

// CORRECT: Canvas WITH controls
<canvas id="canvas" width="800" height="500"></canvas>
<div id="controls">...</div>
// Student sees the experiment AND controls it
```

## Physics Experiment Visualizations

### 1. Refraction Through Glass Block

```javascript
function drawRefraction(ctx, w, h, angleOfIncidence) {
  ctx.clearRect(0, 0, w, h);
  
  // Background (air)
  ctx.fillStyle = '#e8f4f8';
  ctx.fillRect(0, 0, w, h);
  
  // Glass block (center)
  const blockW = 200, blockH = 300;
  const blockX = (w - blockW) / 2;
  const blockY = (h - blockH) / 2;
  
  // Glass with transparency
  ctx.fillStyle = 'rgba(200, 230, 255, 0.4)';
  ctx.fillRect(blockX, blockY, blockW, blockH);
  ctx.strokeStyle = 'rgba(100, 150, 200, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(blockX, blockY, blockW, blockH);
  
  // Label
  ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Glass Block', blockX + blockW/2, blockY + blockH/2);
  ctx.fillText('n = 1.52', blockX + blockW/2, blockY + blockH/2 + 20);
  
  // Normal line (dashed)
  const centerX = w / 2;
  const centerY = h / 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, blockY - 50);
  ctx.lineTo(centerX, blockY + blockH + 50);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Calculate refraction angles (Snell's law)
  const n1 = 1.0; // air
  const n2 = 1.52; // glass
  const theta1 = angleOfIncidence * Math.PI / 180;
  const theta2 = Math.asin((n1 / n2) * Math.sin(theta1));
  const theta3 = theta2; // inside glass
  const theta4 = Math.asin((n2 / n1) * Math.sin(theta3)); // back to air
  
  // Incident ray (from top-left)
  const rayLength = 150;
  const incidentX = centerX - rayLength * Math.sin(theta1);
  const incidentY = blockY - rayLength * Math.cos(theta1);
  
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(incidentX, incidentY);
  ctx.lineTo(centerX, blockY);
  ctx.stroke();
  
  // Arrow on incident ray
  drawArrow(ctx, incidentX, incidentY, centerX, blockY, '#ff4444');
  
  // Refracted ray (inside glass)
  const refractedX = centerX + blockW * Math.sin(theta2);
  const refractedY = blockY + blockH;
  
  ctx.strokeStyle = '#ff8800';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, blockY);
  ctx.lineTo(centerX + blockW * Math.sin(theta2), blockY + blockH);
  ctx.stroke();
  
  // Emergent ray (exiting glass)
  const emergentX = centerX + blockW * Math.sin(theta2) + rayLength * Math.sin(theta4);
  const emergentY = blockY + blockH + rayLength * Math.cos(theta4);
  
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX + blockW * Math.sin(theta2), blockY + blockH);
  ctx.lineTo(emergentX, emergentY);
  ctx.stroke();
  
  // Arrow on emergent ray
  drawArrow(ctx, centerX + blockW * Math.sin(theta2), blockY + blockH, emergentX, emergentY, '#ff4444');
  
  // Angle labels
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`θ₁ = ${angleOfIncidence.toFixed(1)}°`, centerX - 80, blockY - 20);
  ctx.fillStyle = '#ff8800';
  ctx.fillText(`θ₂ = ${(theta2 * 180 / Math.PI).toFixed(1)}°`, centerX + 10, blockY + 50);
  
  // Wavelength color indicator
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(w - 50, 30, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('λ = 650nm', w - 50, 55);
}

function drawArrow(ctx, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}
```

### 2. Simple Circuit (Ohm's Law)

```javascript
function drawCircuit(ctx, w, h, voltage, resistance) {
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  
  const centerX = w / 2;
  const centerY = h / 2;
  
  // Battery
  ctx.fillStyle = '#333';
  ctx.fillRect(centerX - 150, centerY - 30, 20, 60);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(centerX - 148, centerY - 28, 16, 25);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(centerX - 148, centerY + 3, 16, 25);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${voltage}V`, centerX - 140, centerY + 50);
  
  // Wires (top)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX - 130, centerY - 20);
  ctx.lineTo(centerX - 80, centerY - 20);
  ctx.lineTo(centerX - 80, centerY - 80);
  ctx.lineTo(centerX + 80, centerY - 80);
  ctx.lineTo(centerX + 80, centerY - 20);
  ctx.lineTo(centerX + 130, centerY - 20);
  ctx.stroke();
  
  // Wires (bottom)
  ctx.beginPath();
  ctx.moveTo(centerX - 130, centerY + 20);
  ctx.lineTo(centerX - 80, centerY + 20);
  ctx.lineTo(centerX - 80, centerY + 80);
  ctx.lineTo(centerX + 80, centerY + 80);
  ctx.lineTo(centerX + 80, centerY + 20);
  ctx.lineTo(centerX + 130, centerY + 20);
  ctx.stroke();
  
  // Resistor (zigzag)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX - 80, centerY - 80);
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(centerX - 60 + i * 20, centerY - 80 + (i % 2 === 0 ? -15 : 15));
  }
  ctx.lineTo(centerX + 80, centerY - 80);
  ctx.stroke();
  
  // Resistor label
  ctx.fillStyle = '#F59E0B';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`R = ${resistance}Ω`, centerX, centerY - 100);
  
  // Ammeter (circle with A)
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX + 80, centerY, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A', centerX + 80, centerY + 5);
  
  // Current value
  const current = voltage / resistance;
  ctx.fillStyle = '#34D399';
  ctx.font = '12px monospace';
  ctx.fillText(`I = ${current.toFixed(2)}A`, centerX + 80, centerY + 35);
  
  // Current flow arrows (animated)
  const time = Date.now() / 1000;
  ctx.fillStyle = '#60A5FA';
  for (let i = 0; i < 5; i++) {
    const t = (time + i * 0.2) % 1;
    const x = centerX - 130 + t * 260;
    ctx.beginPath();
    ctx.arc(x, centerY - 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

### 3. Simple Pendulum

```javascript
function drawPendulum(ctx, w, h, angle, length, mass) {
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  
  const pivotX = w / 2;
  const pivotY = 80;
  const bobRadius = mass * 3 + 10;
  
  // Pivot point
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // String
  const bobX = pivotX + length * Math.sin(angle);
  const bobY = pivotY + length * Math.cos(angle);
  
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();
  
  // Bob
  const bobGrad = ctx.createRadialGradient(bobX - 3, bobY - 3, 2, bobX, bobY, bobRadius);
  bobGrad.addColorStop(0, '#60A5FA');
  bobGrad.addColorStop(1, '#3B82F6');
  ctx.fillStyle = bobGrad;
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Angle arc
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 40, Math.PI / 2, Math.PI / 2 + angle, angle > 0);
  ctx.stroke();
  
  // Angle label
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`θ = ${(angle * 180 / Math.PI).toFixed(1)}°`, pivotX + 50 * Math.sign(angle), pivotY + 50);
  
  // Trail (ghost positions)
  ctx.strokeStyle = 'rgba(96,165,250,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, length, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5);
  ctx.stroke();
  
  // Period calculation
  const period = 2 * Math.PI * Math.sqrt(length / 981); // length in cm
  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`T = ${period.toFixed(2)}s`, 20, h - 40);
  ctx.fillText(`L = ${(length / 100).toFixed(2)}m`, 20, h - 20);
}
```

### 4. Projectile Motion

```javascript
function drawProjectile(ctx, w, h, angle, velocity, time, trail) {
  ctx.clearRect(0, 0, w, h);
  
  // Background with grid
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  
  // Ground
  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, h - 30, w, 30);
  
  // Launch point
  const launchX = 80;
  const launchY = h - 30;
  
  // Cannon
  ctx.fillStyle = '#555';
  ctx.save();
  ctx.translate(launchX, launchY);
  ctx.rotate(-angle * Math.PI / 180);
  ctx.fillRect(-10, -5, 40, 10);
  ctx.restore();
  
  // Draw trail
  if (trail.length > 1) {
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    trail.forEach((point, i) => {
      const x = launchX + point.x;
      const y = launchY - point.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Trail dots
    trail.forEach((point, i) => {
      if (i % 5 === 0) {
        ctx.fillStyle = `rgba(239,68,68,${0.3 + (i / trail.length) * 0.7})`;
        ctx.beginPath();
        ctx.arc(launchX + point.x, launchY - point.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  
  // Current projectile position
  const rad = angle * Math.PI / 180;
  const vx = velocity * Math.cos(rad);
  const vy = velocity * Math.sin(rad);
  const currentX = vx * time;
  const currentY = vy * time - 0.5 * 981 * time * time; // gravity in cm/s²
  
  if (currentY >= 0) {
    const projX = launchX + currentX;
    const projY = launchY - currentY;
    
    // Projectile
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(projX, projY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Velocity vector
    const vCurrentY = vy - 981 * time;
    const vMag = Math.sqrt(vx * vx + vCurrentY * vCurrentY);
    const vScale = 30 / vMag;
    
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(projX, projY);
    ctx.lineTo(projX + vx * vScale, projY - vCurrentY * vScale);
    ctx.stroke();
    drawArrow(ctx, projX, projY, projX + vx * vScale, projY - vCurrentY * vScale, '#34D399');
  }
  
  // Data overlay
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.fillRect(10, 10, 180, 80);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Angle: ${angle}°`, 20, 30);
  ctx.fillText(`Velocity: ${velocity} m/s`, 20, 48);
  ctx.fillText(`Time: ${time.toFixed(2)}s`, 20, 66);
  ctx.fillText(`Height: ${(currentY / 100).toFixed(2)}m`, 20, 84);
}
```

### 5. Wave Interference

```javascript
function drawWaveInterference(ctx, w, h, freq1, freq2, amp1, amp2, time) {
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  
  const centerY = h / 2;
  
  // Wave 1 (top)
  ctx.strokeStyle = '#60A5FA';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const y = centerY - 80 + amp1 * Math.sin(2 * Math.PI * freq1 * (x / w) - time * 3);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Wave 2 (middle)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const y = centerY + amp2 * Math.sin(2 * Math.PI * freq2 * (x / w) - time * 3);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Superposition (bottom)
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const y1 = amp1 * Math.sin(2 * Math.PI * freq1 * (x / w) - time * 3);
    const y2 = amp2 * Math.sin(2 * Math.PI * freq2 * (x / w) - time * 3);
    const y = centerY + 80 + y1 + y2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Labels
  ctx.fillStyle = '#60A5FA';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Wave 1', 10, centerY - 80 - amp1 - 10);
  
  ctx.fillStyle = '#F59E0B';
  ctx.fillText('Wave 2', 10, centerY - amp2 - 10);
  
  ctx.fillStyle = '#34D399';
  ctx.fillText('Superposition', 10, centerY + 80 - amp1 - amp2 - 10);
  
  // Zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(w, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
}
```

## Chemistry Experiment Visualizations

### 6. Titration Setup

```javascript
function drawTitration(ctx, w, h, buretteLevel, flaskColor, flaskLevel) {
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  
  // Clamp stand
  ctx.fillStyle = '#555';
  ctx.fillRect(w/2 - 3, 20, 6, h - 60);
  ctx.fillRect(w/2 - 30, h - 40, 60, 8);
  
  // Burette
  ctx.strokeStyle = 'rgba(180,220,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(w/2 - 8, 30, 16, 200);
  
  // Burette liquid
  const buretteH = buretteLevel * 190;
  ctx.fillStyle = 'rgba(0,100,255,0.4)';
  ctx.fillRect(w/2 - 7, 30 + 190 - buretteH, 14, buretteH);
  
  // Tap
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(w/2 - 10, 230, 20, 8);
  
  // Conical flask
  ctx.beginPath();
  ctx.moveTo(w/2 - 8, 280);
  ctx.lineTo(w/2 - 8, 310);
  ctx.lineTo(w/2 - 40, h - 60);
  ctx.lineTo(w/2 + 40, h - 60);
  ctx.lineTo(w/2 + 8, 310);
  ctx.lineTo(w/2 + 8, 280);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(180,220,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Flask liquid
  if (flaskLevel > 0) {
    const liquidTop = h - 60 - flaskLevel * 100;
    ctx.fillStyle = flaskColor;
    ctx.beginPath();
    ctx.moveTo(w/2 - 8, liquidTop);
    ctx.lineTo(w/2 - 8, 310);
    ctx.lineTo(w/2 - 40, h - 60);
    ctx.lineTo(w/2 + 40, h - 60);
    ctx.lineTo(w/2 + 8, 310);
    ctx.lineTo(w/2 + 8, liquidTop);
    ctx.closePath();
    ctx.fill();
  }
  
  // White tile under flask
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(w/2 - 50, h - 55, 100, 5);
  
  // Labels
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NaOH (aq)', w/2, 25);
  ctx.fillText('HCl + Indicator', w/2, h - 20);
}
```

### 7. Electrolysis of Water

```javascript
function drawElectrolysis(ctx, w, h, voltage, time) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  
  const centerX = w / 2;
  
  // Water tank (inverted test tube setup)
  ctx.strokeStyle = 'rgba(180,220,255,0.6)';
  ctx.lineWidth = 2;
  
  // Left test tube (cathode - H₂)
  const tube1X = centerX - 80;
  ctx.strokeRect(tube1X - 15, 60, 30, 200);
  ctx.fillStyle = 'rgba(0,120,255,0.2)';
  ctx.fillRect(tube1X - 14, 60 + 200 - (200 * 0.7), 28, 200 * 0.7);
  ctx.fillStyle = 'rgba(200,230,255,0.9)';
  ctx.fillRect(tube1X - 14, 60, 28, 200 - (200 * 0.7));
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H₂', tube1X, 50);
  
  // Right test tube (anode - O₂)
  const tube2X = centerX + 80;
  ctx.strokeRect(tube2X - 15, 60, 30, 200);
  ctx.fillStyle = 'rgba(0,120,255,0.2)';
  ctx.fillRect(tube2X - 14, 60 + 200 - (200 * 0.85), 28, 200 * 0.85);
  ctx.fillStyle = 'rgba(200,230,255,0.9)';
  ctx.fillRect(tube2X - 14, 60, 28, 200 - (200 * 0.85));
  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('O₂', tube2X, 50);
  
  // Electrodes
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tube1X, 260);
  ctx.lineTo(tube1X, h - 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tube2X, 260);
  ctx.lineTo(tube2X, h - 60);
  ctx.stroke();
  
  // Battery
  ctx.fillStyle = '#333';
  ctx.fillRect(centerX - 40, h - 50, 80, 30);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(centerX - 38, h - 48, 36, 26);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(centerX + 2, h - 48, 36, 26);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${voltage}V`, centerX, h - 32);
  
  // Wires from battery to electrodes
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 40, h - 35);
  ctx.lineTo(tube1X, h - 35);
  ctx.lineTo(tube1X, h - 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX + 40, h - 35);
  ctx.lineTo(tube2X, h - 35);
  ctx.lineTo(tube2X, h - 60);
  ctx.stroke();
  
  // Bubbles rising from electrodes
  const bubbleTime = time * 3;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 8; i++) {
    const t = (bubbleTime + i * 0.3) % 2;
    const bx = tube1X + (Math.random() - 0.5) * 10;
    const by = 260 - t * 80;
    if (by > 60) {
      ctx.beginPath();
      ctx.arc(bx, by, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 6; i++) {
    const t = (bubbleTime + i * 0.4) % 2;
    const bx = tube2X + (Math.random() - 0.5) * 10;
    const by = 260 - t * 80;
    if (by > 60) {
      ctx.beginPath();
      ctx.arc(bx, by, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Equation
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('2H₂O → 2H₂ + O₂', centerX, 30);
}
```

### 8. Convex Lens (Optical Bench)

```javascript
function drawConvexLens(ctx, w, h, objectDist, focalLength) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  
  const centerY = h / 2;
  const lensX = w / 2;
  const scale = 3; // pixels per cm
  
  // Principal axis
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(w, centerY);
  ctx.stroke();
  
  // Convex lens (double arrow shape)
  ctx.strokeStyle = '#60A5FA';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lensX, centerY - 60);
  ctx.lineTo(lensX, centerY + 60);
  ctx.stroke();
  // Arrow heads
  ctx.beginPath();
  ctx.moveTo(lensX - 8, centerY - 50);
  ctx.lineTo(lensX, centerY - 60);
  ctx.lineTo(lensX + 8, centerY - 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lensX - 8, centerY + 50);
  ctx.lineTo(lensX, centerY + 60);
  ctx.lineTo(lensX + 8, centerY + 50);
  ctx.stroke();
  
  // Focal points
  const fPx = focalLength * scale;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(lensX - fPx, centerY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lensX + fPx, centerY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('F', lensX - fPx, centerY + 18);
  ctx.fillText('F\'', lensX + fPx, centerY + 18);
  
  // Object (upward arrow)
  const objX = lensX - objectDist * scale;
  const objH = 50;
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(objX, centerY);
  ctx.lineTo(objX, centerY - objH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(objX - 6, centerY - objH + 8);
  ctx.lineTo(objX, centerY - objH);
  ctx.lineTo(objX + 6, centerY - objH + 8);
  ctx.stroke();
  ctx.fillStyle = '#34D399';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Object', objX, centerY + 18);
  
  // Image (using lens equation: 1/v = 1/f - 1/u)
  const u = objectDist;
  const v = 1 / (1 / focalLength - 1 / u);
  const mag = v / u;
  const imgH = objH * Math.abs(mag);
  const imgX = lensX + v * scale;
  
  // Draw image only if real (v > 0)
  if (v > 0 && imgX < w) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(imgX, centerY);
    ctx.lineTo(imgX, centerY + (mag > 0 ? -imgH : imgH));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(imgX - 6, centerY + (mag > 0 ? -imgH + 8 : imgH - 8));
    ctx.lineTo(imgX, centerY + (mag > 0 ? -imgH : imgH));
    ctx.lineTo(imgX + 6, centerY + (mag > 0 ? -imgH + 8 : imgH - 8));
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Image', imgX, centerY + 18);
  }
  
  // Ray 1: Parallel to axis, through F'
  ctx.strokeStyle = 'rgba(239,68,68,0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(objX, centerY - objH);
  ctx.lineTo(lensX, centerY - objH);
  ctx.lineTo(imgX, centerY + (mag > 0 ? -imgH : imgH));
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Ray 2: Through center of lens
  ctx.strokeStyle = 'rgba(96,165,250,0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(objX, centerY - objH);
  ctx.lineTo(imgX, centerY + (mag > 0 ? -imgH : imgH));
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Data panel
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.fillRect(10, 10, 200, 80);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`u = ${objectDist} cm`, 20, 30);
  ctx.fillText(`v = ${v.toFixed(1)} cm`, 20, 48);
  ctx.fillText(`f = ${focalLength} cm`, 20, 66);
  ctx.fillText(`m = ${mag.toFixed(2)}x`, 20, 84);
}
```

### 9. Beaker Reaction (Gas Evolution + Color Change)

```javascript
function drawBeakerReaction(ctx, w, h, reactionProgress, liquidColor, gasProducing) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  
  // Lab bench
  const benchY = h * 0.75;
  const benchGrad = ctx.createLinearGradient(0, benchY, 0, h);
  benchGrad.addColorStop(0, '#5C4033');
  benchGrad.addColorStop(1, '#3D2B1F');
  ctx.fillStyle = benchGrad;
  ctx.fillRect(0, benchY, w, h - benchY);
  
  // Beaker
  const beakerX = w / 2;
  const beakerW = 100, beakerH = 140;
  const beakerTop = benchY - beakerH;
  
  // Glass body
  const glassGrad = ctx.createLinearGradient(beakerX - beakerW/2, 0, beakerX + beakerW/2, 0);
  glassGrad.addColorStop(0, 'rgba(200,230,255,0.35)');
  glassGrad.addColorStop(0.3, 'rgba(220,240,255,0.12)');
  glassGrad.addColorStop(0.7, 'rgba(220,240,255,0.12)');
  glassGrad.addColorStop(1, 'rgba(200,230,255,0.35)');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(beakerX - beakerW/2, beakerTop, beakerW, beakerH);
  ctx.strokeStyle = 'rgba(180,220,255,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(beakerX - beakerW/2, beakerTop, beakerW, beakerH);
  
  // Liquid (animated fill based on reaction progress)
  const liquidFill = Math.min(0.3 + reactionProgress * 0.4, 0.7);
  const liquidTop = benchY - beakerH * liquidFill;
  const liquidGrad = ctx.createLinearGradient(0, liquidTop, 0, benchY);
  liquidGrad.addColorStop(0, liquidColor);
  liquidGrad.addColorStop(1, liquidColor.replace(/\)/, ',0.8)').replace('rgb', 'rgba'));
  ctx.fillStyle = liquidGrad;
  ctx.beginPath();
  ctx.moveTo(beakerX - beakerW/2 + 2, liquidTop + 3);
  ctx.quadraticCurveTo(beakerX, liquidTop - 2, beakerX + beakerW/2 - 2, liquidTop + 3);
  ctx.lineTo(beakerX + beakerW/2 - 2, benchY);
  ctx.lineTo(beakerX - beakerW/2 + 2, benchY);
  ctx.closePath();
  ctx.fill();
  
  // Bubbles (if gas producing)
  if (gasProducing && reactionProgress > 0.1) {
     ctx.fillStyle = 'rgba(255,255,255,0.5)';
     for (let i = 0; i < 12; i++) {
       const t = (Date.now() / 1000 + i * 0.4) % 2;
       const bx = beakerX + (Math.sin(i * 2.3) * beakerW * 0.3);
       const by = benchY - t * beakerH * 0.6;
       if (by > liquidTop && by < benchY) {
         ctx.beginPath();
         ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
         ctx.fill();
       }
     }
  }
  
  // Spout
  ctx.strokeStyle = 'rgba(180,220,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(beakerX + beakerW/2, beakerTop);
  ctx.lineTo(beakerX + beakerW/2 + 15, beakerTop - 8);
  ctx.stroke();
  
  // Graduation marks
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'right';
  for (let i = 1; i <= 4; i++) {
    const gy = benchY - (beakerH * i / 5);
    ctx.beginPath();
    ctx.moveTo(beakerX - beakerW/2, gy);
    ctx.lineTo(beakerX - beakerW/2 + 12, gy);
    ctx.stroke();
    ctx.fillText(`${i * 50}ml`, beakerX - beakerW/2 - 4, gy + 3);
  }
  
  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Beaker', beakerX, benchY + 18);
}
```

## Key Rules

1. **ALWAYS draw the experiment** — canvas is the main content, not controls
2. **Use the correct colors** — light rays are red/orange, glass is blue-tinted transparent
3. **Show measurements** — angles, distances, values ON the visualization
4. **Animate continuously** — requestAnimationFrame loop, not static
5. **Label everything** — apparatus names, values, units directly on canvas
6. **Fill 80%+ of screen** — canvas should dominate, controls are small overlays
7. **Responsive** — canvas fills available space, resizes with window
8. **Draw apparatus WITH realistic details** — glass gradients, liquid meniscus, graduation marks, shadows
9. **Show PHYSICS FORMULAS** — Snell's law, Ohm's law, lens equation ON the canvas during the experiment
10. **Animate the SCIENCE** — light bends at glass boundary, current flows through wires, pendulum swings, bubbles rise
