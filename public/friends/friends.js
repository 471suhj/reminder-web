import {doFetch, showMessage} from '/printmsg.js';
import {fncRefresh, fncAutoloadSetup, sortMode, fncSetupHeaderSort} from '/autoload.js';
import {fncAddItems, fncRemoveItems} from '/filemove.js';

const list = document.getElementById('list');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const tlbSort = document.getElementById('tlbSort');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id, 'friends');
fncSetupHeaderSort(document.getElementById('tlbSort'), fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

async function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = (listItem)=>{
        return `
        <div class='listItem grayLink' id='item${listItem.id}' data-id='${listItem.id}' data-name='${listItem.name}'>
            <input class='listItemChkbox' type='checkbox'>
            <div class='listBlock'>
                <img src='${listItem.profileimg}' width='25' height='25'><!-
                ><div class='listItemText listItemCol'>${listItem.nickname}</div><div class='listItemCol listSpecs'>(${listItem.name})</div><!-
                ><div class='listSpecs'>${listItem.userid}</div><!-
                ><div class='listSpecs'>${listItem.sharedFiles}</div>
            </div>
        </div>`;
    }
	let objCnt = {numItemCnt};
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, false, 2, objCnt, fncPrintCnt);
	numItemCnt = objCnt.numITemCnt;
}

{
    let tlbItem = document.getElementById('upload');
    tlbItem.addEventListener('click', async function(){
        const friendID = prompt('추가할 친구의 ID를 입력하십시오.');
        if (!friendID){
            return;
        }
        await doFetch('./add', 'PUT', JSON.stringify({id: friendID}), '', '친구 추가를 실패했습니다.',
        async function(result){
			let jsnRes = await result.json();
				if (jsnRes.success){
					showMessage('친구 추가 요청이 완료되었습니다. 상대방이 승낙할 경우 친구로 추가됩니다.');
				} else if (jsnRes.failmessage) {
					showMessage(jsnRes.failmessage);
				} else {
					showMessage('친구 추가 요청에 실패했습니다.');
				}
        });
    });
}
{
    let tlbItem = document.getElementById('rename');
    tlbItem.addEventListener('click', async function(){
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
        await doFetch('', 'PUT', JSON.stringify({id: Number(divSelected.dataset.id), newname: newName}),
            '닉네임 변경이 완료되었습니다.', '닉네임 변경에 실패했습니다.', async function(result){
				const jsnRes = await result.json();
				if (jsnRes.success){
					divSelected.children[1].children[1].innerText = newName.trim() === '' ? divSelected.dataset.name : newName;
				} else if (jsnRes.failmessage) {
					showMessage(jsnRes.failmessage);
				} else {
					showMessage('닉네임 변경에 실패했습니다.');
				}
            })
    });
}
{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', async function(){
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(Number(listItem.dataset.id));
            }
        }
        if ((lstDeleteName.length <= 0) || !confirm('정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.')){
            return;
        }
		let idCurLast = '0';
		if (list.children.length !== 1){
			idCurLast= list.children[list.children.length - 2].dataset.id;
		}
        await doFetch('', 'DELETE', JSON.stringify({sort: sortMode, last: idCurLast, friends: lstDeleteName}), 
        '', '친구 취소에 오류가 발생했습니다.', async function(result){
            const jsnRes = await result.json();
			let objCnt = {numItemCnt};
            await fncRemoveItems(jsnRes, fncPrintCnt, '일부 친구 취소를 실패했습니다.', '친구 취소가 완료되었습니다.', objCnt);
			numItemCnt = objCnt.numItemCnt;
        });
    });
}

