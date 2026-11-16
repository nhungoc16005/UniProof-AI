import { SetMetadata } from '@nestjs/common';

export const ALLOW_FIRST_LOGIN_KEY = 'allowFirstLogin';
export const AllowFirstLogin = () => SetMetadata(ALLOW_FIRST_LOGIN_KEY, true);
