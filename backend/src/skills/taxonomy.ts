// The one skill vocabulary used by resume parsing, scoring, job parsing, matching and the seed script.
// Add a skill here and every part of the system understands it.
//
//   aliases     variants that are safe to find inside free text ("ReactJS", "React.js")
//   lookupOnly  variants that are only accepted when the whole string is the skill name
//               (too ambiguous to scan for in a paragraph: "Go", "Express", "Spring")
//
// Java and JavaScript are deliberately separate skills.

export interface TaxonomySkill {
    name: string;
    category: string;
    aliases?: string[];
    lookupOnly?: string[];
}

const s = (name: string, category: string, aliases: string[] = [], lookupOnly: string[] = []): TaxonomySkill => ({
    name,
    category,
    aliases,
    lookupOnly,
});

export const TAXONOMY: TaxonomySkill[] = [
    // Languages
    s('JavaScript', 'Language', ['js', 'ecmascript', 'es6', 'es2015'], []),
    s('TypeScript', 'Language', ['ts']),
    s('Python', 'Language', ['python3', 'python 3']),
    s('Java', 'Language', ['core java', 'java se', 'java 8', 'java 11', 'java 17']),
    s('C++', 'Language', ['cpp', 'c plus plus']),
    s('C#', 'Language', ['csharp', 'c sharp']),
    s('C', 'Language', ['c programming', 'c language']),
    s('Go', 'Language', ['golang'], ['go']),
    s('Rust', 'Language'),
    s('PHP', 'Language'),
    s('Ruby', 'Language'),
    s('Kotlin', 'Language'),
    s('Swift', 'Language', ['swiftui']),
    s('Dart', 'Language'),
    s('R', 'Language', ['r programming'], ['r']),
    s('Scala', 'Language'),
    s('Bash', 'Language', ['shell scripting', 'shell script'], ['shell']),
    s('SQL', 'Database', ['structured query language', 'sql queries']),
    s('HTML', 'Frontend', ['html5', 'html 5']),
    s('CSS', 'Frontend', ['css3', 'css 3']),

    // Frontend
    s('React', 'Frontend', ['reactjs', 'react.js', 'react js', 'react 18', 'react hooks']),
    s('Next.js', 'Frontend', ['nextjs', 'next js']),
    s('Angular', 'Frontend', ['angularjs', 'angular.js', 'angular 2+']),
    s('Vue.js', 'Frontend', ['vue', 'vuejs', 'vue js', 'vue 3']),
    s('Svelte', 'Frontend', ['sveltekit']),
    s('Redux', 'Frontend', ['redux toolkit', 'react redux']),
    s('Tailwind CSS', 'Frontend', ['tailwind', 'tailwindcss']),
    s('Bootstrap', 'Frontend', ['bootstrap 5']),
    s('Sass', 'Frontend', ['scss']),
    s('jQuery', 'Frontend'),
    s('Vite', 'Frontend'),
    s('Webpack', 'Frontend'),
    s('React Native', 'Mobile', ['reactnative', 'react-native']),
    s('Flutter', 'Mobile'),
    s('Android', 'Mobile', ['android development', 'android sdk']),
    s('iOS', 'Mobile', ['ios development']),

    // Backend
    s('Node.js', 'Backend', ['nodejs', 'node js'], ['node']),
    s('Express.js', 'Backend', ['express.js', 'expressjs', 'express js'], ['express']),
    s('NestJS', 'Backend', ['nest.js', 'nest js']),
    s('Django', 'Backend'),
    s('Flask', 'Backend'),
    s('FastAPI', 'Backend', ['fast api']),
    s('Spring Boot', 'Backend', ['springboot', 'spring framework'], ['spring']),
    s('ASP.NET', 'Backend', ['asp.net core', 'aspnet', 'asp net']),
    s('.NET', 'Backend', ['dotnet', 'dot net', '.net core']),
    s('Laravel', 'Backend'),
    s('GraphQL', 'Backend', ['graph ql']),
    s('REST API', 'Backend', ['restful', 'restful api', 'restful apis', 'rest apis', 'rest api development', 'api development'], ['rest']),
    s('gRPC', 'Backend'),
    s('WebSockets', 'Backend', ['websocket', 'socket.io', 'socketio']),
    s('Microservices', 'Backend', ['microservice', 'micro services', 'microservice architecture']),

    // Databases
    s('PostgreSQL', 'Database', ['postgres', 'psql', 'postgre sql']),
    s('MySQL', 'Database', ['my sql']),
    s('MongoDB', 'Database', ['mongo', 'mongo db']),
    s('Redis', 'Database'),
    s('SQLite', 'Database'),
    s('Firebase', 'Database', ['firestore']),
    s('Supabase', 'Database'),
    s('Elasticsearch', 'Database', ['elastic search']),
    s('Prisma', 'Database', ['prisma orm']),
    s('NoSQL', 'Database', ['no sql']),
    s('Oracle', 'Database', ['oracle db', 'oracle database']),

    // DevOps and cloud
    s('Docker', 'DevOps', ['dockerfile', 'docker compose', 'containerization']),
    s('Kubernetes', 'DevOps', ['k8s']),
    s('AWS', 'Cloud', ['amazon web services', 'aws ec2', 'aws s3', 'aws lambda']),
    s('Azure', 'Cloud', ['microsoft azure']),
    s('GCP', 'Cloud', ['google cloud', 'google cloud platform']),
    s('Linux', 'DevOps', ['ubuntu', 'unix']),
    s('Git', 'Tools', ['git version control', 'version control']),
    s('GitHub', 'Tools', ['github actions']),
    s('CI/CD', 'DevOps', ['cicd', 'ci cd', 'continuous integration', 'continuous delivery', 'jenkins']),
    s('Terraform', 'DevOps'),
    s('Nginx', 'DevOps'),

    // Data and AI
    s('Machine Learning', 'Data/AI', ['ml', 'machine-learning']),
    s('Deep Learning', 'Data/AI', ['neural networks'], ['dl']),
    s('Data Analysis', 'Data/AI', ['data analytics', 'data analyst']),
    s('Pandas', 'Data/AI'),
    s('NumPy', 'Data/AI'),
    s('scikit-learn', 'Data/AI', ['sklearn', 'scikit learn']),
    s('TensorFlow', 'Data/AI'),
    s('PyTorch', 'Data/AI'),
    s('NLP', 'Data/AI', ['natural language processing']),
    s('Computer Vision', 'Data/AI', ['opencv']),
    s('LLM', 'Data/AI', ['llms', 'large language models', 'generative ai', 'genai', 'prompt engineering']),
    s('Power BI', 'Data/AI', ['powerbi']),
    s('Tableau', 'Data/AI'),
    s('Excel', 'Data/AI', ['microsoft excel', 'ms excel', 'advanced excel']),
    s('Apache Spark', 'Data/AI', ['pyspark', 'apache spark'], ['spark']),
    s('Hadoop', 'Data/AI'),
    s('Kafka', 'Data/AI', ['apache kafka']),

    // Core CS and practice
    s('Data Structures', 'CS', ['dsa', 'data structures and algorithms', 'data structures & algorithms'], ['algorithms']),
    s('OOP', 'CS', ['object oriented programming', 'object-oriented programming', 'oops', 'object oriented design']),
    s('System Design', 'CS', ['low level design', 'high level design', 'lld', 'hld']),
    s('Operating Systems', 'CS', ['os concepts']),
    s('Computer Networks', 'CS', [], ['networking']),
    s('DBMS', 'CS', ['database management systems', 'database design']),
    s('Agile', 'Practice', ['scrum', 'agile methodology']),
    s('Testing', 'Practice', ['unit testing', 'test automation', 'qa testing', 'software testing']),
    s('Jest', 'Practice'),
    s('Selenium', 'Practice'),
    s('Postman', 'Tools', ['api testing']),
    s('Figma', 'Design', ['ui/ux', 'ui ux', 'ux design']),
    s('JWT', 'Backend', ['json web token', 'json web tokens']),
    s('OAuth', 'Backend', ['oauth2', 'oauth 2.0']),
    s('Cybersecurity', 'Security', ['cyber security', 'information security', 'network security']),
    s('Blockchain', 'Other', ['solidity', 'web3', 'smart contracts']),
    s('Embedded Systems', 'Other', ['embedded c', 'arduino', 'raspberry pi', 'iot']),
    s('Salesforce', 'Other'),
    s('SAP', 'Other'),
];
