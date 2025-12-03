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

fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);
fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

function async fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='item${listItem.id}' data-id='${listItem.id}' data-timestamp='${listItem.timestamp}'>
            <input class='listItemChkbox listItemCol' type='checkbox'><!-
            ><div class='listOwnerImg listItemCol'><img class='listItemCol ownerImg' src='${listItem.ownerImg}' width='30' height='30' style='display:none'></div><!-
            ><div class='listOwner listItemCol'>${listItem.ownerName}</div><!-
            ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
            ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, true, 3, numItemCnt, fncPrintCnt);
}

{
    let tlbItem = document.getElementById('selectAll');
    tlbItem.addEventListener('click', function(){
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
    tlbItem.addEventListener('click', function(){
        open('./download', '_blank', 'popup=true');
    });
}

{
    let tlbItem = document.getElementById('share');
    tlbItem.addEventListener('click', async function(){
		await fncShare(divPopup, list);
    });
}

{
    let tlbItem = document.getElementById('up');
    tlbItem.addEventListener('click', async function(){
        window.location.href = '/files'
    })
}

{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', function(){
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
		const jsonBody = {action: 'bookmark', files: lstDeleteName};
		fncClearPopup(divPopup);
		await doFetch('./bookmark', 'DELETE', JSON.stringify(jsonBody), 
		'', '바로 가기 해제에 오류가 발생했습니다.', async function(result){
			const jsnRes = await result.json();
			fncRemoveItems(jsnRes, fncPrintCnt, '바로 가기 해제에 실패한 항목이 있습니다.', '');
		});
    });
}

{
    let tlbItem = document.getElementById('copy');
    tlbItem.addEventListener('click', function(){
        await fncCopyMove('copy', '복사를 완료했습니다.', '복사를 실패했습니다.', '복사되지 않은 파일이 있습니다.', divPopup, list, dlgOverwrite);
    });
}

