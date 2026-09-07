# Matter.js Real Physics Engine Patterns

For physics simulations that need real collision detection, gravity, and force calculations, use Matter.js. This provides physically accurate behavior instead of approximated animations.

## When to Use Matter.js vs Canvas Animation

| Use Matter.js When | Use Canvas Animation When |
|---|---|
| Collisions between objects | Simple projectile motion (parabola) |
| Gravity simulation (pendulum, springs) | Wave patterns |
| Object stacking/bouncing | Circuit diagrams |
| Fluid-like behavior | Graph plotting |
| Multiple interacting bodies | Single object animation |

## HTML Setup

```html
<!-- Include Matter.js from CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js"></script>

<div id="physics-container" style="position:relative; width:100%; height:500px;">
  <canvas id="physics-canvas" width="800" height="500" 
    style="width:100%; height:100%; background:#0a0a1a; border-radius:8px;"></canvas>
  
  <!-- Controls overlay -->
  <div id="physics-controls" style="position:absolute; top:12px; right:12px; 
       background:rgba(15,23,42,0.9); border-radius:10px; padding:12px; min-width:180px;">
    <div style="color:#94A3B8; font-size:11px; text-transform:uppercase; margin-bottom:8px;">Controls</div>
    
    <!-- Gravity slider -->
    <div style="margin-bottom:8px;">
      <div style="color:#E2E8F0; font-size:12px;">Gravity: <span id="gravity-val">1.0</span>g</div>
      <input type="range" id="gravity-slider" min="0" max="3" step="0.1" value="1.0"
        style="width:100%; accent-color:#60A5FA;">
    </div>
    
    <!-- Preset buttons -->
    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
      <button class="gravity-preset" data-g="1.0" style="padding:4px 8px; font-size:11px; 
        background:rgba(96,165,250,0.2); color:#60A5FA; border:1px solid rgba(96,165,250,0.3); 
        border-radius:4px; cursor:pointer;">🌍 Earth</button>
      <button class="gravity-preset" data-g="0.165" style="padding:4px 8px; font-size:11px; 
        background:rgba(255,255,255,0.05); color:#94A3B8; border:1px solid rgba(255,255,255,0.1); 
        border-radius:4px; cursor:pointer;">🌙 Moon</button>
      <button class="gravity-preset" data-g="0.38" style="padding:4px 8px; font-size:11px; 
        background:rgba(255,255,255,0.05); color:#94A3B8; border:1px solid rgba(255,255,255,0.1); 
        border-radius:4px; cursor:pointer;">🔴 Mars</button>
      <button class="gravity-preset" data-g="0" style="padding:4px 8px; font-size:11px; 
        background:rgba(255,255,255,0.05); color:#94A3B8; border:1px solid rgba(255,255,255,0.1); 
        border-radius:4px; cursor:pointer;">🚀 Zero-G</button>
    </div>
    
    <!-- Drop buttons -->
    <div style="display:flex; gap:4px;">
      <button id="drop-ball" style="flex:1; padding:6px; font-size:12px; 
        background:rgba(52,211,153,0.2); color:#34D399; border:1px solid rgba(52,211,153,0.3); 
        border-radius:6px; cursor:pointer;">+ Ball</button>
      <button id="drop-box" style="flex:1; padding:6px; font-size:12px; 
        background:rgba(245,158,11,0.2); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); 
        border-radius:6px; cursor:pointer;">+ Box</button>
    </div>
    
    <button id="reset-physics" style="width:100%; margin-top:8px; padding:6px; font-size:12px; 
      background:rgba(239,68,68,0.2); color:#EF4444; border:1px solid rgba(239,68,68,0.3); 
      border-radius:6px; cursor:pointer;">Reset</button>
  </div>
  
  <!-- Stats overlay -->
  <div id="physics-stats" style="position:absolute; bottom:12px; left:12px; 
       background:rgba(15,23,42,0.9); border-radius:8px; padding:10px 14px; font-family:monospace; font-size:12px;">
    <div style="color:#94A3B8;">Objects: <span id="stat-objects" style="color:#60A5FA;">0</span></div>
    <div style="color:#94A3B8;">Kinetic: <span id="stat-kinetic" style="color:#34D399;">0.0</span> J</div>
    <div style="color:#94A3B8;">Potential: <span id="stat-potential" style="color:#F59E0B;">0.0</span> J</div>
  </div>
</div>
```

