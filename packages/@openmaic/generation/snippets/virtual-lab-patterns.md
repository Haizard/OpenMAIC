# Virtual Science Lab Patterns (from React Three Fiber + Matter.js project)

These patterns were extracted from the Virtual Science Lab project (MIT license, React 18 + Three.js + Matter.js + Google Gemini AI).

## 3D Lab Equipment Patterns (React Three Fiber)

### Beaker Rendering
```tsx
// Glass beaker with transparent material
<mesh>
  <cylinderGeometry args={[1, 1, 3, 16, 1, true]} />
  <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} />
</mesh>

// Liquid fill (dynamic height based on liquidLevel)
<mesh position={[0, -1.5 + liquidLevel, 0]}>
  <cylinderGeometry args={[0.95, 0.95, Math.max(liquidLevel * 2, 0.01), 16]} />
  <meshStandardMaterial color={liquidColor} transparent opacity={0.8} side={THREE.DoubleSide} />
</mesh>

// Base/stand
<mesh position={[0, -1.55, 0]}>
  <cylinderGeometry args={[1, 1, 0.1, 32]} />
  <meshStandardMaterial color="#cccccc" />
</mesh>
```

### Bubble Animation
```tsx
// 10 random bubbles with upward animation
{[...Array(10)].map((_, i) => (
  <mesh key={i} position={[Math.random() * 0.6 - 0.3, Math.random() * 2, Math.random() * 0.6 - 0.3]}>
    <sphereGeometry args={[0.05 + Math.random() * 0.05, 16, 16]} />
    <meshPhysicalMaterial color="#ffffff" transparent opacity={0.8} roughness={0.1} />
  </mesh>
))}

// Animation loop
useFrame(() => {
  bubblesRef.current.children.forEach((bubble) => {
    bubble.position.y += 0.02;
    if (bubble.position.y > 2) bubble.position.y = 0.5;
  });
});
```

### Fire Particle System
```tsx
// Fire particles with chemical-specific colors
const getFireColor = (chemicalName?: string) => {
  switch (chemicalName?.toLowerCase()) {
    case 'methane':  return { base: [1, 0.2, 0], tip: [1, 1, 0.3] }; // Blue-tipped
    case 'hydrogen': return { base: [1, 0.8, 0], tip: [1, 1, 1] };   // White flame
    case 'sodium':   return { base: [1, 0.3, 0], tip: [1, 1, 0] };   // Yellow flame
    default:         return { base: [1, 0.3, 0], tip: [1, 0.8, 0] }; // Orange flame
  }
};

// Particle system with physics
const particleCount = Math.min(Math.floor(intensity * 15), 100);
// Each particle: position, color (interpolated base→tip), velocity, lifetime
```

### Robot Assistant (Animated Character)
```tsx
// Head animation based on action
switch (action) {
  case 'observing':  head.rotation.y = Math.sin(time * 0.5) * 0.3; break;
  case 'celebrating': head.rotation.z = Math.sin(time * 8) * 0.2; break;
  case 'reacting':   head.position.y = 0.8 + Math.sin(time * 10) * 0.05; break;
  default:           head.rotation.y = Math.sin(time * 0.3) * 0.1; // idle
}

// Arm animation based on action
switch (action) {
  case 'pouring':    rightArm.rotation.x = Math.sin(time * 2) * 0.3 - 0.5; break;
  case 'celebrating': leftArm.rotation.z = Math.sin(time * 4) * 0.5 - 0.5; break;
  case 'running':    leftArm.rotation.z = Math.sin(time * 8) * 0.5 - 0.3; break;
}
```

### 3D Flowchart for Reactions
```tsx
// Animated chemical node with floating + rotation
<mesh ref={meshRef}>
  <sphereGeometry args={[0.3, 32, 32]} />
  <meshStandardMaterial color={chemical.color} metalness={0.3} roughness={0.4} />
</mesh>
// Glow effect
<mesh>
  <sphereGeometry args={[0.35, 16, 16]} />
  <meshBasicMaterial color={chemical.color} transparent opacity={0.3} />
</mesh>
// Label
<Text position={[0, -0.6, 0]} fontSize={0.15} color="#ffffff">
  {chemical.name}
</Text>
```

## Chemistry Reaction System

### Chemical Data Structure
```typescript
interface Chemical {
  id: string;
  name: string;
  formula: string;      // e.g., 'H₂O', 'CH₃COOH'
  color: string;        // hex color for 3D rendering
  state: 'solid' | 'liquid' | 'gas';
  pH?: number;
  flammable?: boolean;
  flammabilityLevel?: number; // 0-10 scale
}

// Example chemicals
const CHEMICALS = [
  { id: 'water', name: 'Water', formula: 'H₂O', color: '#00aaff', state: 'liquid', pH: 7 },
  { id: 'vinegar', name: 'Vinegar', formula: 'CH₃COOH', color: '#ffeeaa', state: 'liquid', pH: 3 },
  { id: 'baking-soda', name: 'Baking Soda', formula: 'NaHCO₃', color: '#ffffff', state: 'solid', pH: 9 },
  { id: 'ethanol', name: 'Ethanol', formula: 'C₂H₅OH', color: '#e6f3ff', state: 'liquid', flammable: true, flammabilityLevel: 8 },
];
```

