export const initialJobs = [
  {
    id: "job-1",
    title: "Junior Python / AI Engineer",
    company: "Evalogical Systems",
    location: "Infopark, Kochi (Hybrid)",
    type: "Full Time",
    salary: "₹4.5 - ₹6.5 LPA",
    experience: "0 - 1 Year",
    skills: ["Python", "FastAPI", "PostgreSQL", "LangChain", "Docker"],
    posted: "1 day ago",
    description: "Looking for an energetic Junior Python / AI Engineer to contribute to internal generative AI tooling and REST microservices.",
    requirements: [
      "Proficiency in Python 3.10+ and modern OOP fundamentals",
      "Familiarity with FastAPI, Flask, or Django",
      "Understanding of SQL databases and RESTful API principles",
      "Enthusiasm for LLMs, prompt engineering, and RAG architectures"
    ]
  },
  {
    id: "job-2",
    title: "Data Analyst Trainee",
    company: "Sioniq Solutions",
    location: "Kakkanad, Kochi (On-site)",
    type: "Full Time",
    salary: "₹4.0 - ₹5.5 LPA",
    experience: "Fresher",
    skills: ["SQL", "PowerBI", "Python", "Excel", "Data Modeling"],
    posted: "2 days ago",
    description: "Join our core analytics team to transform unstructured operational metrics into actionable executive dashboards.",
    requirements: [
      "Solid command of SQL (Joins, Aggregations, Window Functions)",
      "Hands-on portfolio of PowerBI or Tableau reports",
      "Good communication and presentation skills"
    ]
  },
  {
    id: "job-3",
    title: "Java Full Stack Developer",
    company: "MariApps Marine Solutions",
    location: "Kochi, Kerala (On-site)",
    type: "Full Time",
    salary: "₹5.0 - ₹7.5 LPA",
    experience: "0 - 2 Years",
    skills: ["Java 17/21", "Spring Boot", "React.js", "MySQL", "REST"],
    posted: "3 days ago",
    description: "Build enterprise maritime ERP and logistics workflows with modern Spring Boot microservices and React.",
    requirements: [
      "Core Java, Spring Boot, Spring Security basics",
      "Experience with relational schemas and JPA / Hibernate",
      "Basic understanding of React components and state management"
    ]
  },
  {
    id: "job-4",
    title: "Associate HR Generalist",
    company: "Neologix Global",
    location: "Technopark, Trivandrum",
    type: "Full Time",
    salary: "₹3.8 - ₹5.0 LPA",
    experience: "0 - 1 Year",
    skills: ["Talent Acquisition", "HRMS", "Labour Laws", "Excel", "Payroll"],
    posted: "3 days ago",
    description: "Manage end-to-end recruitment pipelines, onboarding workflows, and statutory HR compliance.",
    requirements: [
      "Excellent interpersonal and business communication skills",
      "Familiarity with IT recruitment sourcing via LinkedIn Recruiter",
      "Knowledge of statutory compliance (PF, ESI) is a plus"
    ]
  },
  {
    id: "job-5",
    title: "Technical Sales Specialist",
    company: "Aion Pixel Innovations",
    location: "Remote / Hybrid (Kochi HQ)",
    type: "Full Time",
    salary: "₹4.5 - ₹8.0 LPA + Incentives",
    experience: "0 - 2 Years",
    skills: ["B2B SaaS", "Solution Selling", "HubSpot", "Negotiation", "Tech Acumen"],
    posted: "4 days ago",
    description: "Drive high-ticket B2B software engagements, lead technical demonstrations, and manage enterprise client conversions.",
    requirements: [
      "Strong technological literacy combined with persuasive consultative selling",
      "Experience running software product demos",
      "High target conviction and negotiation readiness"
    ]
  },
  {
    id: "job-6",
    title: "Cloud DevOps Associate",
    company: "ClaySys Technologies",
    location: "Infopark, Kochi",
    type: "Full Time",
    salary: "₹4.8 - ₹7.0 LPA",
    experience: "0 - 1 Year",
    skills: ["Linux", "Docker", "AWS", "CI/CD", "Bash", "Terraform"],
    posted: "5 days ago",
    description: "Support continuous integration and deployment pipelines, container clusters, and AWS cloud environments.",
    requirements: [
      "Solid Linux shell scripting and command line skills",
      "Hands-on experience dockerizing web applications",
      "Familiarity with GitHub Actions or Jenkins CI/CD"
    ]
  }
];

export function getJobById(id) {
  return initialJobs.find(j => j.id === id);
}
