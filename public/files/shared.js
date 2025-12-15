import {doFetch, showMessage} from '/printmsg.js';
import {fncShare, fncClearPopup} from '/popup.js';
import {fncRefresh, fncAutoloadSetup, sortMode, fncSetupHeaderSort} from '/autoload.js';
import {fncCopyMove, fncRemoveItems, fncAddItems, fncCreateOKCancel} from '/filemove.js';

sortMode.criteria = 'colOwner';
const listHead = document.getElementById('listHead');
const list = document.getElementById('list');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const divPopup = document.getElementById('popup');
const dlgOverwrite = document.getElementById('overwriteDlg');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id, 'shared');
fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

async function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = (listItem)=>{
        return `
        <div class='listItem grayLink' id='item${listItem.timestamp}${listItem.id}' data-id='${listItem.id}' data-timestamp='${listItem.timestamp}'>
            <input class='listItemChkbox listItemCol' type='checkbox'><!-
            ><div class='listOwnerImg listItemCol'><img class='listItemCol ownerImg' src='${listItem.ownerImg}' width='30' height='30' style='display:none'></div><!-
            ><div class='listOwner listItemCol'>${listItem.ownerName}</div><!-
            ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
            ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
	let objCnt = {numItemCnt};
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, true, 3, objCnt, fncPrintCnt);
	numItemCnt = objCnt.numItemCnt;
}

{
    let tlbItem = document.getElementById('selectAll');
    tlbItem.addEventListener('click', ()=>{
        let allchecked = true;
        for (const listItem of list.children){
            if (!listItem.firstElementChild.checked){
                allchecked = false;
            }
            listItem.firstElementChild.checked = true;
        }
        if (allchecked){
            for (const listItem of list.children){
                listItem.firstElementChild.checked = false;
            }
            tlbItem.checked = false;
        } else {
            tlbItem.checked = true;
        }
    });
}

{
    let tlbItem = document.getElementById('download');
    tlbItem.addEventListener('click', ()=>{
        open('./download', '_blank', 'popup=true');
    });
}

{
    let tlbItem = document.getElementById('share');
    tlbItem.addEventListener('click', async ()=>{
		await fncShare(divPopup, list);
    });
}

{
    let tlbItem = document.getElementById('up');
    tlbItem.addEventListener('click', async ()=>{
        window.location.href = '/files'
    })
}

{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', ()=>{
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push({id: Number(listItem.dataset.id), timestamp: new Date(listItem.dataset.timestamp)});
            }
        }
        if (lstDeleteName.length <= 0){
            showMessage('파일이 선택되지 않았습니다.');
            return;
        }
        if (!confirm('공유를 취소하시겠습니까?')){
            return;
        }
        divPopup.style.display = 'block';
        divPopup.appendChild('p').innerText = '전송할 메시지를 입력하십시오.';
        const txtMsg = divPopup.appendChild(document.createElement('textarea'));
        const cmdOK = fncCreateOKCancel(divPopup);
        cmdOK.addEventListener('click', async ()=>{
		let idCurLast = {id: 0, timestamp: new Date()};
		if (list.children.length !== 1){
			idCurLast.id = Number(list.children[list.children.length - 2].dataset.id);
			idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
		}
		const jsonBody = {action: 'unshare', last: idCurLast, sort: sortMode, files: lstDeleteName, message: txtMsg.value};
		fncClearPopup(divPopup);
			await doFetch('./manage', 'DELETE', JSON.stringify(jsonBody), 
			'', '공유 취소에 오류가 발생했습니다.', async (result)=>{
				const jsnRes = await result.json();
				let objCnt = {numItemCnt};
				await fncRemoveItems(jsnRes, fncPrintCnt, '공유 취소에 실패한 항목이 있습니다.', '공유 취소가 완료되었습니다.', objCnt);
				numItemCnt = objCnt.numItemCnt;
			});
        });
    });
}

{
    let tlbItem = document.getElementById('copy');
    tlbItem.addEventListener('click', async ()=>{
        await fncCopyMove('copy', '복사를 완료했습니다.', '복사를 실패했습니다.', '복사되지 않은 파일이 있습니다.', divPopup, list, dlgOverwrite);
    });
}

