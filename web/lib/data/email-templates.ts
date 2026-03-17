// Pre-built email templates for job seekers
// Use {{variable}} placeholders that get replaced with actual data

export interface EmailTemplateData {
  name: string;
  subject: string;
  body: string;
  category: "Follow Up" | "Thank You" | "Offer" | "General" | "Networking";
}

export const EMAIL_TEMPLATES: EmailTemplateData[] = [
  // ===== FOLLOW UP TEMPLATES =====
  {
    name: "Application Follow Up (1 Week)",
    category: "Follow Up",
    subject: "Following Up - {{position}} Application at {{company}}",
    body: `Dear {{contact_name}},

I hope this email finds you well. I recently applied for the {{position}} position at {{company}} and wanted to follow up on my application.

I am very excited about the opportunity to contribute to {{company}}'s team. My background in [your key skill/experience] aligns well with the requirements of this role, and I am confident I can make a meaningful impact.

I would welcome the opportunity to discuss how my skills and experience could benefit your team. Please let me know if you need any additional information from my end.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
{{your_name}}
{{your_phone}}
{{your_linkedin}}`,
  },
  {
    name: "Application Follow Up (2 Weeks)",
    category: "Follow Up",
    subject: "Checking In - {{position}} Role at {{company}}",
    body: `Dear {{contact_name}},

I wanted to follow up on my application for the {{position}} position at {{company}}, which I submitted two weeks ago.

I remain very interested in this opportunity and believe my experience in [relevant experience] would be valuable to your team. I would be happy to provide any additional information or references that might be helpful in your decision-making process.

Would it be possible to schedule a brief call to discuss the role further? I am flexible with timing and happy to accommodate your schedule.

Thank you for considering my application. I look forward to the possibility of contributing to {{company}}.

Best regards,
{{your_name}}`,
  },
  {
    name: "Post-Interview Follow Up",
    category: "Follow Up",
    subject: "Following Up - {{position}} Interview",
    body: `Dear {{contact_name}},

Thank you again for taking the time to interview me for the {{position}} position at {{company}} on {{interview_date}}.

I enjoyed learning more about the role and the exciting projects your team is working on. Our conversation reinforced my enthusiasm for this opportunity, and I am confident that my skills in [mention specific skills discussed] would allow me to contribute effectively to your team.

I wanted to follow up on the timeline for next steps. Please let me know if there is any additional information I can provide.

Thank you for your consideration. I look forward to hearing from you.

Best regards,
{{your_name}}`,
  },

  // ===== THANK YOU TEMPLATES =====
  {
    name: "Interview Thank You (Same Day)",
    category: "Thank You",
    subject: "Thank You - {{position}} Interview",
    body: `Dear {{contact_name}},

Thank you so much for taking the time to meet with me today to discuss the {{position}} position at {{company}}.

I thoroughly enjoyed our conversation about [specific topic discussed]. Learning more about {{company}}'s [mission/culture/projects] has made me even more excited about the possibility of joining your team.

I was particularly interested in [specific aspect of the role or company discussed], and I believe my experience with [relevant skill/project] would allow me to contribute immediately.

Please don't hesitate to reach out if you need any additional information. I look forward to hearing about the next steps.

Best regards,
{{your_name}}
{{your_email}}
{{your_phone}}`,
  },
  {
    name: "Panel Interview Thank You",
    category: "Thank You",
    subject: "Thank You for the Interview - {{position}} at {{company}}",
    body: `Dear {{company}} Team,

I wanted to extend my sincere thanks to everyone who took the time to meet with me regarding the {{position}} position.

It was a pleasure speaking with the team and learning more about the collaborative culture at {{company}}. The insights shared about [specific project or initiative mentioned] were particularly exciting, and I can see myself thriving in such an environment.

I am very enthusiastic about this opportunity and confident that my background in [relevant skills] would enable me to make meaningful contributions to your team.

Thank you again for your time and consideration.

Best regards,
{{your_name}}`,
  },
  {
    name: "Recruiter Thank You",
    category: "Thank You",
    subject: "Thank You for Your Time",
    body: `Dear {{contact_name}},

Thank you for speaking with me today about the {{position}} opportunity at {{company}}.

I appreciate you taking the time to explain the role in detail and share insights about the company culture. Based on our conversation, I am very excited about this opportunity and believe it would be an excellent fit for my skills and career goals.

I look forward to the next steps in the process. Please let me know if there is anything else you need from me.

Best regards,
{{your_name}}`,
  },

  // ===== OFFER TEMPLATES =====
  {
    name: "Offer Acceptance",
    category: "Offer",
    subject: "Re: Offer Letter - {{position}} at {{company}}",
    body: `Dear {{contact_name}},

I am thrilled to formally accept the offer for the {{position}} position at {{company}}. Thank you for this wonderful opportunity.

As discussed, I confirm the following:
- Start Date: {{start_date}}
- Salary: {{salary}}
- [Any other terms discussed]

I am excited to join the team and contribute to {{company}}'s success. Please let me know the next steps for onboarding, including any paperwork or documentation I should prepare.

Thank you again for this opportunity. I look forward to getting started.

Best regards,
{{your_name}}`,
  },
  {
    name: "Salary Negotiation Request",
    category: "Offer",
    subject: "Re: {{position}} Offer - Discussion Request",
    body: `Dear {{contact_name}},

Thank you so much for extending the offer for the {{position}} position at {{company}}. I am genuinely excited about this opportunity and can see myself contributing meaningfully to your team.

After careful consideration, I would like to discuss the compensation package. Based on my research of market rates for similar positions and my [X years] of experience in [relevant field], I was hoping we could explore a base salary of [desired amount].

I want to emphasize that {{company}} remains my top choice, and I am confident we can reach a mutually beneficial agreement. I am also open to discussing other aspects of the compensation package.

Would you be available for a brief call to discuss this further?

Thank you for your understanding and consideration.

Best regards,
{{your_name}}`,
  },
  {
    name: "Offer Decline (Polite)",
    category: "Offer",
    subject: "Re: {{position}} Offer at {{company}}",
    body: `Dear {{contact_name}},

Thank you so much for offering me the {{position}} position at {{company}}. I truly appreciate the time and effort you and the team invested in the interview process.

After careful consideration, I have decided to decline the offer. This was not an easy decision, as I was very impressed with {{company}} and the team. However, I have decided to pursue another opportunity that more closely aligns with my current career goals.

I have great respect for {{company}} and hope our paths may cross again in the future. I wish you and the team continued success.

Thank you again for your consideration.

Best regards,
{{your_name}}`,
  },

  // ===== NETWORKING TEMPLATES =====
  {
    name: "LinkedIn Connection Request",
    category: "Networking",
    subject: "Connecting with You",
    body: `Hi {{contact_name}},

I came across your profile while researching {{company}} and was impressed by your background in [their field/expertise].

I am currently exploring opportunities in [your field] and would love to connect and learn more about your experience at {{company}}. If you have a few minutes for a brief conversation, I would greatly appreciate your insights.

Thank you for considering my request.

Best regards,
{{your_name}}`,
  },
  {
    name: "Informational Interview Request",
    category: "Networking",
    subject: "Request for Informational Interview",
    body: `Dear {{contact_name}},

My name is {{your_name}}, and I am a [your profession/student] interested in [industry/field]. I found your profile through [how you found them] and was impressed by your experience at {{company}}.

I am reaching out to request a brief informational interview at your convenience. I would love to learn more about your career journey, the work at {{company}}, and any advice you might have for someone looking to enter this field.

I understand you are busy, so even 15-20 minutes of your time would be invaluable. I am happy to work around your schedule and can meet virtually or at a location convenient for you.

Thank you for considering my request.

Best regards,
{{your_name}}
{{your_linkedin}}`,
  },
  {
    name: "Referral Request",
    category: "Networking",
    subject: "Referral Request - {{position}} at {{company}}",
    body: `Hi {{contact_name}},

I hope this message finds you well! I noticed that {{company}} has an opening for a {{position}}, and I am very interested in applying.

Given your experience at {{company}}, I was wondering if you might be willing to refer me for this position or provide any insights about the team and role. I believe my background in [relevant experience] aligns well with what they're looking for.

I completely understand if you're not comfortable doing so, and I appreciate you considering my request either way.

Thank you for your time!

Best regards,
{{your_name}}`,
  },

  // ===== GENERAL TEMPLATES =====
  {
    name: "Withdraw Application",
    category: "General",
    subject: "Withdrawal - {{position}} Application",
    body: `Dear {{contact_name}},

I hope this email finds you well. I am writing to inform you that I would like to withdraw my application for the {{position}} position at {{company}}.

After careful consideration, I have decided to pursue another opportunity that more closely aligns with my career goals at this time. I sincerely appreciate the time and consideration you and your team have given to my application.

I have great respect for {{company}} and hope to have the opportunity to connect again in the future.

Thank you for your understanding.

Best regards,
{{your_name}}`,
  },
  {
    name: "Request for Application Status",
    category: "General",
    subject: "Application Status Inquiry - {{position}}",
    body: `Dear {{contact_name}},

I hope you're doing well. I recently applied for the {{position}} position at {{company}} and wanted to inquire about the status of my application.

I remain very interested in this opportunity and would appreciate any updates you can share regarding the hiring timeline or next steps in the process.

Please let me know if there is any additional information I can provide to support my application.

Thank you for your time.

Best regards,
{{your_name}}
{{your_email}}`,
  },
  {
    name: "Request for Feedback After Rejection",
    category: "General",
    subject: "Request for Feedback - {{position}} Interview",
    body: `Dear {{contact_name}},

Thank you for informing me about the decision regarding the {{position}} position at {{company}}. While I am disappointed, I appreciate the opportunity to have interviewed with your team.

If possible, I would greatly value any feedback you could share about my interview or application. Understanding areas where I can improve would be immensely helpful for my professional development.

I remain interested in {{company}} and would welcome the opportunity to be considered for future openings that match my qualifications.

Thank you again for your time and consideration.

Best regards,
{{your_name}}`,
  },
];

// Helper function to replace placeholders with actual values
export function populateTemplate(
  template: string,
  values: Record<string, string>
): string {
  let result = template;

  Object.entries(values).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}

// Get templates by category
export function getTemplatesByCategory(
  category: EmailTemplateData["category"]
): EmailTemplateData[] {
  return EMAIL_TEMPLATES.filter((t) => t.category === category);
}
