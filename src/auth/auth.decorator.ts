import { Reflector } from '@nestjs/core';

export const AuthDec = Reflector.createDecorator<'anony-only'|'all'>();
