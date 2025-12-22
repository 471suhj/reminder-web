import { Injectable } from '@nestjs/common';
import { SESv2Client, ListTenantsCommand } from "@aws-sdk/client-sesv2";

@Injectable()
export class AwsService {

    client: SESv2Client;

    constructor(){
        this.client = new SESv2Client({ region: "ap-northeast-2" });
    }
}
