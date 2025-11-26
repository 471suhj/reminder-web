import { KeyObject } from 'node:crypto';

export class GetPWDto {
    id: string;
    password: string;
    key?: string;
    nokey?: "true";
}