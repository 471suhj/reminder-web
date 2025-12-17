import {doFetch} from '/printmsg.js';
import {loadNotificationDetails} from './notification.detail.js';
import {fncRemoveItems} from '/filemove.js';

const list = document.getElementById('list');
const lblItemCnt = document.getElementById('newItemCount');
const divPopup = document.getElementById('popup');
const cmdLoadMore = document.getElementById('loadMore');
let linkID = 0;

let unreadCnt = 0;
let numItemCnt = Number(lblItemCnt.dataset.itemcnt);

cmdLoadMore.addEventListener('click', fncLoadMore);
fncInitLoad();

function printItemCnt(printNew){
    if (printNew){
        if (unreadCnt){
            lblItemCnt.innerText = `${unreadCnt}개의 새 알림이 있습니다.\n`;
        } else{
            lblItemCnt.innerText = '새 알림이 없습니다.\n';
        }
    } else {
        lblItemCnt.innerText = '';
    }
    lblItemCnt.innerText += `총 ${numItemCnt}개의 알림이 있습니다. 알림은 100일 동안만 저장됩니다.`;
}

async function fncLoadMore(){
    if (cmdLoadMore.dataset.enabled === 'false'){ // never test for 'true'. may be undefined
        return;
    } else {
        cmdLoadMore.dataset.enabled = 'false';
    }
	const items = Array.from(list.children);
	let idCurLast = 0;
	if (items.length > 0){
		idCurLast = items.at(-1).dataset.id;
	}
    await doFetch('/home/notifications/loadmore?last=' + idCurLast, 'GET', '', '', '로드 과정에 오류가 발생했습니다.', async function(result){
        let jsnRes = await result.json();
		unreadCnt += jsnRes.unreadCnt;
        for (const listItem of jsnRes.arr){
            list.insertAdjacentHTML('beforeend', `
                    <div class='listItem grayLink' id='item${listItem.id}' data-id='${listItem.id}' data-unread='${listItem.unread}'>
                        <input  type='checkbox'><label class='listItemChk'for='${listItem.id}'>  ${new Date(listItem.date).toLocaleString()}</label>
                        <div class='listItemText'><br><span id='content${listItem.id}'></span><br>${listItem.linkText}</div><br>
                        <div class='listItemDetails' id='listDetail_${linkID}'>상세 보기</div>
                    </div>
                `);
			document.getElementById('content' + listItem.id).innerText = listItem.text;
            document.getElementById('listDetail_' + String(linkID)).addEventListener('click', function(){
                loadNotificationDetails(listItem, listItem.link);
            });
			const itm = document.getElementById('item' + listItem.id);
			itm.addEventListener('click', function(event){
				const listChkbox = itm.firstElementChild;
				if (event.target !== listChkbox){
					itm.checked = !itm.checked;
				}    
			});
            linkID++;
        }
        if (jsnRes.loadMore === 'false'){
            cmdLoadMore.style.display = 'none';
            document.body.appendChild(cmdLoadMore);
        }
        printItemCnt(true);
    });
    cmdLoadMore.dataset.enabled = 'true';
}

async function fncInitLoad(){
    await fncLoadMore();
    printItemCnt(true);
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
        if (lstDeleteName.length > 0){
            doFetch('/home/notifications/update', 'DELETE', JSON.stringify({action: 'selected', files: lstDeleteName}), 
            '', '삭제에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
				let objCnt = {numItemCnt};
                await fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.', objCnt);
				numItemCnt = objCnt.numItemCnt;
            });
        }
    });
}

{
    let tlbItem = document.getElementById('deleteAll');
    tlbItem.addEventListener('click', async function(){
		if (list.children.length <= 0){
			return;
		}
        doFetch('./notifications/update', 'DELETE', JSON.stringify({action: 'all', first: list.children[0].dataset.id}), '삭제가 완료되었습니다.', '삭제에 오류가 발생했습니다.', async function(result){            
            const jsnRes = await result.json();
            if (jsnRes.failed.length > 0){
                return '삭제에 오류가 발생했습니다.'
            }
            for (let i = list.children.length - 1; i >= 0; i--){
                try{
                    list.children[i].remove();
                } catch {}
            }
            numItemCnt = 0;
            printItemCnt(false);
            cmdLoadMore.style.display = 'none';
            document.body.appendChild(cmdLoadMore);
        });
    });
}
