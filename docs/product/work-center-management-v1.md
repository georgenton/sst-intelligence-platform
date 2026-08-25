# Work Center Management V1

The organization settings surface provides a center list, selected-center detail, name, city and
active/inactive lifecycle. Owner and Admin mutations remain server-authorized and plan capacity is
checked inside an organization-serialized transaction when creating or reactivating a center. There
is no delete endpoint. Capacity counts active centers. While a Solution Finder demo is active,
synthetic demo centers remain readable and do not consume the base plan's normal-center capacity;
normal centers still respect the effective plan limit. If the demo expires, its active synthetic
centers participate in the same effective capacity check for future create/reactivate mutations.
No center is deleted or deactivated automatically when demo state changes.

Inactivation prevents the center from being selected for new Inspection, Technical Risk and
Adaptive sessions. Existing records remain readable after rename or inactivation, but their center
identity follows two deliberate models: Inspection and Technical Risk keep the live WorkCenter
reference while preserving their own historical risk/method data; an Adaptive session persists the
center name and active state in `AdaptiveSessionScope`, and a recurrence Systemic Review persists
the center name plus related-finding risk snapshots. Renaming a center therefore changes its live
label without rewriting those persisted snapshots. Operational/adaptive facts such as height,
chemicals, confined space or process hazards are not stored on WorkCenter.
