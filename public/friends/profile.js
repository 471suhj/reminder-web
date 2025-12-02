import {doFetch, showMessage} from '/printmsg.js';
import {sortMode, fncSetupHeaderSort} from '/sortmode.js';
import {insertOpt, fncClearPopup} from '/popup.js';
import {fncRefresh, fncAutoloadSetup} from '/autoload.js';
import {fncCreateOKCancel, fncAddItems} from '/filemove.js';

sortMode.criteria = 'colDate';
const list = document.getElementById('list');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const lblNickname = document.getElementById('title');
const lblID = document.getElementById('friendID');
const divPopup = document.getElementById('popup');
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
            ><div class='listDateShared listItemCol'>${listItem.dateShared}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, list, strHtml, false, 2, lblLoadMore, numItemCnt, fncPrintCnt);
}

fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, lblNickname.dataset.id);

{
    let tlbItem = document.getElementById('rename');
    tlbItem.addEventListener('click', function(){
        let newNickname = prompt('수정할 닉네임을 입력해 주십시오.', lblNickname.innerText);
        if (!newNickname){
            return;
        }
        doFetch('', 'PUT', JSON.stringify({action: 'rename', id: lblID.innerText, newname: newNickname}),
            '닉네임 변경이 완료되었습니다.', '닉네임 변경에 실패했습니다.', function(){
                lblNickname.innerText = newNickname;
                return '';
            })
    })
}

{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', function(){
        let arrSelFiles = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                arrSelFiles.push(listItem.id);
            }
        }
        if (!arrSelFiles.length){
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
            const txtBody = JSON.stringify({action: 'selected', files: arrSelFiles, friend: lblID, sort: sortMode, message: txtMsg.value});
            fncClearPopup(divPopup);
            doFetch('', 'DELETE', txtBody,
                '공유가 취소되었습니다.', '공유 취소를 실패했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '공유 취소에 실패한 항목이 있습니다.', '공유 취소가 완료되었습니다.');
            });
        });
    });
}

{
    let tlbItem = document.getElementById('topShare');
    tlbItem.addEventListener('click', function(){
        divPopup.style.display = 'block';
        doFetch('./list?select=sepall', 'GET', '', '', '파일 목록을 불러올 수 없었습니다.', async function(result){
            const {optCopy, optShareRead} = insertOpt(divPopup, document);
            
            const txtPath = divPopup.appendChild(document.createElement('div'));
            const lstDir = divPopup.appendChild(document.createElement('select'));
            const lstFiles = divPopup.appendChild(document.createElement('select'));
            lstFiles.multiple = true;
            const cmdOK = fncCreateOKCancel(divPopup);

            const jsnRes = await result.json();
            txtPath.innerText = jsnRes.path;
            for (const listItem of jsnRes.dirarr){
                const ctlOption = lstDir.appendChild(document.createElement('option'));
                ctlOption.innerText = `${listItem.name}`;
            }
            for (const listItem of jsnRes.filearr){
                const ctlOption = lstFiles.appendChild(document.createElement('option'));
                ctlOption.innerText = `${listItem.name}`;
            }
            cmdOK.addEventListener('click', function(){
                if (!lstFiles.value){
                    showMessage('선택된 파일이 없습니다.')
                    return;
                }
                let shareMode = null;
                if (optCopy.checked){shareMode = 'copy'} else if (optShareRead) {shareMode = 'read'} else {shareMode = 'edit'} 

                let jsonBody = {action: 'share', mode: shareMode, sort: sortMode, files: arrSelFiles, fromPath: lstDir.value, file: lstFiles.value};
                doFetch('', 'POST', JSON.stringify(jsonBody), '', '공유를 실패했습니다.',
                    async function(result){
                        const jsnRes = await result.json();
                        fncClearPopup(divPopup);
                        return fncInsertFile(jsnRes, false, '공유가 완료되었습니다.', '공유되지 못한 파일이 있습니다.');
                    }
                ), fncClearPopup});
        }, () => {fncClearPopup(divPopup);});
    })
}

{
    let colItem = document.getElementById('removeFriend');
    colItem.addEventListener('click', async function(){
        if (!confirm('정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.')){
            return;
        }
        await doFetch('', 'DELETE', JSON.stringify({sort: sortMode, files: [lblID.innerText]}), 
        '', '삭제에 오류가 발생했습니다.', async function(result){
            const jsnRes = await result.json();
            if (jsnRes.failed.reason){
                return jsnRes.failed;
            } else if ((jsnRes.arr.length !== 1) || (jsnRes.failed.length > 0)){
                return '친구 최소에 실패했습니다.'
            } else {
                document.location.href = '/friends'
                alert('친구가 취소되었습니다.');
                return '';
            }
        });
    })
}

fncSetupHeaderSort(fncRefresh, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt, lblNickname.dataset.id);
