# API guide

Keep NestJS controllers limited to transport concerns. Application services enforce business rules
and are the only layer allowed to use Prisma. Every organization-bound service method receives an
organization ID from `OrganizationContext`, never from an unvalidated body. Apply authentication,
membership, role, and entitlement guards in that order. Return the common API error envelope and
never expose credential existence. Use transactions for cross-model state changes, UTC dates, UUIDs,
structured safe metadata, and explicit selects when handling secrets. Add integration coverage for
tenant isolation and token rotation. Do not add generic repositories or call AI providers from pure
business logic.
