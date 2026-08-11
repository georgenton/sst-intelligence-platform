-- Refresh token reuse detection revokes a complete family by familyId.
CREATE INDEX "RefreshSession_familyId_idx" ON "RefreshSession"("familyId");