### Reaction Data Structure
```typescript
interface Reaction {
  reactants: string[];     // chemical IDs
  products: string[];      // product names
  product: { name: string; formula: string };
  description: string;     // human-readable explanation
  visualization: 'bubbles' | 'color-change' | 'heat' | 'precipitate';
}

const REACTIONS = [
  {
    reactants: ['vinegar', 'baking-soda'],
    products: ['CO₂', 'H₂O', 'CH₃COONa'],
    product: { name: 'Sodium Acetate, Water, and Carbon Dioxide', formula: 'CH₃COONa + H₂O + CO₂' },
    description: 'Vinegar + Baking Soda → Fizzing reaction! Carbon dioxide gas is produced.',
    visualization: 'bubbles'
  },
  {
    reactants: ['water', 'salt'],
    products: ['NaCl solution'],
    product: { name: 'Sodium Chloride Solution', formula: 'NaCl(aq)' },
    description: 'Salt dissolves in water, creating a saline solution.',
    visualization: 'color-change'
  },
];
```

## Physics Engine Patterns (Matter.js + Three.js)

### 3D Physics Objects
```tsx
// Ball with physics
const PhysicsBall = ({ position, color, size, mass, restitution }) => {
  const [ref] = useSphere(() => ({
    mass, position, args: [size],
    material: { restitution },
  }));
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

// Box with physics
const PhysicsBox = ({ position, color, size, mass, restitution }) => {
  const [ref] = useBox(() => ({
    mass, position, args: size,
    material: { restitution },
  }));
  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

// Ground plane
const Ground = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    type: 'Static',
  }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#e8e8e8" />
    </mesh>
  );
};
```

### Gravity Presets
```typescript
const GRAVITY_PRESETS = {
  earth: 9.81,
  moon: 1.62,
  mars: 3.72,
  jupiter: 24.79,
  zeroG: 0,
};
```

## AI Assistant Patterns

### Context-Aware Responses
- Lab type detection (chemistry vs physics)
- Current experiment state awareness
- Quick question prompts for getting started
- Educational explanations in simple terms
- Rate limiting and token management

### Chat History
- Auto-save to database (Appwrite)
- Searchable conversation archive
- Context tags for each chat
- Delete individual chats or clear all

## UI Layout Patterns

### Chemistry Lab Layout
```
┌─────────────────────────────────────────────┐
│  Header: "Chemistry Lab"                     │
├─────────────────────────────────────────────┤
│                                              │
│   3D SCENE (Canvas)                          │
│   ─ Beaker with liquid                       │
│   ─ Robot assistant                          │
│   ─ OrbitControls for camera                 │
│                                              │
├─────────────────────────────────────────────┤
│  CHEMICAL SELECTION                          │
│   [Water] [Vinegar] [Baking Soda] [Salt]    │
│   [Sugar] [Lemon Juice] [Ethanol] [Methane] │
├─────────────────────────────────────────────┤
│  REACTION RESULT                             │
│   "Vinegar + Baking Soda → CO₂ + H₂O"       │
│   [Visualize] [Ask AI]                       │
└─────────────────────────────────────────────┘
```

### Physics Lab Layout
```
┌─────────────────────────────────────────────┐
│  Header: "Physics Lab"                       │
├─────────────────────────────────────────────┤
│                                              │
│   3D SCENE (Canvas)                          │
│   ─ Ground plane                             │
│   ─ Drop objects (balls, boxes)              │
│   ─ OrbitControls for camera                 │
│                                              │
├─────────────────────────────────────────────┤
│  CONTROLS                                    │
│   Gravity: [Slider 0-3g]                     │
│   Preset: [Earth] [Moon] [Mars] [Jupiter]   │
│   [Drop Ball] [Drop Box] [Reset]             │
├─────────────────────────────────────────────┤
│  STATS                                       │
│   Objects: 5 | Kinetic: 12.3J | Total: 45.6J│
└─────────────────────────────────────────────┘
```

## Key Takeaways for OpenMAIC

1. **3D beaker rendering** is straightforward with Three.js cylinderGeometry + transparent materials
2. **Bubble animation** uses simple upward translation with random reset
3. **Fire particles** use point systems with chemical-specific color interpolation
4. **Robot assistant** adds personality with action-based animations
5. **Reaction system** uses simple ID matching between reactants
6. **Physics engine** integrates Matter.js via @react-three/cannon
7. **AI assistant** provides context-aware educational explanations
8. **Flowchart visualization** shows reaction steps as animated 3D nodes