## JavaScript Implementation

```javascript
const { Engine, Render, Runner, Bodies, Body, Composite, Events, Mouse, MouseConstraint, Vector } = Matter;

// Create engine
const engine = Engine.create({
  gravity: { x: 0, y: 1.0 }
});

// Create renderer
const render = Render.create({
  canvas: document.getElementById('physics-canvas'),
  engine: engine,
  options: {
    width: 800,
    height: 500,
    wireframes: false,
    background: '#0a0a1a',
    pixelRatio: window.devicePixelRatio || 1,
  }
});

// Ground
const ground = Bodies.rectangle(400, 490, 800, 20, {
  isStatic: true,
  render: { fillStyle: '#334155' }
});

// Walls
const leftWall = Bodies.rectangle(-10, 250, 20, 500, {
  isStatic: true,
  render: { visible: false }
});
const rightWall = Bodies.rectangle(810, 250, 20, 500, {
  isStatic: true,
  render: { visible: false }
});

Composite.add(engine.world, [ground, leftWall, rightWall]);

// Object colors
const COLORS = ['#EF4444', '#F59E0B', '#34D399', '#60A5FA', '#8B5CF6', '#EC4899'];
let colorIndex = 0;

function getNextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

// Drop ball
function dropBall() {
  const x = 200 + Math.random() * 400;
  const radius = 10 + Math.random() * 15;
  const ball = Bodies.circle(x, 50, radius, {
    restitution: 0.7,
    friction: 0.3,
    density: 0.001,
    render: {
      fillStyle: getNextColor(),
      strokeStyle: '#ffffff',
      lineWidth: 1,
    }
  });
  Composite.add(engine.world, ball);
  updateStats();
}

// Drop box
function dropBox() {
  const x = 200 + Math.random() * 400;
  const size = 15 + Math.random() * 25;
  const box = Bodies.rectangle(x, 50, size, size, {
    restitution: 0.5,
    friction: 0.4,
    density: 0.001,
    angle: Math.random() * Math.PI,
    render: {
      fillStyle: getNextColor(),
      strokeStyle: '#ffffff',
      lineWidth: 1,
    }
  });
  Composite.add(engine.world, box);
  updateStats();
}

// Update gravity
function setGravity(value) {
  engine.gravity.y = value;
  document.getElementById('gravity-val').textContent = value.toFixed(1);
  
  // Update preset button styles
  document.querySelectorAll('.gravity-preset').forEach(btn => {
    if (parseFloat(btn.dataset.g) === value) {
      btn.style.background = 'rgba(96,165,250,0.2)';
      btn.style.color = '#60A5FA';
      btn.style.borderColor = 'rgba(96,165,250,0.3)';
    } else {
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.color = '#94A3B8';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
}

// Reset
function resetPhysics() {
  Composite.clear(engine.world);
  Composite.add(engine.world, [ground, leftWall, rightWall]);
  colorIndex = 0;
  updateStats();
}

// Stats
function updateStats() {
  const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
  let kinetic = 0;
  let potential = 0;
  
  bodies.forEach(body => {
    const v = Vector.magnitude(body.velocity);
    kinetic += 0.5 * body.mass * v * v;
    potential += body.mass * engine.gravity.y * (500 - body.position.y) * 0.01;
  });
  
  document.getElementById('stat-objects').textContent = bodies.length;
  document.getElementById('stat-kinetic').textContent = kinetic.toFixed(1);
  document.getElementById('stat-potential').textContent = potential.toFixed(1);
}

// Mouse interaction
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});
Composite.add(engine.world, mouseConstraint);
render.mouse = mouse;

// Event listeners
document.getElementById('drop-ball').addEventListener('click', dropBall);
document.getElementById('drop-box').addEventListener('click', dropBox);
document.getElementById('reset-physics').addEventListener('click', resetPhysics);
document.getElementById('gravity-slider').addEventListener('input', (e) => {
  setGravity(parseFloat(e.target.value));
});

document.querySelectorAll('.gravity-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    setGravity(parseFloat(btn.dataset.g));
    document.getElementById('gravity-slider').value = btn.dataset.g;
  });
});

// Update stats on each frame
Events.on(engine, 'afterUpdate', updateStats);

// Run
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);
```

