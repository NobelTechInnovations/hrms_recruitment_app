export type SeedQuestion = { topic: string; text: string; options: string[]; correct: number; explanation?: string };

export type SeedAssessment = {
  level: 1 | 2;
  category: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingPercent: number;
  questionsPerAttempt: number;
  questions: SeedQuestion[];
};

export const ASSESSMENTS: SeedAssessment[] = [
  {
    level: 1,
    category: "general",
    title: "Level 1 — Aptitude & Basic Screening",
    description: "Logical reasoning, quantitative aptitude, communication, basic problem solving and general professional skills.",
    durationMinutes: 15,
    passingPercent: 60,
    questionsPerAttempt: 10,
    questions: [
      { topic: "Logical reasoning", text: "Find the next number: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "36"], correct: 1, explanation: "Differences increase by 2: 4, 6, 8, 10, 12." },
      { topic: "Logical reasoning", text: "All roses are flowers. Some flowers fade quickly. Which statement must be true?", options: ["All roses fade quickly", "Some roses fade quickly", "No conclusion about roses fading can be drawn", "No roses fade quickly"], correct: 2 },
      { topic: "Logical reasoning", text: "In a code, OFFICE is written as PGGJDF. How is TEAM written?", options: ["UFBN", "UEBN", "SFBN", "UFCN"], correct: 0, explanation: "Each letter shifts forward by one." },
      { topic: "Quantitative aptitude", text: "A salary of ₹50,000 is increased by 10% and then decreased by 10%. What is the final salary?", options: ["₹50,000", "₹49,500", "₹50,500", "₹49,000"], correct: 1 },
      { topic: "Quantitative aptitude", text: "A 200 m long train passes a pole in 10 seconds. What is its speed in km/h?", options: ["60", "72", "80", "20"], correct: 1, explanation: "20 m/s × 3.6 = 72 km/h." },
      { topic: "Quantitative aptitude", text: "6 people complete a task in 10 days. How many days will 4 people take at the same rate?", options: ["12", "15", "20", "8"], correct: 1 },
      { topic: "Communication", text: "Choose the correctly punctuated sentence.", options: ["Its a great opportunity, isn't it?", "It's a great opportunity, isn't it?", "It's a great opportunity isnt it?", "Its' a great opportunity, isn't it?"], correct: 1 },
      { topic: "Communication", text: "What is the most professional way to decline a meeting invite?", options: ["Can't come.", "I won't be able to attend due to a prior commitment. Could we find another time?", "Busy, reschedule.", "Not replying"], correct: 1 },
      { topic: "Communication", text: "Choose the word closest in meaning to “concise”.", options: ["Brief", "Complicated", "Vague", "Lengthy"], correct: 0 },
      { topic: "Problem solving", text: "You have two tasks due today but time for only one. What should you do first?", options: ["Pick the easier one", "Clarify priorities with your manager or stakeholders", "Do both partially", "Work on neither"], correct: 1 },
      { topic: "Problem solving", text: "A process has three sequential steps taking 2, 5 and 3 hours. Which step should be optimised first to cut total time the most?", options: ["Step 1 (2 hours)", "Step 2 (5 hours)", "Step 3 (3 hours)", "All equally"], correct: 1 },
      { topic: "Problem solving", text: "A clock shows 3:15. What is the angle between the hour and minute hands?", options: ["0°", "7.5°", "15°", "30°"], correct: 1 },
      { topic: "Professional skills", text: "A colleague shares confidential salary data in a group chat. What is the best action?", options: ["Forward it to friends", "Ignore it", "Report it through the appropriate channel and don't share it further", "Reply with your own salary"], correct: 2 },
      { topic: "Professional skills", text: "In goal setting, SMART stands for:", options: ["Specific, Measurable, Achievable, Relevant, Time-bound", "Simple, Manageable, Actionable, Realistic, Tracked", "Strategic, Meaningful, Ambitious, Rewarding, Timely", "Specific, Motivating, Accurate, Reviewed, Tested"], correct: 0 },
      { topic: "Professional skills", text: "When receiving critical feedback, the most constructive response is to:", options: ["Defend yourself immediately", "Listen, ask clarifying questions and agree on next steps", "Escalate to HR", "Ignore it"], correct: 1 },
    ],
  },
  {
    level: 2,
    category: "it",
    title: "Level 2 — IT & Software",
    description: "Programming, databases, web development and system fundamentals.",
    durationMinutes: 15,
    passingPercent: 60,
    questionsPerAttempt: 8,
    questions: [
      { topic: "Programming", text: "What is the time complexity of binary search on a sorted array of n elements?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], correct: 1 },
      { topic: "Programming", text: "Which data structure follows FIFO (first-in, first-out) ordering?", options: ["Stack", "Queue", "Tree", "Heap"], correct: 1 },
      { topic: "Programming", text: "In JavaScript, what does `typeof null` return?", options: ["\"null\"", "\"undefined\"", "\"object\"", "\"number\""], correct: 2 },
      { topic: "Database", text: "Which SQL clause filters rows after aggregation?", options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], correct: 1 },
      { topic: "Database", text: "What does adding an index to a table column primarily improve?", options: ["Write speed", "Query / lookup speed", "Storage size", "Backup time"], correct: 1 },
      { topic: "Database", text: "Which normal form removes transitive dependencies?", options: ["1NF", "2NF", "3NF", "None of these"], correct: 2 },
      { topic: "Web development", text: "Which HTTP status code means “Not Found”?", options: ["200", "301", "404", "500"], correct: 2 },
      { topic: "Web development", text: "Which HTTP method is defined as idempotent?", options: ["POST", "PUT", "CONNECT", "None of these"], correct: 1 },
      { topic: "System fundamentals", text: "What is the main purpose of a load balancer?", options: ["Encrypt traffic", "Distribute incoming traffic across multiple servers", "Store session data", "Compile code"], correct: 1 },
      { topic: "System fundamentals", text: "Which of these is NOT a standard process state in an operating system?", options: ["Running", "Waiting", "Ready", "Compiling"], correct: 3 },
    ],
  },
  {
    level: 2,
    category: "finance",
    title: "Level 2 — Finance & Accounting",
    description: "Accounting, financial analysis, Excel and tax fundamentals.",
    durationMinutes: 15,
    passingPercent: 60,
    questionsPerAttempt: 8,
    questions: [
      { topic: "Accounting", text: "The fundamental accounting equation is:", options: ["Assets = Liabilities + Equity", "Assets = Revenue − Expenses", "Equity = Assets + Liabilities", "Liabilities = Assets + Equity"], correct: 0 },
      { topic: "Accounting", text: "Depreciation is best described as:", options: ["A cash outflow", "An expense that allocates the cost of a fixed asset over its useful life", "A liability", "Income from asset sales"], correct: 1 },
      { topic: "Accounting", text: "Which statement shows a company's financial position at a point in time?", options: ["Income statement", "Cash flow statement", "Balance sheet", "Statement of retained earnings"], correct: 2 },
      { topic: "Financial analysis", text: "The current ratio is calculated as:", options: ["Current assets ÷ Current liabilities", "Total assets ÷ Total liabilities", "Net profit ÷ Revenue", "Debt ÷ Equity"], correct: 0 },
      { topic: "Financial analysis", text: "Revenue is ₹10 Cr and net profit is ₹1.5 Cr. What is the net profit margin?", options: ["10%", "15%", "1.5%", "25%"], correct: 1 },
      { topic: "Excel", text: "Which Excel function looks up a value in the first column of a range and returns a value from the same row?", options: ["HLOOKUP", "VLOOKUP", "INDEX", "MATCH"], correct: 1 },
      { topic: "Excel", text: "What do the $ signs in =$A$1 do?", options: ["Format as currency", "Make the reference absolute", "Convert to text", "Nothing"], correct: 1 },
      { topic: "Tax fundamentals", text: "In India, GST replaced:", options: ["Income tax", "Multiple indirect taxes such as VAT, excise and service tax", "Corporate tax", "Capital gains tax"], correct: 1 },
      { topic: "Tax fundamentals", text: "TDS stands for:", options: ["Tax Deducted at Source", "Total Due Settlement", "Tax Declaration Statement", "Taxable Deposit Scheme"], correct: 0 },
      { topic: "Tax fundamentals", text: "Which certificate does an employer issue for TDS deducted on salary?", options: ["Form 26AS", "Form 16", "Form 15G", "Form 12BB"], correct: 1 },
    ],
  },
  {
    level: 2,
    category: "sales",
    title: "Level 2 — Sales & Business Development",
    description: "Communication, negotiation, sales scenarios and customer handling.",
    durationMinutes: 15,
    passingPercent: 60,
    questionsPerAttempt: 8,
    questions: [
      { topic: "Communication", text: "In a discovery call, the ideal balance is to:", options: ["Talk most of the time to pitch features", "Listen more than you talk", "Read from a script only", "Avoid questions"], correct: 1 },
      { topic: "Communication", text: "Which of these is an open-ended question?", options: ["Are you happy with your vendor?", "What challenges are you facing with your current vendor?", "Is budget approved?", "Do you use Excel?"], correct: 1 },
      { topic: "Negotiation", text: "BATNA stands for:", options: ["Best Alternative To a Negotiated Agreement", "Basic Agreement To Negotiate Actively", "Buyer Assessment Tool for Negotiation Analysis", "Budget After Tax and Net Adjustments"], correct: 0 },
      { topic: "Negotiation", text: "A client asks for a 20% discount. The best first response is to:", options: ["Agree immediately", "Refuse outright", "Understand their reasons and explore value or trade-offs before conceding", "Offer 30%"], correct: 2 },
      { topic: "Negotiation", text: "“Anchoring” in negotiation means:", options: ["Refusing to move", "Setting the first reference point that influences the outcome", "Ending talks", "Bringing a manager"], correct: 1 },
      { topic: "Sales scenarios", text: "A lead says “It's too expensive.” This is best treated as:", options: ["A final no", "An objection to explore by clarifying value and budget", "A reason to drop the lead", "A request for a free trial"], correct: 1 },
      { topic: "Sales scenarios", text: "Which metric measures the share of leads that become customers?", options: ["Churn rate", "Conversion rate", "Average deal size", "Pipeline velocity"], correct: 1 },
      { topic: "Customer handling", text: "An angry customer calls about a delayed order. What should you do first?", options: ["Transfer the call", "Acknowledge the issue and empathise, then gather details", "Explain company policy", "Offer a refund immediately"], correct: 1 },
      { topic: "Customer handling", text: "Upselling means:", options: ["Selling to a new customer", "Offering a higher-value version or add-on of what the customer is buying", "Discounting", "Cold calling"], correct: 1 },
      { topic: "Customer handling", text: "Net Promoter Score (NPS) measures:", options: ["Revenue growth", "Customers' willingness to recommend you", "Support ticket volume", "Website traffic"], correct: 1 },
    ],
  },
  {
    level: 2,
    category: "hr",
    title: "Level 2 — Human Resources",
    description: "Recruitment, employee relations, HR policies and situational judgment.",
    durationMinutes: 15,
    passingPercent: 60,
    questionsPerAttempt: 8,
    questions: [
      { topic: "Recruitment", text: "Which interview format asks every candidate the same predefined questions?", options: ["Unstructured interview", "Structured interview", "Stress interview", "Group discussion"], correct: 1 },
      { topic: "Recruitment", text: "Time-to-hire measures:", options: ["Days between job approval and posting", "Days between a candidate entering the pipeline and accepting an offer", "Length of the interview", "Notice period"], correct: 1 },
      { topic: "Recruitment", text: "Which interview question is legally and ethically risky?", options: ["Tell me about a challenging project.", "Are you planning to have children?", "Why do you want this role?", "What are your salary expectations?"], correct: 1 },
      { topic: "Employee relations", text: "The first step in handling an employee grievance is usually to:", options: ["Issue a warning", "Listen to the employee and document the concern", "Escalate to legal", "Transfer the employee"], correct: 1 },
      { topic: "Employee relations", text: "Employee engagement is best described as:", options: ["Attendance rate", "Employees' emotional commitment to the organisation and its goals", "Number of trainings attended", "Salary satisfaction only"], correct: 1 },
      { topic: "HR policies", text: "Under India's Payment of Gratuity Act, gratuity generally requires how many years of continuous service?", options: ["1 year", "3 years", "5 years", "10 years"], correct: 2 },
      { topic: "HR policies", text: "The POSH policy in India relates to:", options: ["Payroll processing", "Prevention of sexual harassment at the workplace", "Probation rules", "Overtime"], correct: 1 },
      { topic: "Situational judgment", text: "A top performer is repeatedly late to meetings. The best approach is to:", options: ["Ignore it because of their performance", "Have a private conversation to understand the cause and set expectations", "Publicly call it out", "Issue a termination letter"], correct: 1 },
      { topic: "Situational judgment", text: "Two team members are in a conflict that affects delivery. As HR you should first:", options: ["Pick a side", "Meet them separately, then together, to understand perspectives and mediate", "Transfer one of them", "Wait for it to resolve itself"], correct: 1 },
      { topic: "Situational judgment", text: "An employee tells you a colleague is falsifying expense reports. You should:", options: ["Confront the colleague publicly", "Follow the company's confidential investigation process", "Ignore it without evidence", "Share it with the team"], correct: 1 },
    ],
  },
];
