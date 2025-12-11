import { UserCommonDto } from "src/user/user-common.dto";

export class AccountGetDto extends UserCommonDto {
    profImg: {
        defChk: 'checked'|'',
        cusChk: 'checked'|'',
    };
    profProp: {
        name: string,
        id: string,
        email: string,
        passwordExists: '존재'|'존재하지 않음',
    };
    google: {
        email: string, // 주소 또는 '연동되지 않음'
    }
}