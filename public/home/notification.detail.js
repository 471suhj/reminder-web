import {doFetch} from '/printmsg.js';
import {fncClearPopup} from '/popup.js';

const divPopup = document.getElementById('popup');

export function loadNotificationDetails(listItem, link){
    divPopup.style.display = 'block';
    doFetch(link, 'GET', '', '', '상세 정보 로드에 실패했습니다.', async function(result){
        const page = await result.text();
        divPopup.innerHTML = `
            <button id='popupClose__dlg'>닫기</button><br>
        ` + page;
        document.getElementById('popupClose__dlg').addEventListener('click', function(){
            fncClearPopup(divPopup);
        });
    }, () => {fncClearPopup(divPopup);});
}