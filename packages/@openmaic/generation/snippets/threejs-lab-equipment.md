# Three.js 3D Lab Equipment Patterns

When generating `visualization3d` widgets or when the simulation prompt specifies 3D rendering, use these Three.js patterns for realistic lab equipment.

## 3D Beaker with Liquid

```javascript
function createBeaker(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Glass body (transparent cylinder, open top)
  const glassGeom = new THREE.CylinderGeometry(0.8, 0.8, 2, 32, 1, true);
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
  glass.position.y = 1;
  group.add(glass);
  
  // Bottom (opaque disc)
  const bottomGeom = new THREE.CircleGeometry(0.8, 32);
  const bottomMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
  });
  const bottom = new THREE.Mesh(bottomGeom, bottomMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  group.add(bottom);
  
  // Graduation marks
  for (let i = 1; i <= 4; i++) {
    const markGeom = new THREE.PlaneGeometry(0.15, 0.01);
    const markMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const mark = new THREE.Mesh(markGeom, markMat);
    mark.position.set(-0.82, i * 0.4, 0);
    group.add(mark);
  }
  
  return { group, liquid: null, fillLevel: 0 };
}

function updateBeakerLiquid(beaker, level, color) {
  // Remove old liquid
  if (beaker.liquid) {
    beaker.group.remove(beaker.liquid);
    beaker.liquid.geometry.dispose();
    beaker.liquid.material.dispose();
  }
  
  if (level <= 0) return;
  
  // Create new liquid cylinder
  const height = level * 1.9;
  const liquidGeom = new THREE.CylinderGeometry(0.76, 0.76, height, 32);
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.6,
    roughness: 0.2,
    metalness: 0.0,
  });
  const liquid = new THREE.Mesh(liquidGeom, liquidMat);
  liquid.position.y = height / 2 + 0.05;
  
  beaker.group.add(liquid);
  beaker.liquid = liquid;
  beaker.fillLevel = level;
}
```

## 3D Test Tube

```javascript
function createTestTube(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Glass tube (cylinder with rounded bottom)
  const tubeGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 16, 1, true);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    side: THREE.DoubleSide,
    transmission: 0.9,
  });
  const tube = new THREE.Mesh(tubeGeom, glassMat);
  tube.position.y = 0.75;
  group.add(tube);
  
  // Rounded bottom (sphere segment)
  const bottomGeom = new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const bottom = new THREE.Mesh(bottomGeom, glassMat);
  bottom.position.y = 0;
  bottom.rotation.x = Math.PI;
  group.add(bottom);
  
  // Rim at top
  const rimGeom = new THREE.TorusGeometry(0.2, 0.02, 8, 16);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
  });
  const rim = new THREE.Mesh(rimGeom, rimMat);
  rim.position.y = 1.5;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  
  return { group, liquid: null };
}
```

## 3D Bunsen Burner

```javascript
function createBunsenBurner(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Base (heavy disc)
  const baseGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.3 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  group.add(base);
  
  // Tube (vertical cylinder)
  const tubeGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.8, 16);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 });
  const tube = new THREE.Mesh(tubeGeom, tubeMat);
  tube.position.y = 0.4;
  group.add(tube);
  
  // Air collar
  const collarGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
  const collarMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.3 });
  const collar = new THREE.Mesh(collarGeom, collarMat);
  collar.position.y = 0.35;
  group.add(collar);
  
  return { group, flame: null };
}

function createFlame(parent, intensity = 1.0) {
  if (intensity <= 0) return null;
  
  const flameGroup = new THREE.Group();
  
  // Inner flame (blue cone)
  const innerGeom = new THREE.ConeGeometry(0.03 * intensity, 0.15 * intensity, 8);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.8,
  });
  const inner = new THREE.Mesh(innerGeom, innerMat);
  inner.position.y = 0.85;
  flameGroup.add(inner);
  
  // Outer flame (yellow-orange cone)
  const outerGeom = new THREE.ConeGeometry(0.05 * intensity, 0.2 * intensity, 8);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xff8800,
    transparent: true,
    opacity: 0.6,
  });
  const outer = new THREE.Mesh(outerGeom, outerMat);
  outer.position.y = 0.88;
  flameGroup.add(outer);
  
  // Glow
  const glowGeom = new THREE.SphereGeometry(0.1 * intensity, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    transparent: true,
    opacity: 0.2,
  });
  const glow = new THREE.Mesh(glowGeom, glowMat);
  glow.position.y = 0.85;
  flameGroup.add(glow);
  
  // Point light for flame illumination
  const light = new THREE.PointLight(0xff8800, intensity * 2, 3);
  light.position.y = 0.9;
  flameGroup.add(light);
  
  parent.add(flameGroup);
  return flameGroup;
}
```

## 3D Dropper / Pipette

```javascript
function createDropper(position = [0, 0, 0], angle = 0) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.z = angle;
  
  // Rubber bulb
  const bulbGeom = new THREE.SphereGeometry(0.08, 16, 16);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.8 });
  const bulb = new THREE.Mesh(bulbGeom, bulbMat);
  bulb.position.y = 0.4;
  bulb.scale.y = 1.3;
  group.add(bulb);
  
  // Glass tube
  const tubeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    roughness: 0.05,
  });
  const tube = new THREE.Mesh(tubeGeom, glassMat);
  tube.position.y = 0.15;
  group.add(tube);
  
  // Tip (narrow)
  const tipGeom = new THREE.ConeGeometry(0.01, 0.08, 8);
  const tip = new THREE.Mesh(tipGeom, glassMat);
  tip.position.y = -0.05;
  tip.rotation.x = Math.PI;
  group.add(tip);
  
  return group;
}
```

