import {doFetch, showMessage} from '/printmsg.js';
import {sortMode, fncSetupHeaderSort} from '/sortmode.js';
import {insertOpt, fncClearPopup} from '/popup.js';
import {fncRefresh, fncAutoloadSetup} from '/autoload.js';
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

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='${listItem.id}'>
            <input class='listItemChkbox listItemCol' type='checkbox'><!-
            ><div class='listOwnerImg listItemCol'><img class='listItemCol ownerImg' src='${listItem.ownerImg}' width='30' height='30' style='display:none'></div><!-
            ><div class='listOwner listItemCol'>${listItem.ownerName}</div><!-
            ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
            ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, list, strHtml, true, 3, lblLoadMore, numItemCnt, fncPrintCnt);
}

fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

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
        divPopup.style.display = 'block';
        let arrSelFiles = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                arrSelFiles.push(listItem.id);
            }
        }
        if (!arrSelFiles.length){
            showMessage('파일이 선택되지 않았습니다.');
            fncClearPopup(divPopup);
            return;
        }
        doFetch('/friends/list', 'GET', '', '', '친구 목록을 불러올 수 없었습니다.', async function(result){
            const {optCopy, optShareRead} = insertOpt(divPopup, document);
            
            const txtSearch = divPopup.appendChild(document.createElement('input'));
            txtSearch.type = 'text';
            txtSearch.placeholder = '검색';
            const lstFriends = divPopup.appendChild(document.createElement('select'));
            lstFriends.setAttribute('multiple', 'true');

            const cmdOK = fncCreateOKCancel(divPopup);
            
            const jsnRes = await result.json();
            for (const listItem of jsnRes.arr){
                const ctlOption = lstFriends.appendChild(document.createElement('option'));
                ctlOption.innerText = `${listItem.name} (${listItem.id})`;
                ctlOption.dataset.userid = listItem.id;
            }
            txtSearch.addEventListener('keydown', function(event){
                const strSearch = event.target.value.toLowerCase();
                let itmSearch = null;
                for (const listItem of lstFriends.children){
                    if (listItem.dataset.userid.toLowerCase() >= strSearch){
                        itmSearch = listItem;
                        break;
                    } 
                }
                if (itmSearch){
                    itmSearch.scrollIntoView();
                }
            });
            cmdOK.addEventListener('click', function(event){
                if (!lstFriends.value){
                    showMessage('선택된 친구가 없습니다.')
                    return;
                }
                let shareMode = null;
                if (optCopy.checked){shareMode = 'copy'} else if (optShareRead) {shareMode = 'read'} else {shareMode = 'edit'} 
                const jsonBody = {action: 'share', mode: shareMode, files: arrSelFiles, friends: lstFriends.value};
                fncClearPopup(divPopup);
                doFetch('', 'PUT', JSON.stringify(jsonBody), '',
                    '공유에 실패했습니다.', async function(result){
                        const jsnRes = result.json();
                        for (const listItem of jsnRes.arr){
                            document.getElementById(listItem.id).children[4].innerText = listItem.friends;
                        }
                        if (jsnRes.failed.reason){
                            return jsnRes.failed;
                        } else if (jsnRes.failed.length > 0){
                            return '공유에 실패한 항목이 있었습니다.';
                        } else {
                            return '공유가 완료되었습니다.';
                        }
                    }
                )});
        }, () => {fncClearPopup(divPopup);});
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
                lstDeleteName.push(listItem.id);
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
        cmdOK.addEventListener('click', function(){
            const jsonBody = {action: 'selected', sort: sortMode, files: lstDeleteName, message: txtMsg.value};
            fncClearPopup(divPopup);
            doFetch('', 'DELETE', JSON.stringify(jsonBody), 
            '', '공유 취소에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '공유 취소에 실패한 항목이 있습니다.', '공유 취소가 완료되었습니다.');
            });
        });
    });
}

{
    let tlbItem = document.getElementById('copy');
    tlbItem.addEventListener('click', function(){
        fncCopyMove('copy', '복사를 완료했습니다.', '복사를 실패했습니다.', '복사되지 않은 파일이 있습니다.', divPopup, list, dlgOverwrite);
    });
}

fncSetupHeaderSort(fncRefresh, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);
