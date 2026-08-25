# Work Center Management V1

The organization settings surface provides a center list, selected-center detail, name, city and
active/inactive lifecycle. Owner and Admin mutations remain server-authorized and plan capacity is
checked when creating a center. There is no delete endpoint.

Inactivation prevents the center from being selected for new Inspection, Technical Risk and
Adaptive sessions. Existing inspections, findings, technical assessments and adaptive scope
snapshots remain readable after rename or inactivation. Operational/adaptive facts such as height,
chemicals, confined space or process hazards are not stored on WorkCenter.
