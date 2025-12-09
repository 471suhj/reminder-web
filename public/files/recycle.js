import {doFetch, showMessage} from '/printmsg.js';
import {fncRefresh, fncAutoloadSetup, sortMode, fncSetupHeaderSort} from '/autoload.js';
import {fncAddItems, fncRemoveItems} from '/filemove.js';

const list = document.getElementById('list');
const listHead = document.getElementById('listHead');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id, 'recycle');
fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

async function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='item${listItem.timestamp}${listItem.id}' data-id='${listItem.id}' data-timestamp='${listITem.timestamp}'>
            <input class='listItemChkbox listItemCol' type='checkbox'><!-
            ><div class='listItemType listItemCol'><img class='listItemCol isFolder' src='/graphics/toolbars/folder.png' width='15' height='15' style='display:none'></div><!-
            ><div class='listItemText listItemCol'>${listItem.text}</div><!-
            ><div class='listPath listItemCol'>${listItem.origPath}</div><!-
            ><div class='listDelDate listItemCol'>${listItem.dateDeleted}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, false, 2, numItemCnt, fncPrintCnt);
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
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', async function(){
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(listItem.dataset.id);
            }
        }
		let idCurLast = {id: '0', timestamp: new Date()};
		if (list.children.length !== 1){
			idCurLast.id = list.children[list.children.length - 2].dataset.id;
			idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
		}
        if (lstDeleteName.length > 0){
            await doFetch('', 'DELETE', JSON.stringify({action: 'permdel', last: idCurLast, sort: sortMode, files: lstDeleteName}), 
            '', '삭제에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.');
            });
        }
    });
}

{
    let tlbItem = document.getElementById('restore');
    tlbItem.addEventListener('click', async function(){
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(listItem.dataset.id);
            }
        }
		let idCurLast = {id: '0', timestamp: new Date()};
		if (list.children.length !== 1){
			idCurLast.id = list.children[list.children.length - 2].dataset.id;
			idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
		}

        if (lstDeleteName.length > 0){
            await doFetch('', 'PUT', JSON.stringify({action: 'restore', last: idCurLast, sort: sortMode, files: lstDeleteName}), 
            '', '삭제에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '복원에 실패한 항목이 있습니다.', '복원이 완료되었습니다.');
                if (jsnRes.alreadyExists){
                    alert('같은 파일명이 존재한 경우가 있었으며, 이 경우 파일명에 -2가 추가되었습니다.');
                }
            });
        }
    });
}