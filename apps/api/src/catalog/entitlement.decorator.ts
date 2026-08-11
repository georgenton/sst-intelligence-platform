import { SetMetadata } from '@nestjs/common';

export const ENTITLEMENT_KEY = 'required_entitlement';
export const RequireEntitlement = (featureKey: string) => SetMetadata(ENTITLEMENT_KEY, featureKey);
