import type { AcademicQueryable } from './schema';

/**
 * The practice item bank — Slice 6.
 *
 * Partial by design. The curriculum holds roughly 148 topics and only 21 have any authored
 * content, so writing a full bank is a content project, not a slice. v1 covers Mathematics and
 * Science; the drill page only offers topics that have items, and everything else still
 * resolves through Slice 5's coverage signal.
 *
 * Ids are deterministic (`pi-<topic>-<n>`) so re-seeding is a no-op rather than a duplication.
 */

interface PracticeItemSeed {
  topicId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

const BANK: PracticeItemSeed[] = [
  // ── Standard 1 Mathematics ──
  {
    topicId: 'std1-math-1',
    prompt: 'Which number comes just after 9?',
    choices: ['8', '10', '11', '19'],
    correctIndex: 1,
    explanation: 'Counting goes 7, 8, 9, 10 — so 10 comes straight after 9.',
  },
  {
    topicId: 'std1-math-1',
    prompt: 'How many tens are there in 30?',
    choices: ['3', '30', '13', '0'],
    correctIndex: 0,
    explanation: '30 is three groups of ten.',
  },
  {
    topicId: 'std1-math-2',
    prompt: 'What is 5 + 3?',
    choices: ['7', '8', '9', '53'],
    correctIndex: 1,
    explanation: '5 plus 3 makes 8.',
  },
  {
    topicId: 'std1-math-2',
    prompt: 'What is 10 − 4?',
    choices: ['4', '5', '6', '14'],
    correctIndex: 2,
    explanation: 'Taking 4 away from 10 leaves 6.',
  },
  {
    topicId: 'std1-math-3',
    prompt: 'Which shape has three sides?',
    choices: ['Square', 'Circle', 'Triangle', 'Rectangle'],
    correctIndex: 2,
    explanation: 'A triangle has three straight sides and three corners.',
  },
  {
    topicId: 'std1-math-3',
    prompt: 'What comes next: circle, square, circle, square, …?',
    choices: ['square', 'circle', 'triangle', 'rectangle'],
    correctIndex: 1,
    explanation: 'The pattern repeats circle then square, so a circle comes next.',
  },

  // ── Standard 2 Mathematics ──
  {
    topicId: 'std2-math-1',
    prompt: 'Which is the biggest number?',
    choices: ['999', '1000', '100', '99'],
    correctIndex: 1,
    explanation: '1000 is one more than 999, so it is the largest.',
  },
  {
    topicId: 'std2-math-1',
    prompt: 'Write 507 in words.',
    choices: [
      'Five hundred and seven',
      'Five thousand and seven',
      'Fifty-seven',
      'Five hundred and seventy',
    ],
    correctIndex: 0,
    explanation: '507 is 5 hundreds, 0 tens and 7 ones — five hundred and seven.',
  },
  {
    topicId: 'std2-math-2',
    prompt: 'What is 4 × 3?',
    choices: ['7', '12', '9', '16'],
    correctIndex: 1,
    explanation: '4 groups of 3 is 12.',
  },
  {
    topicId: 'std2-math-2',
    prompt: 'What is 6 × 10?',
    choices: ['16', '60', '610', '6'],
    correctIndex: 1,
    explanation: 'Multiplying by 10 adds a zero: 6 × 10 = 60.',
  },
  {
    topicId: 'std2-math-3',
    prompt: 'How many centimetres are in one metre?',
    choices: ['10', '100', '1000', '60'],
    correctIndex: 1,
    explanation: 'One metre is 100 centimetres.',
  },
  {
    topicId: 'std2-math-3',
    prompt: 'Which unit would you use to measure the weight of a bag of maize?',
    choices: ['Centimetre', 'Kilogram', 'Litre', 'Second'],
    correctIndex: 1,
    explanation: 'Weight is measured in kilograms; litres measure volume.',
  },

  // ── Standard 3 Mathematics ──
  {
    topicId: 'std3-math-1',
    prompt: 'What is 7 × 8?',
    choices: ['54', '56', '63', '48'],
    correctIndex: 1,
    explanation: '7 eights are 56.',
  },
  {
    topicId: 'std3-math-1',
    prompt: 'What is 9 × 9?',
    choices: ['81', '72', '99', '18'],
    correctIndex: 0,
    explanation: '9 nines are 81.',
  },
  {
    topicId: 'std3-math-2',
    prompt: 'What is 24 ÷ 6?',
    choices: ['3', '4', '6', '8'],
    correctIndex: 1,
    explanation: '6 goes into 24 four times.',
  },
  {
    topicId: 'std3-math-2',
    prompt: 'What is 35 ÷ 5?',
    choices: ['5', '6', '7', '9'],
    correctIndex: 2,
    explanation: '5 goes into 35 seven times.',
  },
  {
    topicId: 'std3-math-3',
    prompt: 'Which fraction is bigger, 1/2 or 1/4?',
    choices: ['1/2', '1/4', 'They are equal', 'It depends'],
    correctIndex: 0,
    explanation: 'Halves are bigger than quarters — 1/2 is two quarters.',
  },
  {
    topicId: 'std3-math-3',
    prompt: 'What is 1/2 of 12?',
    choices: ['3', '4', '6', '12'],
    correctIndex: 2,
    explanation: 'Half of 12 is 6.',
  },

  // ── Standard 4 Mathematics ──
  {
    topicId: 'std4-math-1',
    prompt: 'What is 23 × 4?',
    choices: ['82', '92', '94', '86'],
    correctIndex: 1,
    explanation: '20 × 4 = 80 and 3 × 4 = 12, so 80 + 12 = 92.',
  },
  {
    topicId: 'std4-math-1',
    prompt: 'What is 15 × 12?',
    choices: ['150', '170', '180', '125'],
    correctIndex: 2,
    explanation: '15 × 10 = 150 and 15 × 2 = 30, so 150 + 30 = 180.',
  },
  {
    topicId: 'std4-math-2',
    prompt: 'Which is the largest decimal?',
    choices: ['0.5', '0.05', '0.55', '0.055'],
    correctIndex: 2,
    explanation: '0.55 is fifty-five hundredths, which is more than 0.5.',
  },
  {
    topicId: 'std4-math-2',
    prompt: 'What is 0.7 written as a fraction?',
    choices: ['7/100', '7/10', '70/10', '1/7'],
    correctIndex: 1,
    explanation: '0.7 means seven tenths, or 7/10.',
  },
  {
    topicId: 'std4-math-3',
    prompt: 'How many degrees are in a right angle?',
    choices: ['45°', '90°', '180°', '360°'],
    correctIndex: 1,
    explanation: 'A right angle is exactly 90 degrees.',
  },
  {
    topicId: 'std4-math-3',
    prompt: 'A shape with four equal sides and four right angles is a…',
    choices: ['Rectangle', 'Square', 'Rhombus', 'Trapezium'],
    correctIndex: 1,
    explanation: 'A square has four equal sides and four right angles.',
  },

  // ── Standard 5 Mathematics ──
  {
    topicId: 'std5-math-1',
    prompt: 'What is 20% of 80?',
    choices: ['8', '16', '20', '4'],
    correctIndex: 1,
    explanation: '10% of 80 is 8, so 20% is 16.',
  },
  {
    topicId: 'std5-math-1',
    prompt: 'A shop reduces a 20000 TZS price by 10%. What is the new price?',
    choices: ['19000 TZS', '18000 TZS', '10000 TZS', '18200 TZS'],
    correctIndex: 1,
    explanation: '10% of 20000 is 2000, so the new price is 18000 TZS.',
  },
  {
    topicId: 'std5-math-2',
    prompt: 'What is the area of a rectangle 6 cm by 4 cm?',
    choices: ['10 cm²', '20 cm²', '24 cm²', '48 cm²'],
    correctIndex: 2,
    explanation: 'Area is length × width: 6 × 4 = 24 cm².',
  },
  {
    topicId: 'std5-math-2',
    prompt: 'What is the perimeter of a square with side 5 cm?',
    choices: ['10 cm', '15 cm', '20 cm', '25 cm'],
    correctIndex: 2,
    explanation: 'A square has four equal sides: 4 × 5 = 20 cm.',
  },

  // ── Standard 6 Mathematics ──
  {
    topicId: 'std6-math-1',
    prompt: 'If x + 5 = 12, what is x?',
    choices: ['5', '7', '12', '17'],
    correctIndex: 1,
    explanation: 'Subtract 5 from both sides: x = 12 − 5 = 7.',
  },
  {
    topicId: 'std6-math-1',
    prompt: 'Simplify: 3a + 2a.',
    choices: ['5a', '6a', '5a²', 'a'],
    correctIndex: 0,
    explanation: 'Add the coefficients: 3 + 2 = 5, so 5a.',
  },
  {
    topicId: 'std6-math-2',
    prompt: 'What is the mean of 2, 4, 6?',
    choices: ['3', '4', '6', '12'],
    correctIndex: 1,
    explanation: 'Sum is 12 across 3 values, so the mean is 4.',
  },
  {
    topicId: 'std6-math-2',
    prompt: 'In the set 3, 7, 7, 10, what is the mode?',
    choices: ['3', '7', '10', 'There is none'],
    correctIndex: 1,
    explanation: 'The mode is the most frequent value: 7 appears twice.',
  },

  // ── Standard 7 Mathematics ──
  {
    topicId: 'std7-math-1',
    prompt: 'A book costs 5000 TZS. How much do 3 books cost?',
    choices: ['12000 TZS', '15000 TZS', '5000 TZS', '2000 TZS'],
    correctIndex: 1,
    explanation: '3 × 5000 = 15000 TZS.',
  },
  {
    topicId: 'std7-math-1',
    prompt: 'A journey of 120 km takes 3 hours. What is the average speed?',
    choices: ['30 km/h', '40 km/h', '60 km/h', '360 km/h'],
    correctIndex: 1,
    explanation: 'Speed = distance ÷ time = 120 ÷ 3 = 40 km/h.',
  },
  {
    topicId: 'std7-math-2',
    prompt: 'What are the coordinates of the origin?',
    choices: ['(1, 1)', '(0, 0)', '(0, 1)', '(1, 0)'],
    correctIndex: 1,
    explanation: 'The origin is where the axes cross: (0, 0).',
  },
  {
    topicId: 'std7-math-2',
    prompt: 'Which point lies on the x-axis?',
    choices: ['(0, 3)', '(3, 0)', '(3, 3)', '(0, 0)'],
    correctIndex: 1,
    explanation: 'On the x-axis the y-coordinate is 0, so (3, 0).',
  },

  // ── Standard 3 Science ──
  {
    topicId: 'std3-science-1',
    prompt: 'Which of these is a living thing?',
    choices: ['Stone', 'Mango tree', 'Bicycle', 'River'],
    correctIndex: 1,
    explanation: 'A mango tree grows, feeds and reproduces, so it is living.',
  },
  {
    topicId: 'std3-science-1',
    prompt: 'What do plants need to make their own food?',
    choices: ['Sunlight only', 'Sunlight, water and air', 'Water only', 'Soil only'],
    correctIndex: 1,
    explanation: 'Plants use sunlight, water and carbon dioxide from the air.',
  },
  {
    topicId: 'std3-science-2',
    prompt: 'What do we call water falling from clouds?',
    choices: ['Clouds', 'Rain', 'Wind', 'Fog'],
    correctIndex: 1,
    explanation: 'Rain is water droplets falling from clouds.',
  },
  {
    topicId: 'std3-science-2',
    prompt: 'Which instrument measures temperature?',
    choices: ['Barometer', 'Thermometer', 'Ruler', 'Clock'],
    correctIndex: 1,
    explanation: 'A thermometer measures how hot or cold something is.',
  },

  // ── Standard 7 Science ──
  {
    topicId: 'std7-science-1',
    prompt: 'Which organ pumps blood around the body?',
    choices: ['Liver', 'Heart', 'Lungs', 'Kidney'],
    correctIndex: 1,
    explanation: 'The heart pumps blood through the blood vessels.',
  },
  {
    topicId: 'std7-science-1',
    prompt: 'Where does digestion mainly begin?',
    choices: ['Stomach', 'Mouth', 'Small intestine', 'Liver'],
    correctIndex: 1,
    explanation: 'Digestion begins in the mouth, where teeth and saliva start breaking food down.',
  },
  {
    topicId: 'std7-science-2',
    prompt: 'Which of these helps conserve the environment?',
    choices: ['Burning rubbish', 'Planting trees', 'Cutting all trees', 'Littering'],
    correctIndex: 1,
    explanation: 'Planting trees restores cover, holds soil and absorbs carbon dioxide.',
  },
  {
    topicId: 'std7-science-2',
    prompt: 'What is the main cause of soil erosion?',
    choices: ['Planting trees', 'Removing vegetation', 'Rainwater harvesting', 'Terracing'],
    correctIndex: 1,
    explanation: 'Without roots to hold it, soil is washed or blown away.',
  },

  // ── Form 1 Mathematics ──
  {
    topicId: 'f1-math-1',
    prompt: 'Which of these is an integer?',
    choices: ['1/2', '−3', '0.75', '√2'],
    correctIndex: 1,
    explanation: 'Integers are whole numbers including negatives, so −3 qualifies.',
  },
  {
    topicId: 'f1-math-1',
    prompt: 'What is |−7|?',
    choices: ['−7', '7', '0', '−1'],
    correctIndex: 1,
    explanation: 'Absolute value is distance from zero, always positive: 7.',
  },
  {
    topicId: 'f1-math-2',
    prompt: 'Simplify: 4x + 3y − x.',
    choices: ['3x + 3y', '4x + 2y', '7xy', '3x − 3y'],
    correctIndex: 0,
    explanation: '4x − x = 3x, and 3y stays as it is.',
  },
  {
    topicId: 'f1-math-2',
    prompt: 'Expand: 2(a + 5).',
    choices: ['2a + 5', '2a + 10', '10a', 'a + 10'],
    correctIndex: 1,
    explanation: 'Multiply both terms inside: 2 × a + 2 × 5 = 2a + 10.',
  },
  {
    topicId: 'f1-math-3',
    prompt: 'Solve: 2x + 3 = 11.',
    choices: ['x = 3', 'x = 4', 'x = 5', 'x = 7'],
    correctIndex: 1,
    explanation: '2x = 8, so x = 4.',
  },
  {
    topicId: 'f1-math-3',
    prompt: 'Solve: 5x − 2 = 3x + 6.',
    choices: ['x = 2', 'x = 4', 'x = 6', 'x = 8'],
    correctIndex: 1,
    explanation: '2x = 8, so x = 4.',
  },
  {
    topicId: 'f1-math-4',
    prompt: 'What is the sum of angles in a triangle?',
    choices: ['90°', '180°', '270°', '360°'],
    correctIndex: 1,
    explanation: 'The three interior angles of any triangle add to 180°.',
  },
  {
    topicId: 'f1-math-4',
    prompt: 'A triangle with two equal sides is called…',
    choices: ['Scalene', 'Isosceles', 'Equilateral', 'Right-angled'],
    correctIndex: 1,
    explanation: 'Isosceles triangles have two equal sides and two equal angles.',
  },

  // ── Form 2 Mathematics ──
  {
    topicId: 'f2-math-1',
    prompt: 'Solve: x + y = 10 and x − y = 2.',
    choices: ['x = 4, y = 6', 'x = 6, y = 4', 'x = 5, y = 5', 'x = 8, y = 2'],
    correctIndex: 1,
    explanation: 'Adding gives 2x = 12 so x = 6, and then y = 4.',
  },
  {
    topicId: 'f2-math-1',
    prompt: 'Solve: 2x + y = 7 and x − y = 2.',
    choices: ['x = 3, y = 1', 'x = 2, y = 3', 'x = 1, y = 5', 'x = 4, y = −1'],
    correctIndex: 0,
    explanation: 'Adding gives 3x = 9 so x = 3, and y = 1.',
  },
  {
    topicId: 'f2-math-2',
    prompt: 'Factorise: x² − 9.',
    choices: ['(x − 3)²', '(x + 3)(x − 3)', '(x + 9)(x − 1)', 'x(x − 9)'],
    correctIndex: 1,
    explanation: 'This is a difference of two squares: x² − 3².',
  },
  {
    topicId: 'f2-math-2',
    prompt: 'Solve: x² − 5x + 6 = 0.',
    choices: ['x = 1 or 6', 'x = 2 or 3', 'x = −2 or −3', 'x = 5 or 6'],
    correctIndex: 1,
    explanation: 'Factorising gives (x − 2)(x − 3) = 0.',
  },
  {
    topicId: 'f2-math-3',
    prompt: 'What is the order of a matrix with 2 rows and 3 columns?',
    choices: ['2 × 3', '3 × 2', '6', '5'],
    correctIndex: 0,
    explanation: 'Order is written rows × columns, so 2 × 3.',
  },
  {
    topicId: 'f2-math-3',
    prompt: 'Can a 2 × 3 matrix be added to a 2 × 2 matrix?',
    choices: ['Yes, always', 'No — orders must match', 'Yes, if numbers are small', 'Only for square matrices'],
    correctIndex: 1,
    explanation: 'Matrices can only be added when they have the same order.',
  },
  {
    topicId: 'f2-math-4',
    prompt: 'If A = {1, 2} and B = {2, 3}, what is A ∩ B?',
    choices: ['{1, 2, 3}', '{2}', '{1, 3}', '{}'],
    correctIndex: 1,
    explanation: 'The intersection is what both sets share: 2.',
  },
  {
    topicId: 'f2-math-4',
    prompt: 'If A = {1, 2} and B = {2, 3}, what is A ∪ B?',
    choices: ['{2}', '{1, 2, 3}', '{1, 3}', '{}'],
    correctIndex: 1,
    explanation: 'The union collects everything in either set.',
  },

  // ── Form 1 Physics ──
  {
    topicId: 'f1-phy-1',
    prompt: 'What is the SI unit of length?',
    choices: ['Centimetre', 'Metre', 'Kilometre', 'Inch'],
    correctIndex: 1,
    explanation: 'The metre is the SI base unit of length.',
  },
  {
    topicId: 'f1-phy-1',
    prompt: 'What is the SI unit of mass?',
    choices: ['Gram', 'Kilogram', 'Newton', 'Tonne'],
    correctIndex: 1,
    explanation: 'The kilogram is the SI base unit of mass; the newton is force.',
  },
  {
    topicId: 'f1-phy-2',
    prompt: 'What is the SI unit of force?',
    choices: ['Joule', 'Watt', 'Newton', 'Pascal'],
    correctIndex: 2,
    explanation: 'Force is measured in newtons.',
  },
  {
    topicId: 'f1-phy-2',
    prompt: 'A 2 kg mass has what weight approximately? (g ≈ 10 N/kg)',
    choices: ['2 N', '10 N', '20 N', '0.2 N'],
    correctIndex: 2,
    explanation: 'Weight = mg = 2 × 10 = 20 N.',
  },
  {
    topicId: 'f1-phy-3',
    prompt: 'What is the SI unit of energy?',
    choices: ['Watt', 'Joule', 'Newton', 'Volt'],
    correctIndex: 1,
    explanation: 'Energy is measured in joules; the watt is power.',
  },
  {
    topicId: 'f1-phy-3',
    prompt: 'Which is a renewable energy source?',
    choices: ['Coal', 'Petrol', 'Solar', 'Natural gas'],
    correctIndex: 2,
    explanation: 'Solar energy is replenished naturally; the others are finite fuels.',
  },
];

/** Rows inserted per call, for logging. */
export async function seedPracticeItems(queryable: AcademicQueryable): Promise<number> {
  let inserted = 0;

  const perTopic = new Map<string, number>();
  for (const item of BANK) {
    const index = (perTopic.get(item.topicId) ?? 0) + 1;
    perTopic.set(item.topicId, index);

    const result = await queryable.query(
      `INSERT INTO academic_practice_items
         (id, topic_id, prompt, choices, correct_index, explanation, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        `pi-${item.topicId}-${index}`,
        item.topicId,
        item.prompt,
        JSON.stringify(item.choices),
        item.correctIndex,
        item.explanation,
        index,
      ],
    );

    inserted += (result as { rows?: unknown[] }).rows?.length ?? 0;
  }

  return inserted;
}
