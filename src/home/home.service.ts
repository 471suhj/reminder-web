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
            strLink += `<a href="${itm[1]}">${itm[0]}</a>&nbsp;&nbsp;`;
        }
        return strLink;
    }

    async getNotifText(userSer: number, mode: NotifType['itm'], data: any, time?: string, prev?: boolean): Promise<string>{
        let retStr = prev ? '' : time + '<br><br>'
        let senderName = '';
        if (typeof data.sender_ser === 'number'){
            await this.mysqlService.doQuery('home service getText', async conn=>{
                let [result_mono] = await conn.execute<RowDataPacket[]>(
                    `select nickname from friend_mono where user_serial_from=? and user_serial_to=?`,
                    [data.sender_ser, userSer]
                );
                let [result_info] = await conn.execute<RowDataPacket[]>(
                    `select name, user_id from user where user_serial=?`, [data.sender_ser]
                );
                if (result_mono.length > 0 && result_mono[0].nickname !== ''){
                    senderName = result_mono[0].nickname + ` (${result_info[0].user_id})`;
                } else {
                    if (result_info.length <= 0){
                        senderName = '(탈퇴한 사용자)';
                    } else {
                        senderName = `${result_info[0].name} (${result_info[0].user_id})`;
                    }
                }
            });
        }
        senderName = escape(senderName);
        switch (mode){
            case 'file_shared_hard':
                // need escaping
                retStr += '파일 공유: ' + escape(`${senderName}이(가) ${data.file_name} 파일의 `);
                retStr += `${data.mode === 'edit' ? '편집' : '읽기'} 권한을 공유했습니다. '공유된 파일' 폴더에서 해당 파일을 찾을 수 있습니다.`
                if (prev) {break;}
                if (data.message.trim().length > 0){
                    retStr += ` 다음은 ${senderName}이(가) 보낸 메시지입니다:<br>` + escape(data.message).replace('\n', '<br>') + '<br>';
                }
                retStr += `<br><br><a href="/files/shared">폴더 열기</a>&nbsp;&nbsp;&nbsp;`;
                retStr += `<a href="/edit?id=${data.fileid}" target="_blank">파일 열기</a>`;
                break;
            case 'file_shared_inbox':
                retStr += '파일 사본 공유: ' + escape(`${senderName}이(가) ${data.file_name} 파일의 사본을 공유했습니다. `);
                if (prev) {break;}
                if (data.message.trim().length > 0){
                    retStr += ` 다음은 ${senderName}이(가) 보낸 메시지입니다:<br>` + escape(data.message).replace('\n', '<br>') + '<br>';
                }
                retStr += '<br>';
                retStr += data.saved ? '파일이 받은 파일함에 저장되었습니다.' : '파일을 저장하려면 <span class="putlink" data-link="/files/inbox-save"';
                retStr += data.saved ? '' : `data-prop="id" data-val="${data.file_ser}" data-msgpos="저장이 완료되었습니다." data-msgneg="저장에 실패했습니다.">여기</span>를 누르십시오.`;
                retStr += data.saved ? '<br><br><a href="/files/inbox">받은 파일함</a>' : '';
                break;
            case 'file_unshared':
                retStr += '파일 공유 해제' + escape(`${senderName}이(가) ${data.file_name} 파일의 사본 공유를 해제했습니다. `);
                if (prev) {break;}
                retStr += `다음은 ${senderName}이(가) 보낸 메시지입니다:<br>` + escape(data.message).replace('\n', '<br>');
                break;
            case 'friend_request_accepted':
                retStr = '친구 요청 승낙 알림: ' + escape(`${senderName}이(가) 친구로 추가되었습니다.`);
                break;
            case 'friend_request':
                retStr += '친구 요청: ' + escape(`${senderName}이(가) 친구 추가를 요청했습니다.`);
                if (prev){break;}
                retStr += `<br><br><span class="putlink" data-link="/friends/consent" data-prop="id" `;
                retStr += `data-val="${data.sender_ser}" data-msgpos="친구 추가가 완료되었습니다." data-msgneg="친구 추가에 실패했습니다.">승인</span>&nbsp;&nbsp;&nbsp;`;
                retStr += `<span class="putlink" data-link="/friends/reject" data-prop="id" `;
                retStr += `data-val="${data.sender_ser}" data-msgpos="친구 거절이 완료되었습니다." data-msgneg="친구 거절에 실패했습니다.">거절</span>`;
                break;
            case 'friend_request_rejected':
                retStr += '친구 요청 거절 알림: ' + escape(`${senderName}이(가) 친구 추가 요청을 거절했습니다.`);
                break;
            default:
                throw new InternalServerErrorException();
        }
        return retStr;
    }
}
