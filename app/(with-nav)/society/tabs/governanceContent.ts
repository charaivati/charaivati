const DESCRIPTIONS: Record<string, string> = {
  water:
    "Clean, reliable water supply prevents disease and supports daily life. Governance should ensure safe sources, regular maintenance, quality checks, and fair distribution for all neighborhoods.",
  electricity:
    "Reliable electricity powers homes, schools, clinics, and small businesses. Local systems must reduce outages, maintain infrastructure, and respond quickly to faults.",
  roads:
    "Roads and drainage affect safety, transport, and flooding risk. Governance should prioritize repair cycles, proper stormwater flow, and safe access for all seasons.",
  sanitation:
    "Sanitation protects public health and dignity. Governance must ensure waste collection, clean public spaces, sewage handling, and regular hygiene awareness.",
  health:
    "Primary health services are the first safety net for families. Governance should maintain medicine availability, staffing, outreach, and timely referrals.",
  education:
    "Primary education builds long-term social and economic strength. Governance should ensure teacher attendance, basic facilities, learning materials, and student support.",
  environment:
    "A healthy local environment reduces pollution and climate risks. Governance should encourage green cover, waste segregation, water-body protection, and local monitoring.",
  budget:
    "Public budgets determine which services improve first. Governance should publish clear priorities, spending updates, and create transparent channels for citizen feedback.",
  publicSafety:
    "Public safety systems reduce risk for communities. Governance should coordinate policing, emergency response, lighting, and community-level prevention programs.",
  localEconomy:
    "A strong local economy improves income opportunities and resilience. Governance should support markets, MSMEs, skilling access, and small enterprise infrastructure.",
  landRecords:
    "Accurate land records reduce disputes and improve service delivery. Governance should ensure transparent records, easier correction processes, and clear citizen support.",
  transport:
    "Transport systems connect people to jobs, schools, and healthcare. Governance should improve route quality, safety standards, affordability, and accessibility.",
  policyImplementation:
    "Policy implementation quality decides real outcomes on the ground. Governance should track progress, remove bottlenecks, and communicate status to citizens.",
  grievanceRedressal:
    "Grievance systems help citizens resolve issues quickly. Governance should maintain clear complaint channels, response timelines, and accountability tracking.",
  welfareDelivery:
    "Welfare delivery should be timely and inclusive. Governance must reduce exclusion errors and ensure benefits reach intended households.",
  climateReadiness:
    "Climate readiness helps communities handle heat, floods, and disruptions. Governance should plan adaptation actions and strengthen local resilience.",
  stateFinance:
    "State finance decisions shape major public services. Governance should prioritize responsible spending, transparency, and long-term social outcomes.",
  healthcareSystems:
    "State healthcare systems must integrate hospitals, primary centers, and public health programs. Governance should focus on capacity and service quality.",
  schoolSystems:
    "State school systems require sustained quality improvements. Governance should support teachers, infrastructure, and measurable learning outcomes.",
  infrastructure:
    "Large infrastructure affects productivity and regional development. Governance should ensure quality execution, maintenance, and public utility.",
};

export function getTopicDescription(topicId: string): string {
  return (
    DESCRIPTIONS[topicId] ||
    "This topic influences everyday governance outcomes. Strong civic monitoring and responsive public systems improve service quality and trust."
  );
}
