import { UserCommonDto } from "src/user/user-common.dto";

export class PrefsGetDto extends UserCommonDto {
    side: {
        bookmarkChk: 'checked'|'',
        sharedChk: 'checked'|'',
    };
    home: {
        hisChk: 'checked'|'',
        recentChk: 'checked'|'',
        bookmarkChk: 'checked'|'',
        notifChk: 'checked'|'',
        sharedChk: 'checked'|'',
    }
    inbox: {
        saveChk: 'checked'|'',
    }
}