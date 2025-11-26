import {doFetch} from '/printmsg.js';
import {loadNotificationDetails} from './notification.detail.js';

const list = document.getElementById('list');
const lblItemCnt = document.getElementById('newItemCount');
const divPopup = document.getElementById('popup');
const cmdLoadMore = document.getElementById('loadMore');
let linkID = 0;

let unreadCnt = 0;
let itemCnt = Number(lblItemCnt.dataset.itemcnt);
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
    lblItemCnt.innerText += `총 ${itemCnt}개의 알림이 있습니다. 알림은 최근 100개만 저장됩니다.`;
}

async function fncLoadMore(){
    if (cmdLoadMore.dataset.enabled === 'false'){ // never test for 'true'. may be undefined
        return;
    } else {
        cmdLoadMore.dataset.enabled = 'false';
    }
    await doFetch('./notifications/loadMore', 'GET', '', '', '로드 과정에 오류가 발생했습니다.', async function(result){
        let jsnRes = await result.json();
        for (const listItem of jsnRes.arr){
            list.insertAdjacentHTML('beforeend', `
                    <div class='listItem grayLink' id='${listItem.id}' data-unread='${listItem.unread}'>
                        <input  type='checkbox'><label class='listItemChk'for='${listItem.id}'>  ${listItem.date}</label>
                        <div class='listItemText'><br>${listItem.text}</div><br>
                        <div class='listItemDetails' id='listDetail_${linkID}'>상세 보기</div>
                    </div>
                `);
            document.getElementById('listDetail_' + String(linkID)).addEventListener('click', function(){
                loadNotificationDetails(divPopup, listItem, listItem.link);
            });
            linkID++;
        }
        if (jsnRes.loadMore === 'false'){
            cmdLoadMore.style.display = 'none';
            document.body.appendChild(cmdLoadMore);
        }
        printItemCnt(false);
        return '';
    });
    cmdLoadMore.dataset.enabled = 'true';
}
cmdLoadMore.addEventListener('click', fncLoadMore);

async function fncInitLoad(){
    await fncLoadMore();

    for (const listItem of list.children){
        listItem.addEventListener('click', function(event){
            const listChkbox = listItem.firstElementChild;
            if (event.target !== listChkbox){
                listChkbox.checked = !listChkbox.checked;
            }    
        });    
        if (listItem.dataset.unread === 'true'){
            unreadCnt++;
        }    
    }
    printItemCnt(true);
}

fncInitLoad();

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
                lstDeleteName.push(listItem.id);
            }
        }
        if (lstDeleteName.length > 0){
            doFetch('./notifications/update', 'DELETE', JSON.stringify({action: 'delete', files: lstDeleteName}), 
            '', '삭제에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.');
            });
        }
    });
}

{
    let tlbItem = document.getElementById('deleteAll');
    tlbItem.addEventListener('click', async function(){
        doFetch('./notifications/update', 'DELETE', JSON.stringify({action: 'deleteAll'}), '삭제가 완료되었습니다.', '삭제에 오류가 발생했습니다.', async function(result){            
            const jsnRes = await result.json();
            if (jsnRes.failed){
                return '삭제에 오류가 발생했습니다.'
            }
            for (let i = list.children.length - 1; i >= 0; i--){
                try{
                    list.children[i].remove();
                } catch {}
            }
            itemCnt = 0;
            printItemCnt(false);
            cmdLoadMore.style.display = 'none';
            document.body.appendChild(cmdLoadMore);
            return '';
        });
    });
}
