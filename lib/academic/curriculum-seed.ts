import type { AcademicQueryable } from './schema';

interface CurriculumLevel {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  forms: CurriculumForm[];
}

interface CurriculumForm {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  subjects: CurriculumSubject[];
}

interface CurriculumSubject {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  topics: CurriculumTopic[];
}

interface CurriculumTopic {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

// Tanzania National Curriculum Structure
const CURRICULUM_DATA: CurriculumLevel[] = [
  // ── PRIMARY LEVEL ──
  {
    id: 'primary',
    name: 'Primary Education',
    slug: 'primary',
    description: 'Standard 1-7 (Ages 7-14)',
    sortOrder: 1,
    forms: [
      {
        id: 'std1',
        name: 'Standard 1',
        slug: 'standard-1',
        sortOrder: 1,
        subjects: [
          {
            id: 'std1-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Basic arithmetic, counting, shapes',
            sortOrder: 1,
            topics: [
              {
                id: 'std1-math-1',
                name: 'Counting and Numbers',
                slug: 'counting-and-numbers',
                description: 'Counting from 1-100, number recognition',
                sortOrder: 1,
              },
              {
                id: 'std1-math-2',
                name: 'Addition and Subtraction',
                slug: 'addition-and-subtraction',
                description: 'Basic addition and subtraction within 20',
                sortOrder: 2,
              },
              {
                id: 'std1-math-3',
                name: 'Shapes and Patterns',
                slug: 'shapes-and-patterns',
                description: 'Identifying basic shapes and simple patterns',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'std1-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'Basic English reading and writing',
            sortOrder: 2,
            topics: [
              {
                id: 'std1-eng-1',
                name: 'The Alphabet',
                slug: 'the-alphabet',
                description: 'Letter recognition and sounds',
                sortOrder: 1,
              },
              {
                id: 'std1-eng-2',
                name: 'Simple Words',
                slug: 'simple-words',
                description: 'Reading and writing simple words',
                sortOrder: 2,
              },
              {
                id: 'std1-eng-3',
                name: 'Simple Sentences',
                slug: 'simple-sentences',
                description: 'Forming basic sentences',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'std1-kis',
            name: 'Kiswahili',
            slug: 'kiswahili',
            description: 'Basic Kiswahili language',
            sortOrder: 3,
            topics: [
              {
                id: 'std1-kis-1',
                name: 'Herufi za Kiswahili',
                slug: 'herufi-za-kiswahili',
                description: 'Swahili alphabet and letters',
                sortOrder: 1,
              },
              {
                id: 'std1-kis-2',
                name: 'Maneno ya Msingi',
                slug: 'maneno-ya-msingi',
                description: 'Basic Swahili words',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'std2',
        name: 'Standard 2',
        slug: 'standard-2',
        sortOrder: 2,
        subjects: [
          {
            id: 'std2-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Building on basic arithmetic',
            sortOrder: 1,
            topics: [
              {
                id: 'std2-math-1',
                name: 'Numbers up to 1000',
                slug: 'numbers-up-to-1000',
                description: 'Counting and place value',
                sortOrder: 1,
              },
              {
                id: 'std2-math-2',
                name: 'Multiplication Basics',
                slug: 'multiplication-basics',
                description: 'Introduction to multiplication tables',
                sortOrder: 2,
              },
              {
                id: 'std2-math-3',
                name: 'Measurement',
                slug: 'measurement',
                description: 'Length, weight, and capacity basics',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'std2-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'Expanding English vocabulary',
            sortOrder: 2,
            topics: [
              {
                id: 'std2-eng-1',
                name: 'Reading Comprehension',
                slug: 'reading-comprehension',
                description: 'Understanding short passages',
                sortOrder: 1,
              },
              {
                id: 'std2-eng-2',
                name: 'Writing Skills',
                slug: 'writing-skills',
                description: 'Writing paragraphs',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'std2-kis',
            name: 'Kiswahili',
            slug: 'kiswahili',
            description: 'Kiswahili language development',
            sortOrder: 3,
            topics: [
              {
                id: 'std2-kis-1',
                name: 'Kusoma na Kuandika',
                slug: 'kusoma-na-kuandika',
                description: 'Reading and writing in Swahili',
                sortOrder: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'std3',
        name: 'Standard 3',
        slug: 'standard-3',
        sortOrder: 3,
        subjects: [
          {
            id: 'std3-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Intermediate arithmetic',
            sortOrder: 1,
            topics: [
              {
                id: 'std3-math-1',
                name: 'Multiplication Tables',
                slug: 'multiplication-tables',
                description: 'Mastering multiplication tables 1-12',
                sortOrder: 1,
              },
              {
                id: 'std3-math-2',
                name: 'Division',
                slug: 'division',
                description: 'Introduction to division',
                sortOrder: 2,
              },
              {
                id: 'std3-math-3',
                name: 'Fractions',
                slug: 'fractions',
                description: 'Understanding simple fractions',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'std3-science',
            name: 'Science',
            slug: 'science',
            description: 'Basic science concepts',
            sortOrder: 2,
            topics: [
              {
                id: 'std3-science-1',
                name: 'Living Things',
                slug: 'living-things',
                description: 'Plants and animals',
                sortOrder: 1,
              },
              {
                id: 'std3-science-2',
                name: 'Weather',
                slug: 'weather',
                description: 'Understanding weather patterns',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'std4',
        name: 'Standard 4',
        slug: 'standard-4',
        sortOrder: 4,
        subjects: [
          {
            id: 'std4-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Advanced primary arithmetic',
            sortOrder: 1,
            topics: [
              {
                id: 'std4-math-1',
                name: 'Long Multiplication',
                slug: 'long-multiplication',
                description: 'Multi-digit multiplication',
                sortOrder: 1,
              },
              {
                id: 'std4-math-2',
                name: 'Decimals',
                slug: 'decimals',
                description: 'Introduction to decimals',
                sortOrder: 2,
              },
              {
                id: 'std4-math-3',
                name: 'Geometry',
                slug: 'geometry',
                description: 'Angles and basic geometric properties',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'std4-civics',
            name: 'Civics',
            slug: 'civics',
            description: 'Tanzanian citizenship and governance',
            sortOrder: 2,
            topics: [
              {
                id: 'std4-civics-1',
                name: 'Rights and Duties',
                slug: 'rights-and-duties',
                description: 'Rights and responsibilities of citizens',
                sortOrder: 1,
              },
              {
                id: 'std4-civics-2',
                name: 'Local Government',
                slug: 'local-government',
                description: 'Understanding local governance',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'std5',
        name: 'Standard 5',
        slug: 'standard-5',
        sortOrder: 5,
        subjects: [
          {
            id: 'std5-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Pre-secondary mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'std5-math-1',
                name: 'Percentages',
                slug: 'percentages',
                description: 'Understanding and calculating percentages',
                sortOrder: 1,
              },
              {
                id: 'std5-math-2',
                name: 'Area and Perimeter',
                slug: 'area-and-perimeter',
                description: 'Calculating area and perimeter',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'std5-geography',
            name: 'Geography',
            slug: 'geography',
            description: 'Tanzanian and world geography',
            sortOrder: 2,
            topics: [
              {
                id: 'std5-geo-1',
                name: 'Map Reading',
                slug: 'map-reading',
                description: 'Basic map skills',
                sortOrder: 1,
              },
              {
                id: 'std5-geo-2',
                name: 'Tanzania Regions',
                slug: 'tanzania-regions',
                description: 'Geographic regions of Tanzania',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'std6',
        name: 'Standard 6',
        slug: 'standard-6',
        sortOrder: 6,
        subjects: [
          {
            id: 'std6-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Preparing for national exams',
            sortOrder: 1,
            topics: [
              {
                id: 'std6-math-1',
                name: 'Algebra Basics',
                slug: 'algebra-basics',
                description: 'Introduction to variables and expressions',
                sortOrder: 1,
              },
              {
                id: 'std6-math-2',
                name: 'Statistics',
                slug: 'statistics',
                description: 'Data collection and representation',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'std6-history',
            name: 'History',
            slug: 'history',
            description: 'Tanzanian and African history',
            sortOrder: 2,
            topics: [
              {
                id: 'std6-hist-1',
                name: 'Pre-Colonial Tanzania',
                slug: 'pre-colonial-tanzania',
                description: 'Early Tanzanian societies',
                sortOrder: 1,
              },
              {
                id: 'std6-hist-2',
                name: 'Colonial Period',
                slug: 'colonial-period',
                description: 'German and British colonialism',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'std7',
        name: 'Standard 7',
        slug: 'standard-7',
        sortOrder: 7,
        subjects: [
          {
            id: 'std7-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Final primary review',
            sortOrder: 1,
            topics: [
              {
                id: 'std7-math-1',
                name: 'Problem Solving',
                slug: 'problem-solving',
                description: 'Multi-step word problems',
                sortOrder: 1,
              },
              {
                id: 'std7-math-2',
                name: 'Coordinate Geometry',
                slug: 'coordinate-geometry',
                description: 'Plotting points on a grid',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'std7-science',
            name: 'Science',
            slug: 'science',
            description: 'Comprehensive primary science',
            sortOrder: 2,
            topics: [
              {
                id: 'std7-science-1',
                name: 'Human Body',
                slug: 'human-body',
                description: 'Major body systems',
                sortOrder: 1,
              },
              {
                id: 'std7-science-2',
                name: 'Environmental Conservation',
                slug: 'environmental-conservation',
                description: 'Protecting natural resources',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'std7-civics',
            name: 'Civics',
            slug: 'civics',
            description: 'Advanced civic education',
            sortOrder: 3,
            topics: [
              {
                id: 'std7-civics-1',
                name: 'Democracy',
                slug: 'democracy',
                description: 'Principles of democracy',
                sortOrder: 1,
              },
              {
                id: 'std7-civics-2',
                name: 'National Symbols',
                slug: 'national-symbols',
                description: 'Tanzania national identity',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── SECONDARY LEVEL ──
  {
    id: 'secondary',
    name: 'Secondary Education',
    slug: 'secondary',
    description: 'Form 1-4 (Ages 15-18)',
    sortOrder: 2,
    forms: [
      {
        id: 'form1',
        name: 'Form 1',
        slug: 'form-1',
        sortOrder: 1,
        subjects: [
          {
            id: 'f1-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Secondary mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f1-math-1',
                name: 'Real Numbers',
                slug: 'real-numbers',
                description: 'Integers, fractions, decimals',
                sortOrder: 1,
              },
              {
                id: 'f1-math-2',
                name: 'Algebraic Expressions',
                slug: 'algebraic-expressions',
                description: 'Simplifying algebraic expressions',
                sortOrder: 2,
              },
              {
                id: 'f1-math-3',
                name: 'Linear Equations',
                slug: 'linear-equations',
                description: 'Solving linear equations in one variable',
                sortOrder: 3,
              },
              {
                id: 'f1-math-4',
                name: 'Angles and Triangles',
                slug: 'angles-and-triangles',
                description: 'Properties of angles and triangles',
                sortOrder: 4,
              },
            ],
          },
          {
            id: 'f1-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'Introduction to physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f1-phy-1',
                name: 'Measurements',
                slug: 'measurements',
                description: 'SI units and measurement techniques',
                sortOrder: 1,
              },
              {
                id: 'f1-phy-2',
                name: 'Force and Motion',
                slug: 'force-and-motion',
                description: "Newton's laws of motion",
                sortOrder: 2,
              },
              {
                id: 'f1-phy-3',
                name: 'Energy',
                slug: 'energy',
                description: 'Forms and conversion of energy',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f1-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'Introduction to chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f1-chem-1',
                name: 'Laboratory Safety',
                slug: 'laboratory-safety',
                description: 'Chemistry lab rules and safety',
                sortOrder: 1,
              },
              {
                id: 'f1-chem-2',
                name: 'Elements and Compounds',
                slug: 'elements-and-compounds',
                description: 'Atoms, elements, and compounds',
                sortOrder: 2,
              },
              {
                id: 'f1-chem-3',
                name: 'States of Matter',
                slug: 'states-of-matter',
                description: 'Solids, liquids, and gases',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f1-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'Introduction to biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f1-bio-1',
                name: 'Cell Structure',
                slug: 'cell-structure',
                description: 'Plant and animal cells',
                sortOrder: 1,
              },
              {
                id: 'f1-bio-2',
                name: 'Nutrition',
                slug: 'nutrition',
                description: 'Types of food and nutrients',
                sortOrder: 2,
              },
              {
                id: 'f1-bio-3',
                name: 'Respiration',
                slug: 'respiration',
                description: 'Breathing and cellular respiration',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f1-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'English language studies',
            sortOrder: 5,
            topics: [
              {
                id: 'f1-eng-1',
                name: 'Grammar',
                slug: 'grammar',
                description: 'Parts of speech and sentence structure',
                sortOrder: 1,
              },
              {
                id: 'f1-eng-2',
                name: 'Comprehension',
                slug: 'comprehension',
                description: 'Reading and understanding texts',
                sortOrder: 2,
              },
              {
                id: 'f1-eng-3',
                name: 'Composition Writing',
                slug: 'composition-writing',
                description: 'Essay and letter writing',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f1-kis',
            name: 'Kiswahili',
            slug: 'kiswahili',
            description: 'Kiswahili language studies',
            sortOrder: 6,
            topics: [
              {
                id: 'f1-kis-1',
                name: 'Fasihi Simulizi',
                slug: 'fasihi-simulizi',
                description: 'Oral literature and storytelling',
                sortOrder: 1,
              },
              {
                id: 'f1-kis-2',
                name: 'Sarufi',
                slug: 'sarufi',
                description: 'Grammar and language structure',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f1-civics',
            name: 'Civics',
            slug: 'civics',
            description: 'Citizenship education',
            sortOrder: 7,
            topics: [
              {
                id: 'f1-civics-1',
                name: 'Concept of Good Citizenship',
                slug: 'concept-of-good-citizenship',
                description: 'What it means to be a good citizen',
                sortOrder: 1,
              },
              {
                id: 'f1-civics-2',
                name: 'Rights and Responsibilities',
                slug: 'rights-and-responsibilities',
                description: 'Individual and collective rights',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f1-history',
            name: 'History',
            slug: 'history',
            description: 'Historical studies',
            sortOrder: 8,
            topics: [
              {
                id: 'f1-hist-1',
                name: 'Migration and Settlement',
                slug: 'migration-and-settlement',
                description: 'Bantu migration and settlement in East Africa',
                sortOrder: 1,
              },
              {
                id: 'f1-hist-2',
                name: 'Ancient Civilizations',
                slug: 'ancient-civilizations',
                description: 'Early civilizations in Africa',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f1-geog',
            name: 'Geography',
            slug: 'geography',
            description: 'Geographical studies',
            sortOrder: 9,
            topics: [
              {
                id: 'f1-geog-1',
                name: 'The Earth and Globe',
                slug: 'the-earth-and-globe',
                description: 'Latitude, longitude, and time zones',
                sortOrder: 1,
              },
              {
                id: 'f1-geog-2',
                name: 'Rocks and Weathering',
                slug: 'rocks-and-weathering',
                description: 'Types of rocks and weathering processes',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'form2',
        name: 'Form 2',
        slug: 'form-2',
        sortOrder: 2,
        subjects: [
          {
            id: 'f2-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Intermediate secondary mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f2-math-1',
                name: 'Simultaneous Equations',
                slug: 'simultaneous-equations',
                description: 'Solving systems of linear equations',
                sortOrder: 1,
              },
              {
                id: 'f2-math-2',
                name: 'Quadratic Equations',
                slug: 'quadratic-equations',
                description: 'Solving quadratic equations',
                sortOrder: 2,
              },
              {
                id: 'f2-math-3',
                name: 'Matrices',
                slug: 'matrices',
                description: 'Introduction to matrices',
                sortOrder: 3,
              },
              {
                id: 'f2-math-4',
                name: 'Sets',
                slug: 'sets',
                description: 'Set theory and operations',
                sortOrder: 4,
              },
            ],
          },
          {
            id: 'f2-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'Intermediate physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f2-phy-1',
                name: 'Sound',
                slug: 'sound',
                description: 'Properties and production of sound',
                sortOrder: 1,
              },
              {
                id: 'f2-phy-2',
                name: 'Light',
                slug: 'light',
                description: 'Reflection and refraction of light',
                sortOrder: 2,
              },
              {
                id: 'f2-phy-3',
                name: 'Electricity',
                slug: 'electricity',
                description: "Electric circuits and Ohm's law",
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f2-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'Intermediate chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f2-chem-1',
                name: 'Chemical Bonding',
                slug: 'chemical-bonding',
                description: 'Ionic and covalent bonding',
                sortOrder: 1,
              },
              {
                id: 'f2-chem-2',
                name: 'Acids and Bases',
                slug: 'acids-and-bases',
                description: 'Properties and reactions of acids and bases',
                sortOrder: 2,
              },
              {
                id: 'f2-chem-3',
                name: 'Periodic Table',
                slug: 'periodic-table',
                description: 'Understanding the periodic table',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f2-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'Intermediate biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f2-bio-1',
                name: 'Transport Systems',
                slug: 'transport-systems',
                description: 'Circulatory and transport in plants',
                sortOrder: 1,
              },
              {
                id: 'f2-bio-2',
                name: 'Reproduction',
                slug: 'reproduction',
                description: 'Sexual and asexual reproduction',
                sortOrder: 2,
              },
              {
                id: 'f2-bio-3',
                name: 'Genetics Basics',
                slug: 'genetics-basics',
                description: 'Introduction to heredity',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f2-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'English language studies',
            sortOrder: 5,
            topics: [
              {
                id: 'f2-eng-1',
                name: 'Literature',
                slug: 'literature',
                description: 'Analyzing literary texts',
                sortOrder: 1,
              },
              {
                id: 'f2-eng-2',
                name: 'Report Writing',
                slug: 'report-writing',
                description: 'Writing formal reports',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f2-kis',
            name: 'Kiswahili',
            slug: 'kiswahili',
            description: 'Kiswahili language studies',
            sortOrder: 6,
            topics: [
              {
                id: 'f2-kis-1',
                name: 'Utunzi',
                slug: 'utunzi',
                description: 'Poetry and composition',
                sortOrder: 1,
              },
              {
                id: 'f2-kis-2',
                name: 'Ushairi',
                slug: 'ushairi',
                description: 'Swahili poetry analysis',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f2-civics',
            name: 'Civics',
            slug: 'civics',
            description: 'Citizenship education',
            sortOrder: 7,
            topics: [
              {
                id: 'f2-civics-1',
                name: 'Governance',
                slug: 'governance',
                description: 'Systems of government in Tanzania',
                sortOrder: 1,
              },
              {
                id: 'f2-civics-2',
                name: 'Justice and Law',
                slug: 'justice-and-law',
                description: 'Legal system and justice',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f2-history',
            name: 'History',
            slug: 'history',
            description: 'Historical studies',
            sortOrder: 8,
            topics: [
              {
                id: 'f2-hist-1',
                name: 'MFecame War',
                slug: 'mfecame-war',
                description: 'The Maji Maji Rebellion against German colonialism (1905-1907)',
                sortOrder: 1,
              },
              {
                id: 'f2-hist-2',
                name: 'World War I Impact',
                slug: 'world-war-i-impact',
                description: 'How WWI affected East Africa',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f2-geog',
            name: 'Geography',
            slug: 'geography',
            description: 'Geographical studies',
            sortOrder: 9,
            topics: [
              {
                id: 'f2-geog-1',
                name: 'Climate',
                slug: 'climate',
                description: 'Climate zones and patterns in Tanzania',
                sortOrder: 1,
              },
              {
                id: 'f2-geog-2',
                name: 'Vegetation',
                slug: 'vegetation',
                description: 'Natural vegetation and human impact',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: 'form3',
        name: 'Form 3',
        slug: 'form-3',
        sortOrder: 3,
        subjects: [
          {
            id: 'f3-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Advanced secondary mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f3-math-1',
                name: 'Logarithms',
                slug: 'logarithms',
                description: 'Properties and applications of logarithms',
                sortOrder: 1,
              },
              {
                id: 'f3-math-2',
                name: 'Trigonometry',
                slug: 'trigonometry',
                description: 'Trigonometric ratios and identities',
                sortOrder: 2,
              },
              {
                id: 'f3-math-3',
                name: 'Coordinate Geometry',
                slug: 'coordinate-geometry',
                description: 'Equations of lines and circles',
                sortOrder: 3,
              },
              {
                id: 'f3-math-4',
                name: 'Probability',
                slug: 'probability',
                description: 'Basic probability theory',
                sortOrder: 4,
              },
            ],
          },
          {
            id: 'f3-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'Advanced physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f3-phy-1',
                name: 'Waves',
                slug: 'waves',
                description: 'Types and properties of waves',
                sortOrder: 1,
              },
              {
                id: 'f3-phy-2',
                name: 'Optics',
                slug: 'optics',
                description: 'Lenses and optical instruments',
                sortOrder: 2,
              },
              {
                id: 'f3-phy-3',
                name: 'Electromagnetic Induction',
                slug: 'electromagnetic-induction',
                description: "Faraday's law and applications",
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f3-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'Advanced chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f3-chem-1',
                name: 'Organic Chemistry',
                slug: 'organic-chemistry',
                description: 'Hydrocarbons and their compounds',
                sortOrder: 1,
              },
              {
                id: 'f3-chem-2',
                name: 'Mole Concept',
                slug: 'mole-concept',
                description: "Avogadro's number and molar calculations",
                sortOrder: 2,
              },
              {
                id: 'f3-chem-3',
                name: 'Electrochemistry',
                slug: 'electrochemistry',
                description: 'Electrolytic and galvanic cells',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f3-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'Advanced biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f3-bio-1',
                name: 'Genetics',
                slug: 'genetics',
                description: 'Mendelian genetics and inheritance',
                sortOrder: 1,
              },
              {
                id: 'f3-bio-2',
                name: 'Ecology',
                slug: 'ecology',
                description: 'Ecosystems and biodiversity',
                sortOrder: 2,
              },
              {
                id: 'f3-bio-3',
                name: 'Evolution',
                slug: 'evolution',
                description: 'Theories of evolution',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f3-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'English language studies',
            sortOrder: 5,
            topics: [
              {
                id: 'f3-eng-1',
                name: 'Advanced Grammar',
                slug: 'advanced-grammar',
                description: 'Complex sentence structures',
                sortOrder: 1,
              },
              {
                id: 'f3-eng-2',
                name: 'Literary Analysis',
                slug: 'literary-analysis',
                description: 'Analyzing novels and plays',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f3-history',
            name: 'History',
            slug: 'history',
            description: 'Historical studies',
            sortOrder: 8,
            topics: [
              {
                id: 'f3-hist-1',
                name: 'Pan-Africanism',
                slug: 'pan-africanism',
                description: 'The Pan-African movement',
                sortOrder: 1,
              },
              {
                id: 'f3-hist-2',
                name: 'Tanzania Independence',
                slug: 'tanzania-independence',
                description: 'The struggle for independence',
                sortOrder: 2,
              },
              {
                id: 'f3-hist-3',
                name: 'Ujamaa',
                slug: 'ujamaa',
                description: "Nyerere's Ujamaa philosophy",
                sortOrder: 3,
              },
            ],
          },
        ],
      },
      {
        id: 'form4',
        name: 'Form 4',
        slug: 'form-4',
        sortOrder: 4,
        subjects: [
          {
            id: 'f4-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Exam preparation mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f4-math-1',
                name: 'Matrices and Transformations',
                slug: 'matrices-and-transformations',
                description: 'Matrix operations and geometric transformations',
                sortOrder: 1,
              },
              {
                id: 'f4-math-2',
                name: 'Vectors',
                slug: 'vectors',
                description: 'Vector operations and applications',
                sortOrder: 2,
              },
              {
                id: 'f4-math-3',
                name: 'Statistics and Probability',
                slug: 'statistics-and-probability',
                description: 'Advanced data analysis',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f4-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'Exam preparation physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f4-phy-1',
                name: 'Nuclear Physics',
                slug: 'nuclear-physics',
                description: 'Radioactivity and nuclear energy',
                sortOrder: 1,
              },
              {
                id: 'f4-phy-2',
                name: 'Modern Physics',
                slug: 'modern-physics',
                description: 'Relativity and quantum basics',
                sortOrder: 2,
              },
              {
                id: 'f4-phy-3',
                name: 'Electronics',
                slug: 'electronics',
                description: 'Semiconductors and logic gates',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f4-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'Exam preparation chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f4-chem-1',
                name: 'Reaction Kinetics',
                slug: 'reaction-kinetics',
                description: 'Rates of chemical reactions',
                sortOrder: 1,
              },
              {
                id: 'f4-chem-2',
                name: 'Chemical Equilibrium',
                slug: 'chemical-equilibrium',
                description: "Le Chatelier's principle",
                sortOrder: 2,
              },
              {
                id: 'f4-chem-3',
                name: 'Industrial Chemistry',
                slug: 'industrial-chemistry',
                description: 'Manufacturing processes',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f4-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'Exam preparation biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f4-bio-1',
                name: 'Molecular Biology',
                slug: 'molecular-biology',
                description: 'DNA, RNA, and protein synthesis',
                sortOrder: 1,
              },
              {
                id: 'f4-bio-2',
                name: 'Biotechnology',
                slug: 'biotechnology',
                description: 'Applications of biology in technology',
                sortOrder: 2,
              },
              {
                id: 'f4-bio-3',
                name: 'Human Impact',
                slug: 'human-impact',
                description: 'Environmental and conservation biology',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f4-eng',
            name: 'English Language',
            slug: 'english-language',
            description: 'Exam preparation English',
            sortOrder: 5,
            topics: [
              {
                id: 'f4-eng-1',
                name: 'Advanced Composition',
                slug: 'advanced-composition',
                description: 'Essay writing techniques',
                sortOrder: 1,
              },
              {
                id: 'f4-eng-2',
                name: 'Literary Criticism',
                slug: 'literary-criticism',
                description: 'Critical analysis of texts',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f4-history',
            name: 'History',
            slug: 'history',
            description: 'Exam preparation history',
            sortOrder: 8,
            topics: [
              {
                id: 'f4-hist-1',
                name: 'Cold War in Africa',
                slug: 'cold-war-in-africa',
                description: 'Impact of Cold War on African nations',
                sortOrder: 1,
              },
              {
                id: 'f4-hist-2',
                name: 'Post-Independence Tanzania',
                slug: 'post-independence-tanzania',
                description: 'Development and challenges',
                sortOrder: 2,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── A-LEVEL ──
  {
    id: 'a_level',
    name: 'Advanced Level (A-Level)',
    slug: 'a-level',
    description: 'Form 5-6 (Pre-University)',
    sortOrder: 3,
    forms: [
      {
        id: 'form5',
        name: 'Form 5',
        slug: 'form-5',
        sortOrder: 1,
        subjects: [
          {
            id: 'f5-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Advanced level mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f5-math-1',
                name: 'Calculus',
                slug: 'calculus',
                description: 'Differentiation and integration',
                sortOrder: 1,
              },
              {
                id: 'f5-math-2',
                name: 'Complex Numbers',
                slug: 'complex-numbers',
                description: 'Imaginary and complex numbers',
                sortOrder: 2,
              },
              {
                id: 'f5-math-3',
                name: 'Differential Equations',
                slug: 'differential-equations',
                description: 'First and second order ODEs',
                sortOrder: 3,
              },
              {
                id: 'f5-math-4',
                name: 'Mechanics',
                slug: 'mechanics',
                description: 'Newtonian mechanics',
                sortOrder: 4,
              },
            ],
          },
          {
            id: 'f5-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'A-Level physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f5-phy-1',
                name: 'Mechanics',
                slug: 'mechanics',
                description: 'Motion, forces, and energy',
                sortOrder: 1,
              },
              {
                id: 'f5-phy-2',
                name: 'Thermodynamics',
                slug: 'thermodynamics',
                description: 'Heat and temperature',
                sortOrder: 2,
              },
              {
                id: 'f5-phy-3',
                name: 'Waves and Optics',
                slug: 'waves-and-optics',
                description: 'Advanced wave phenomena',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f5-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'A-Level chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f5-chem-1',
                name: 'Thermochemistry',
                slug: 'thermochemistry',
                description: "Enthalpy and Hess's law",
                sortOrder: 1,
              },
              {
                id: 'f5-chem-2',
                name: 'Advanced Organic',
                slug: 'advanced-organic',
                description: 'Reaction mechanisms',
                sortOrder: 2,
              },
              {
                id: 'f5-chem-3',
                name: 'Transition Metals',
                slug: 'transition-metals',
                description: 'Chemistry of d-block elements',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f5-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'A-Level biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f5-bio-1',
                name: 'Cell Biology',
                slug: 'cell-biology',
                description: 'Advanced cell structures and functions',
                sortOrder: 1,
              },
              {
                id: 'f5-bio-2',
                name: 'Biochemistry',
                slug: 'biochemistry',
                description: 'Enzymes and metabolism',
                sortOrder: 2,
              },
              {
                id: 'f5-bio-3',
                name: 'Microbiology',
                slug: 'microbiology',
                description: 'Bacteria, viruses, and immunity',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f5-eco',
            name: 'Economics',
            slug: 'economics',
            description: 'A-Level economics',
            sortOrder: 5,
            topics: [
              {
                id: 'f5-eco-1',
                name: 'Demand and Supply',
                slug: 'demand-and-supply',
                description: 'Market equilibrium and elasticity',
                sortOrder: 1,
              },
              {
                id: 'f5-eco-2',
                name: 'National Income',
                slug: 'national-income',
                description: 'GDP and economic growth',
                sortOrder: 2,
              },
              {
                id: 'f5-eco-3',
                name: 'Money and Banking',
                slug: 'money-and-banking',
                description: 'Central banking and monetary policy',
                sortOrder: 3,
              },
            ],
          },
        ],
      },
      {
        id: 'form6',
        name: 'Form 6',
        slug: 'form-6',
        sortOrder: 2,
        subjects: [
          {
            id: 'f6-math',
            name: 'Mathematics',
            slug: 'mathematics',
            description: 'Final A-Level mathematics',
            sortOrder: 1,
            topics: [
              {
                id: 'f6-math-1',
                name: 'Advanced Calculus',
                slug: 'advanced-calculus',
                description: 'Multivariable calculus',
                sortOrder: 1,
              },
              {
                id: 'f6-math-2',
                name: 'Linear Algebra',
                slug: 'linear-algebra',
                description: 'Vector spaces and eigenvalues',
                sortOrder: 2,
              },
              {
                id: 'f6-math-3',
                name: 'Statistics',
                slug: 'statistics',
                description: 'Advanced statistical methods',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f6-phy',
            name: 'Physics',
            slug: 'physics',
            description: 'Final A-Level physics',
            sortOrder: 2,
            topics: [
              {
                id: 'f6-phy-1',
                name: 'Quantum Physics',
                slug: 'quantum-physics',
                description: 'Photoelectric effect and wave-particle duality',
                sortOrder: 1,
              },
              {
                id: 'f6-phy-2',
                name: 'Nuclear Physics',
                slug: 'nuclear-physics',
                description: 'Radioactive decay and nuclear reactions',
                sortOrder: 2,
              },
              {
                id: 'f6-phy-3',
                name: 'Astrophysics',
                slug: 'astrophysics',
                description: 'Stars and the universe',
                sortOrder: 3,
              },
            ],
          },
          {
            id: 'f6-chem',
            name: 'Chemistry',
            slug: 'chemistry',
            description: 'Final A-Level chemistry',
            sortOrder: 3,
            topics: [
              {
                id: 'f6-chem-1',
                name: 'Analytical Chemistry',
                slug: 'analytical-chemistry',
                description: 'Chromatography and spectroscopy',
                sortOrder: 1,
              },
              {
                id: 'f6-chem-2',
                name: 'Polymer Chemistry',
                slug: 'polymer-chemistry',
                description: 'Polymers and plastics',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f6-bio',
            name: 'Biology',
            slug: 'biology',
            description: 'Final A-Level biology',
            sortOrder: 4,
            topics: [
              {
                id: 'f6-bio-1',
                name: 'Genetics and Evolution',
                slug: 'genetics-and-evolution',
                description: 'Advanced genetics and natural selection',
                sortOrder: 1,
              },
              {
                id: 'f6-bio-2',
                name: 'Biotechnology',
                slug: 'biotechnology',
                description: 'Genetic engineering and applications',
                sortOrder: 2,
              },
            ],
          },
          {
            id: 'f6-eco',
            name: 'Economics',
            slug: 'economics',
            description: 'Final A-Level economics',
            sortOrder: 5,
            topics: [
              {
                id: 'f6-eco-1',
                name: 'International Trade',
                slug: 'international-trade',
                description: 'Globalization and trade policies',
                sortOrder: 1,
              },
              {
                id: 'f6-eco-2',
                name: 'Development Economics',
                slug: 'development-economics',
                description: 'Poverty and development strategies',
                sortOrder: 2,
              },
              {
                id: 'f6-eco-3',
                name: 'Tanzania Economy',
                slug: 'tanzania-economy',
                description: 'Economic development in Tanzania',
                sortOrder: 3,
              },
            ],
          },
        ],
      },
    ],
  },
];

function generateId(): string {
  return 'curr_' + Math.random().toString(36).substring(2, 10);
}

export async function seedCurriculum(queryable: AcademicQueryable): Promise<void> {
  // Check if curriculum already seeded
  const existing = await queryable.query('SELECT COUNT(*) as cnt FROM curriculum_levels');
  const rows = existing.rows as { cnt: number }[];
  if (rows[0].cnt > 0) return;

  for (const level of CURRICULUM_DATA) {
    await queryable.query(
      'INSERT INTO curriculum_levels (id, name, slug, description, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [level.id, level.name, level.slug, level.description, level.sortOrder],
    );

    for (const form of level.forms) {
      await queryable.query(
        'INSERT INTO curriculum_forms (id, level_id, name, slug, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [form.id, level.id, form.name, form.slug, form.sortOrder],
      );

      for (const subject of form.subjects) {
        await queryable.query(
          'INSERT INTO curriculum_subjects (id, form_id, name, slug, description, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
          [subject.id, form.id, subject.name, subject.slug, subject.description, subject.sortOrder],
        );

        for (const topic of subject.topics) {
          await queryable.query(
            'INSERT INTO curriculum_topics (id, subject_id, name, slug, description, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
            [topic.id, subject.id, topic.name, topic.slug, topic.description, topic.sortOrder],
          );
        }
      }
    }
  }
}
