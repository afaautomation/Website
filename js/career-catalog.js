/* Shared candidate and HR career options. */
(function(root) {
  const unknown = "I don't know yet";
  const areas = {
    'Technology & Data': {
      'Software Development': ['HTML / CSS', 'JavaScript', 'Python', 'Java', 'Git', 'SQL', 'Testing'],
      'Data Analytics': ['Excel', 'SQL', 'Python', 'Power BI', 'Tableau', 'Statistics'],
      'AI & Machine Learning': ['Python', 'Statistics', 'Machine Learning', 'Deep Learning', 'Data Preparation'],
      'Cyber Security': ['Networking', 'Linux', 'Security Monitoring', 'Risk Assessment', 'Ethical Hacking'],
      'Cloud & IT Support': ['IT Troubleshooting', 'Networking', 'Linux', 'Cloud Platforms', 'Technical Support']
    },
    'Business & Management': {
      'Human Resources & Recruitment': ['Recruitment', 'Interviewing', 'HR Operations', 'Payroll', 'Excel'],
      'Business Analysis': ['Requirements Gathering', 'Process Mapping', 'Excel', 'SQL', 'Reporting'],
      'Project Management': ['Project Planning', 'Agile / Scrum', 'Budgeting', 'Risk Management', 'Reporting'],
      'Operations & Entrepreneurship': ['Operations Planning', 'Market Research', 'Budgeting', 'Process Improvement', 'Excel']
    },
    'Marketing & Sales': {
      'Digital Marketing': ['SEO', 'Social Media Marketing', 'Google Ads', 'Analytics', 'Content Creation'],
      'Sales & Business Development': ['Prospecting', 'CRM Tools', 'Sales Presentations', 'Lead Generation', 'Account Management'],
      'Brand & Content Marketing': ['Copywriting', 'Content Strategy', 'Market Research', 'Canva', 'Brand Management']
    },
    'Finance & Accounting': {
      'Accounting & Taxation': ['Bookkeeping', 'Tally', 'GST', 'Excel', 'Financial Statements'],
      'Banking & Financial Services': ['Financial Products', 'Customer Service', 'Credit Analysis', 'Excel', 'Compliance'],
      'Financial Analysis': ['Financial Modelling', 'Excel', 'Budgeting', 'Valuation', 'Data Analysis']
    },
    'Design & Media': {
      'UI / UX Design': ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
      'Graphic Design': ['Photoshop', 'Illustrator', 'Canva', 'Typography', 'Layout Design'],
      'Video & Animation': ['Video Editing', 'Motion Graphics', 'Storyboarding', 'After Effects', '3D Modelling'],
      'Journalism & Writing': ['Writing', 'Editing', 'Research', 'Interviewing', 'Fact Checking']
    },
    'Engineering & Construction': {
      'Mechanical & Manufacturing': ['CAD', 'Engineering Drawing', 'Manufacturing Processes', 'Quality Control', 'Maintenance'],
      'Civil Engineering & Construction': ['AutoCAD', 'Site Supervision', 'Estimation', 'Surveying', 'Project Planning'],
      'Electrical & Electronics': ['Circuit Design', 'Electrical Testing', 'PLC', 'Embedded Systems', 'Troubleshooting'],
      'Architecture & Interior Design': ['AutoCAD', 'SketchUp', 'Revit', 'Space Planning', 'Rendering']
    },
    'Healthcare & Life Sciences': {
      'Nursing & Patient Care': ['Patient Care', 'Clinical Documentation', 'First Aid', 'Infection Control'],
      'Allied Health & Diagnostics': ['Laboratory Techniques', 'Medical Equipment', 'Quality Control', 'Clinical Documentation'],
      'Pharmacy & Life Sciences': ['Pharmacology', 'Laboratory Techniques', 'Research', 'Quality Assurance'],
      'Healthcare Administration': ['Hospital Operations', 'Medical Records', 'Scheduling', 'Billing', 'Excel']
    },
    'Education & Social Impact': {
      'Teaching & Training': ['Lesson Planning', 'Subject Knowledge', 'Classroom Management', 'Assessment', 'Online Teaching'],
      'Research': ['Literature Review', 'Data Collection', 'Statistics', 'Academic Writing'],
      'Social Work & Community Development': ['Community Outreach', 'Case Documentation', 'Programme Planning', 'Research']
    },
    'Hospitality, Travel & Service': {
      'Hospitality & Tourism': ['Guest Relations', 'Reservations', 'Travel Planning', 'Hotel Operations'],
      'Culinary & Food Services': ['Food Preparation', 'Food Safety', 'Menu Planning', 'Inventory Management'],
      'Customer Support': ['Customer Service', 'CRM Tools', 'Ticketing Systems', 'Product Knowledge']
    },
    'Logistics, Retail & Supply Chain': {
      'Logistics & Supply Chain': ['Inventory Management', 'Procurement', 'Excel', 'Warehouse Operations', 'ERP Tools'],
      'Retail & E-commerce': ['Merchandising', 'Customer Service', 'Product Listings', 'Inventory Management', 'Sales Reporting']
    },
    'Law & Public Services': {
      'Legal & Compliance': ['Legal Research', 'Drafting', 'Compliance', 'Case Analysis'],
      'Public Administration': ['Policy Research', 'Administration', 'Documentation', 'Public Service']
    },
    'Agriculture & Environment': {
      'Agriculture & Food Technology': ['Crop Management', 'Food Safety', 'Quality Testing', 'Farm Operations'],
      'Environment & Sustainability': ['Environmental Research', 'Data Collection', 'GIS', 'Sustainability Reporting']
    }
  };
  const softSkills = ['Communication', 'Teamwork', 'Problem-solving', 'Time management', 'Adaptability', 'Critical thinking', 'Leadership', 'Empathy', 'Creativity', 'Negotiation', 'Attention to detail', 'Presentation skills', unknown];

  root.CareerCatalog = { areas, softSkills: softSkills.filter(s => s !== unknown) };
})(typeof window === 'undefined' ? globalThis : window);
