import {doFetch} from "/printmsg.js"
import {fncClearPopup} from "/popup.js"

export function loadNotificationDetails(divPopup, listItem, link){
    divPopup.style.display = "block";
    doFetch(link, "GET", "", "", "상세 정보 로드에 실패했습니다.", async function(result){
        const page = await result.text();
        divPopup.innerHTML = `
            <button id="popupClose">닫기</button>
        ` + page;
        document.getElementById("popupClose").addEventListener("click", function(){
            fncClearPopup(divPopup);
        });
    }, () => {fncClearPopup(divPopup);});
}