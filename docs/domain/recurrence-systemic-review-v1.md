# Recurrence systemic review V1

Marking a recurrence signal as reviewed persists who/when and does not resolve or delete it. A
recurrence alert may create one tenant-private `InspectionSystemicReview`. Its immutable start
snapshot records organization, work-center identity/name, category, recurrence window, related
finding IDs and each finding's initial/residual values plus method identity/version.

The finite lifecycle is OPEN, IN_REVIEW, COMPLETED or CANCELED. Completion records whether punctual
actions appear sufficient, whether broader review is recommended, optional notes and suspected
factors entered by a professional. The product never infers or stores an automatic root cause.
Completion does not alter alerts, findings, historical risk, applicability or obligations.

Values from different methods are displayed with their method identities and are never combined or
compared as if their numeric scales were equivalent.
