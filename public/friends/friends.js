import {doFetch, showMessage} from '/printmsg.js';
import {sortMode, fncSetupHeaderSort} from '/sortmode.js';
import {fncRefresh, fncAutoloadSetup} from '/autoload.js';
import {fncAddItems} from '/filemove.js';

const list = document.getElementById('list');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const tlbSort = document.getElementById('tlbSort');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='${listItem.id}'>
            <input class='listItemChkbox' type='checkbox'>
            <div class='listBlock'>
                <img src='${listItem.profileimg}' width='25' height='25'><!-
                ><div class='listItemText listItemCol'>${listItem.nickname}</div><div class='listItemCol listSpecs'>(${listItem.name})</div><!-
                ><div class='listSpecs'>${listItem.userid}</div><!-
                ><div class='listSpecs'>${listItem.sharedFiles}</div>
            </div>
        </div>`;
    }
    fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, list, strHtml, false, 2, lblLoadMore, numItemCnt, fncPrintCnt);
}

fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, lblTitle.dataset.path);

{
    let tlbItem = document.getElementById('upload');
    tlbItem.addEventListener('click', function(){
        const friendID = prompt('추가할 친구의 ID를 입력하십시오.');
        if (!friendID){
            return;
        }
        doFetch('', 'PUT', JSON.stringify({action: 'add', id: friendID}), '', '친구 추가를 실패했습니다.',
        async function(result){
            return fncInsertFile(await result.json(), false, '친구 추가를 완료했습니다.', '친구 추가를 실패했습니다.');
        });
    });
}
{
    let tlbItem = document.getElementById('rename');
    tlbItem.addEventListener('click', function(){
        let divSelected = null;
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                if (divSelected){
                    showMessage('한 개의 항목만 선택해 주십시오.')
                    divSelected = null;
                    break;
                } else {
                    divSelected = listItem;
                }
            }
        }
        if (!divSelected){
            return;
        }
        const newName = prompt(`${divSelected.children[1].children[2].innerText.slice(1, -1)}의 새 닉네임을 입력해 주세요.`, divSelected.children[1].children[1].innerText);
        doFetch('', 'PUT', JSON.stringify({action: 'rename', id: divSelected.children[1].children[3].innerText, newname: newName}),
            '닉네임 변경이 완료되었습니다.', '닉네임 변경을 실패했습니다.', function(){
                divSelected.children[1].children[1].innerText = newName;
                return '';
            })
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
        if ((lstDeleteName.length <= 0) || !confirm('정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.')){
            return;
        }
        doFetch('', 'DELETE', JSON.stringify({sort: sortMode, files: lstDeleteName}), 
        '', '삭제에 오류가 발생했습니다.', async function(result){
            const jsnRes = await result.json();
            fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.');
        });
    });
}

fncSetupHeaderSort(fncRefresh, document.getElementById('tlbSort'), lblLoadMore, list, fncInsertFile, fncPrintCnt, lblTitle.dataset.path);
