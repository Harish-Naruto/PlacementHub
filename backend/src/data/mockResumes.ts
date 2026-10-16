/**
 * Mock resume data.
 *
 * These are DUMMY TEST PROFILES created exclusively for the AI Skill Assessment
 * demo. They do not represent real people and must not be used for any purpose
 * other than testing and demonstration.
 *
 * When real student profiles are available from the database, replace this
 * module with a service that reads from StudentProfile / Skill / Project tables.
 */

export interface MockProject {
    title: string;
    description: string;
    technologies: string[];
}

export interface MockExperience {
    company: string;
    role: string;
    duration: string;
    description: string;
}

export interface MockResume {
    id: string;
    name: string;
    email: string;
    education: {
        degree: string;
        institution: string;
        graduationYear: number;
        cgpa?: number;
    };
    skills: string[];
    projects: MockProject[];
    experience: MockExperience[];
    linkedinUrl?: string;
    githubUsername?: string;
    _isDummyTestData: true;
}

const MOCK_RESUMES: MockResume[] = [
    {
        id: 'resume_001',
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        education: {
            degree: 'B.E. Computer Engineering',
            institution: 'VIT Vellore',
            graduationYear: 2027,
            cgpa: 8.6,
        },
        skills: [
            'React',
            'TypeScript',
            'Node.js',
            'Express.js',
            'PostgreSQL',
            'Prisma',
            'JWT',
            'REST APIs',
            'Git',
        ],
        projects: [
            {
                title: 'Placement Management System',
                description:
                    'Built a full-stack web application with JWT-based authentication, role-based access control for students and recruiters, and a REST API powered by Express.js and PostgreSQL via Prisma ORM.',
                technologies: ['Node.js', 'Express.js', 'PostgreSQL', 'Prisma', 'JWT', 'React', 'TypeScript'],
            },
            {
                title: 'Real-Time Chat Application',
                description:
                    'Implemented a WebSocket-based chat application supporting multiple rooms and direct messages, with message persistence in PostgreSQL and a React frontend using hooks and context API.',
                technologies: ['React', 'TypeScript', 'Socket.io', 'Node.js', 'PostgreSQL'],
            },
        ],
        experience: [],
        githubUsername: 'aarav-sharma-dev',
        _isDummyTestData: true,
    },
    {
        id: 'resume_002',
        name: 'Priya Nair',
        email: 'priya.nair@example.com',
        education: {
            degree: 'B.Tech. Information Technology',
            institution: 'NITK Surathkal',
            graduationYear: 2026,
            cgpa: 9.1,
        },
        skills: [
            'Python',
            'Django',
            'Flask',
            'FastAPI',
            'Machine Learning',
            'scikit-learn',
            'Pandas',
            'NumPy',
            'Docker',
            'Redis',
            'PostgreSQL',
            'REST APIs',
        ],
        projects: [
            {
                title: 'Resume Screening ML Pipeline',
                description:
                    'Designed an NLP-based resume ranking system using TF-IDF and cosine similarity to match resumes against job descriptions. Deployed the model as a FastAPI microservice containerised with Docker.',
                technologies: ['Python', 'FastAPI', 'scikit-learn', 'Pandas', 'Docker', 'PostgreSQL'],
            },
            {
                title: 'Student Performance Prediction Dashboard',
                description:
                    'Built a predictive analytics dashboard using a Random Forest classifier trained on anonymised student grade data. Used Flask for the backend API and integrated Redis caching for API responses.',
                technologies: ['Python', 'Flask', 'scikit-learn', 'Redis', 'Pandas', 'NumPy'],
            },
            {
                title: 'Django E-Commerce Platform',
                description:
                    'Developed a multi-vendor e-commerce platform with Django ORM, Celery for async task processing (order confirmation emails, inventory updates), and Stripe payment integration.',
                technologies: ['Python', 'Django', 'Celery', 'PostgreSQL', 'Redis', 'Stripe API'],
            },
        ],
        experience: [
            {
                company: 'Analytics India Corp (Internship)',
                role: 'Data Science Intern',
                duration: 'May 2025 – Jul 2025',
                description:
                    'Developed and validated classification models for churn prediction, reducing model evaluation cycle time by 30% through automated cross-validation scripts.',
            },
        ],
        linkedinUrl: 'https://linkedin.com/in/priya-nair-ml',
        githubUsername: 'priya-nair-ml',
        _isDummyTestData: true,
    },
    {
        id: 'resume_003',
        name: 'Rohan Mehta',
        email: 'rohan.mehta@example.com',
        education: {
            degree: 'B.Tech. Computer Science and Engineering',
            institution: 'IIT Bombay',
            graduationYear: 2025,
            cgpa: 8.3,
        },
        skills: [
            'Java',
            'Spring Boot',
            'Microservices',
            'Apache Kafka',
            'Docker',
            'Kubernetes',
            'AWS (EC2, S3, RDS)',
            'MySQL',
            'MongoDB',
            'CI/CD',
            'Jenkins',
            'gRPC',
        ],
        projects: [
            {
                title: 'Distributed Task Scheduler',
                description:
                    'Designed and implemented a horizontally scalable task scheduler using Spring Boot microservices, Kafka for inter-service messaging, and Kubernetes for orchestration. Supported cron-like scheduling with at-least-once delivery semantics.',
                technologies: ['Java', 'Spring Boot', 'Apache Kafka', 'Kubernetes', 'Docker', 'MySQL'],
            },
            {
                title: 'API Gateway Service',
                description:
                    'Built a custom API gateway using Spring Cloud Gateway with rate limiting (via Redis), JWT validation, and dynamic routing to backend microservices via gRPC. Deployed on AWS EKS.',
                technologies: ['Java', 'Spring Boot', 'Spring Cloud Gateway', 'gRPC', 'Redis', 'AWS EKS'],
            },
        ],
        experience: [
            {
                company: 'Flipkart',
                role: 'Software Engineering Intern',
                duration: 'Dec 2024 – Feb 2025',
                description:
                    'Contributed to the order management microservice, optimising a critical MySQL query that reduced p99 latency from 450ms to 80ms. Wrote integration tests with JUnit 5 and Testcontainers.',
            },
        ],
        githubUsername: 'rohan-mehta-oss',
        _isDummyTestData: true,
    },
    {
        id: 'resume_004',
        name: 'Sneha Iyer',
        email: 'sneha.iyer@example.com',
        education: {
            degree: 'B.E. Electronics and Computer Engineering',
            institution: 'BITS Pilani',
            graduationYear: 2027,
            cgpa: 7.9,
        },
        skills: [
            'C++',
            'Embedded C',
            'RTOS',
            'FreeRTOS',
            'Python',
            'UART',
            'SPI',
            'I2C',
            'ARM Cortex-M',
            'Raspberry Pi',
            'Arduino',
            'OpenCV',
        ],
        projects: [
            {
                title: 'Smart Home Automation Hub',
                description:
                    'Developed firmware in Embedded C for an STM32 ARM Cortex-M4 microcontroller to control smart home peripherals over SPI and I2C. Integrated FreeRTOS for task scheduling and MQTT over Wi-Fi for remote control.',
                technologies: ['Embedded C', 'FreeRTOS', 'STM32', 'SPI', 'I2C', 'MQTT'],
            },
            {
                title: 'Lane Detection for Autonomous Vehicles',
                description:
                    'Implemented a real-time lane detection pipeline on a Raspberry Pi using OpenCV and Python. Applied Canny edge detection and Hough Line Transform to detect lane markings at 15 fps.',
                technologies: ['Python', 'OpenCV', 'Raspberry Pi', 'NumPy'],
            },
        ],
        experience: [],
        githubUsername: 'sneha-iyer-embedded',
        _isDummyTestData: true,
    },
];

export function getAllMockResumes(): Omit<MockResume, 'email'>[] {
    return MOCK_RESUMES.map(({ email: _email, ...rest }) => rest);
}

export function getMockResumeById(id: string): MockResume | null {
    return MOCK_RESUMES.find((r) => r.id === id) ?? null;
}
