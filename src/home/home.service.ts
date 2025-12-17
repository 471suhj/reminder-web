import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { NotifType } from './notif-type.type';
import escape from 'escape-html';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket } from 'mysql2';

@Injectable()
export class HomeService {

    constructor(private readonly mysqlService: MysqlService){}

    getNotifLinkText(arrLink: [string, string][]): string{
        let strLink = '';
        for (const itm of arrLink){
            strLink += `<a src="${itm[1]}">${itm[0]}</a>&nbsp;&nbsp;`;
        }
        return strLink;
    }

    async getNotifText(userSer: number, mode: NotifType['itm'], data: any, time?: string, prev?: boolean): Promise<string>{
        let retStr = prev ? '' : time + '<br><br>'
        let senderName = '';
        if (typeof data.sender_ser === 'number'){
            await this.mysqlService.doQuery('home service getText', async conn=>{
                let [result] = await conn.execute<RowDataPacket[]>(
                    `select nickname from friend_mono where user_serial_from=? and user_serial_to=?`,
                    [data.sender_ser, userSer]
                );
                if (result.length > 0 && result[0].nickname !== ''){
                    senderName = result[0].nickname;
                } else {
                    [result] = await conn.execute<RowDataPacket[]>(
                        `select name, user_id from user where user_serial=?`, [data.sender_ser]
                    );
                    if (result.length <= 0){
                        senderName = '(탈퇴한 사용자)';
                    } else {
                        senderName = `${result[0].name} (${result[0].user_id})`;
                    }
                }
            });
        }
        switch (mode){
            case 'file_shared_hard':
                // need escaping
                let tmpStr = `${senderName}이(가) ${data.file_name} 파일의 `;
                tmpStr += `${data.mode === 'edit' ? '편집' : '읽기'} 권한을 공유했습니다. '공유된 파일' 폴더에서 해당 파일을 찾을 수 있습니다.`
                retStr += escape(tmpStr);
                if (prev) {break;}
                retStr += `<br><br><a href="/files/shared">폴더 열기</a>&nbsp;&nbsp;&nbsp;`;
                retStr += `<a href="/edit?id=${data.fileid}" target="_blank">파일 열기</a>`;
                break;
            case 'file_shared_inbox':
                retStr += escape(`${senderName}이(가) ${data.file_name} 파일의 사본을 공유했습니다. `);
                if (prev) {break;}
                retStr += '<br>';
                retStr += data.saved ? '파일이 받은 파일함에 저장되었습니다.' : '파일을 저장하려면 <span class="putlink" data-link="/files/inbox-save"';
                retStr += data.saved ? '' : `data-prop="id" data-val="${data.file_ser}" data-msgpos="저장이 완료되었습니다." data-msgneg="저장에 실패했습니다.">여기</span>를 누르십시오.`;
                retStr += data.saved ? '<br><br><a href="/files/inbox">받은 파일함 즐겨 찾기</a>' : '';
                break;
            case 'friend_request_accepted':
                retStr += escape(`${senderName}이(가) 친구로 추가되었습니다.`);
                break;
            case 'friend_request':
                retStr += escape(`${senderName}이(가) 친구 추가를 요청했습니다.`);
                if (prev){break;}
                retStr += `<br><br><span class="putlink" data-link="/friends/consent" data-prop="id" `;
                retStr += `data-val="${data.sender_ser}" data-msgpos="친구 추가가 완료되었습니다." data-msgneg="친구 추가에 실패했습니다.">승인</span>&nbsp;&nbsp;&nbsp;`;
                retStr += `<span class="putlink" data-link="/friends/reject" data-prop="id" `;
                retStr += `data-val="${data.sender_ser}" data-msgpos="친구 거절이 완료되었습니다." data-msgneg="친구 거절에 실패했습니다.">거절</span>`;
                break;
            case 'friend_request_rejected':
                retStr += escape(`${senderName}이(가) 친구 추가 요청을 거절했습니다.`);
                break;
            default:
                throw new InternalServerErrorException();
        }
        return retStr;
    }
}
