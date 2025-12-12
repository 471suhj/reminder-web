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
		let links = document.getElementsByClassName('putlink');
		for (const itm of links){
			itm.addEventListener('click', async function(event){
				let req = {};
				req[itm.dataset.prop] = itm.dataset.val;
				await doFetch(itm.dataset.link, "PUT", JSON.stringify(req), '', '', async (result)=>{
					let jsnRes = await result.json();
					if (jsnRes.success){
						return itm.dataset.msgpos;
					} else if (jsnRes.failmessage) {
						return jsnRes.failmessage;
					} else {
						return itm.dataset.msgneg;
					}
				});
			});
		}
    }, () => {fncClearPopup(divPopup);});
}