## Pendulum Simulation

```javascript
function createPendulum(length = 200, angle = Math.PI / 4) {
  const pivotX = 400;
  const pivotY = 100;
  
  const pivot = Bodies.circle(pivotX, pivotY, 5, {
    isStatic: true,
    render: { fillStyle: '#94A3B8' }
  });
  
  const bob = Bodies.circle(
    pivotX + length * Math.sin(angle),
    pivotY + length * Math.cos(angle),
    20,
    {
      mass: 1,
      restitution: 0.9,
      friction: 0,
      frictionAir: 0,
      render: { fillStyle: '#60A5FA' }
    }
  );
  
  const constraint = Matter.Constraint.create({
    bodyA: pivot,
    bodyB: bob,
    length: length,
    stiffness: 1,
    render: {
      strokeStyle: '#94A3B8',
      lineWidth: 2,
    }
  });
  
  Composite.add(engine.world, [pivot, bob, constraint]);
  return { pivot, bob, constraint };
}
```

## Spring-Mass System

```javascript
function createSpring(mass = 1, springConstant = 0.01, restLength = 150) {
  const anchorX = 400;
  const anchorY = 50;
  
  const anchor = Bodies.circle(anchorX, anchorY, 5, {
    isStatic: true,
    render: { fillStyle: '#94A3B8' }
  });
  
  const mass_block = Bodies.rectangle(anchorX, anchorY + restLength, 30, 30, {
    mass: mass,
    restitution: 0.3,
    render: { fillStyle: '#F59E0B' }
  });
  
  const spring = Matter.Constraint.create({
    bodyA: anchor,
    bodyB: mass_block,
    length: restLength,
    stiffness: springConstant,
    damping: 0.01,
    render: {
      strokeStyle: '#34D399',
      lineWidth: 2,
      type: 'spring' // Renders as zigzag
    }
  });
  
  Composite.add(engine.world, [anchor, mass_block, spring]);
  return { anchor, mass_block, spring };
}
```

## Projectile Motion with Trajectory

```javascript
function launchProjectile(angle, velocity) {
  const rad = angle * Math.PI / 180;
  const vx = velocity * Math.cos(rad);
  const vy = -velocity * Math.sin(rad);
  
  const ball = Bodies.circle(100, 450, 12, {
    restitution: 0.6,
    friction: 0.1,
    density: 0.002,
    render: { fillStyle: '#EF4444' }
  });
  
  Body.setVelocity(ball, { x: vx, y: vy });
  Composite.add(engine.world, ball);
  
  // Track trajectory
  const trajectory = [];
  Events.on(engine, 'afterUpdate', function trackTrajectory() {
    trajectory.push({ x: ball.position.x, y: ball.position.y });
    if (trajectory.length > 500) trajectory.shift();
    
    // Draw trajectory dots
    const ctx = render.context;
    trajectory.forEach((point, i) => {
      const alpha = i / trajectory.length;
      ctx.fillStyle = `rgba(239,68,68,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  
  return ball;
}
```

## Gravity Presets

```javascript
const GRAVITY_PRESETS = {
  earth:   { value: 1.0,   name: 'Earth',   emoji: '🌍', description: '9.81 m/s²' },
  moon:    { value: 0.165, name: 'Moon',    emoji: '🌙', description: '1.62 m/s²' },
  mars:    { value: 0.38,  name: 'Mars',    emoji: '🔴', description: '3.72 m/s²' },
  jupiter: { value: 2.53,  name: 'Jupiter', emoji: '🪐', description: '24.79 m/s²' },
  zeroG:   { value: 0,     name: 'Zero-G',  emoji: '🚀', description: '0 m/s²' },
};
```

## Key Design Rules
1. Matter.js handles all physics — no manual velocity/position updates
2. Use `wireframes: false` for colored rendering
3. Ground and walls are `isStatic: true`
4. Objects have `restitution` (bounciness) and `friction`
5. Mouse constraint allows dragging objects
6. Stats update on every `afterUpdate` event
7. Gravity presets change `engine.gravity.y`
8. Trajectory tracking uses position history array
9. All objects auto-collide with each other
10. Performance: keep body count under 100 for smooth 60fps