## 3D Burette (for Titration)

```javascript
function createBurette(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Clamp stand (vertical rod)
  const rodGeom = new THREE.CylinderGeometry(0.02, 0.02, 2, 8);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
  const rod = new THREE.Mesh(rodGeom, rodMat);
  rod.position.y = 1;
  group.add(rod);
  
  // Base
  const baseGeom = new THREE.BoxGeometry(0.6, 0.05, 0.4);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  group.add(base);
  
  // Burette tube (long glass cylinder)
  const tubeGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 16, 1, true);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    side: THREE.DoubleSide,
  });
  const tube = new THREE.Mesh(tubeGeom, glassMat);
  tube.position.y = 1.3;
  group.add(tube);
  
  // Tap (stopcock)
  const tapGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8);
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });
  const tap = new THREE.Mesh(tapGeom, tapMat);
  tap.position.y = 0.55;
  tap.rotation.z = Math.PI / 2;
  group.add(tap);
  
  return { group, liquid: null, tapOpen: false };
}
```

## 3D Conical Flask (Erlenmeyer)

```javascript
function createConicalFlask(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Flask body (trapezoid shape using lathe)
  const points = [];
  points.push(new THREE.Vector2(0.15, 0));      // bottom center
  points.push(new THREE.Vector2(0.5, 0));       // bottom edge
  points.push(new THREE.Vector2(0.5, 0.3));     // wide part
  points.push(new THREE.Vector2(0.15, 0.8));    // narrow neck
  points.push(new THREE.Vector2(0.15, 1.0));    // neck top
  
  const flaskGeom = new THREE.LatheGeometry(points, 32);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    side: THREE.DoubleSide,
    transmission: 0.9,
  });
  const flask = new THREE.Mesh(flaskGeom, glassMat);
  group.add(flask);
  
  return { group, liquid: null };
}
```

## 3D Molecule Builder

```javascript
const ATOM_COLORS = {
  H: 0xffffff, C: 0x909090, N: 0x3050f8, O: 0xff0d0d,
  S: 0xffff30, P: 0xff8000, Cl: 0x1ff01f, Na: 0xab5cf2,
  Fe: 0xe06633, Cu: 0xc88033, Zn: 0x7d80b0, Ca: 0x3dff00,
};

function createAtom(element, position, radius = 0.3) {
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color: ATOM_COLORS[element] || 0xff00ff,
    shininess: 80,
    specular: 0x444444,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.userData = { element };
  return mesh;
}

function createBond(start, end, radius = 0.05) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  const material = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 40 });
  const mesh = new THREE.Mesh(geometry, material);
  
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  
  return mesh;
}

// Example: Water molecule H₂O
function createWaterMolecule(position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  const o = createAtom('O', [0, 0, 0], 0.35);
  const angle = 104.5 * Math.PI / 180;
  const bondLen = 0.8;
  const h1 = createAtom('H', [bondLen * Math.sin(angle/2), bondLen * Math.cos(angle/2), 0], 0.25);
  const h2 = createAtom('H', [-bondLen * Math.sin(angle/2), bondLen * Math.cos(angle/2), 0], 0.25);
  
  group.add(o, h1, h2);
  group.add(createBond(o.position, h1.position));
  group.add(createBond(o.position, h2.position));
  
  return group;
}
```

## Lighting Setup for Lab Scene

```javascript
function setupLabLighting(scene) {
  // Ambient (soft fill)
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  
  // Hemisphere (natural sky/ground)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  
  // Main directional (sun)
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 10, 5);
  scene.add(dir);
  
  // Fill light (opposite side)
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-5, 5, -5);
  scene.add(fill);
  
  // Rim light (back edge)
  const rim = new THREE.DirectionalLight(0xffffff, 0.2);
  rim.position.set(0, 5, -10);
  scene.add(rim);
}
```

## Lab Bench / Table

```javascript
function createLabBench(position = [0, -0.5, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  
  // Table top (wood)
  const topGeom = new THREE.BoxGeometry(4, 0.1, 2);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.1,
  });
  const top = new THREE.Mesh(topGeom, topMat);
  top.position.y = 0;
  group.add(top);
  
  // Edge highlight
  const edgeGeom = new THREE.BoxGeometry(4.02, 0.02, 2.02);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.6 });
  const edge = new THREE.Mesh(edgeGeom, edgeMat);
  edge.position.y = 0.06;
  group.add(edge);
  
  // Legs
  const legGeom = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
  const positions = [[-1.8, -0.5, -0.8], [1.8, -0.5, -0.8], [-1.8, -0.5, 0.8], [1.8, -0.5, 0.8]];
  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(...pos);
    group.add(leg);
  });
  
  return group;
}
```

## Key Design Rules
1. All lab equipment uses `MeshPhysicalMaterial` for realistic glass/liquid
2. Glass is transparent with low opacity (0.1-0.2) and high transmission
3. Liquids are semi-transparent (0.5-0.7 opacity) with the chemical color
4. Metal parts use `metalness: 0.5-0.8` for shiny appearance
5. Flames use `MeshBasicMaterial` (emissive, not affected by lighting)
6. Point lights near flames for realistic illumination
7. OrbitControls for camera manipulation
8. Shadows disabled for performance (lab scenes are complex)
9. All objects scale cleanly with `scale.setScalar()`
10. dispose() geometries and materials when removing objects
