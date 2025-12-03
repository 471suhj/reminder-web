import {doFetch, showMessage} from '/printmsg.js';
import {fncShare, fncClearPopup} from '/popup.js';
import {fncRefresh, fncAutoloadSetup, sortMode, fncSetupHeaderSort} from '/autoload.js';
import {fncCopyMove, fncRemoveItems, fncAddItems, fncAnswerDlg, fncCreateOKCancel} from '/filemove.js';

const list = document.getElementById('list');
const listHead = document.getElementById('listHead');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const divPopup = document.getElementById('popup');
const dlgOverwrite = document.getElementById('overwriteDlg');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

const txtRename = document.createElement('input');
txtRename.setAttribute('type', 'text');
txtRename.style.display = 'none';

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id);
fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

async function fncRename(){
    const newName = txtRename.value;
    const itemId = txtRename.dataset.itemId;
    txtRename.style.display = 'none';
    if (newName !== ''){
        await doFetch('./manage', 'PUT', JSON.stringify({action: 'rename', sort: sortMode, id: Number(itemId), name: newName, timestamp: new Date(txtRename.dataset.timestamp)}),
			'', `${newName}로 이름 바꾸기를 실패했습니다.`, async function(result){
			const jsnRes = await result.json();
			if (jsnRes.success){
				document.getElementById('item' + itemId).childNodes[1].innerText = newName + ' ';
			} else if(jsnRes.failmessage){
				return jsnRes.failmessage;
			} else {
				return `${newName}로 이름 바꾸기를 실패했습니다.`;
			}
		});
    }
}
txtRename.addEventListener('focusout', fncRename);
txtRename.addEventListener('keyup', async function(event){
    if (event.key === 'Enter'){
        fncRename(event);
    }
})

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

async function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='item${listItem.id}' data-id='${listItem.id}' data-timestamp='${listItem.timestamp}'>
        <input class='listItemChkbox listItemCol' type='checkbox'><!-
        ><div class='listItemType listItemCol'><img class='listItemCol isFolder' src='/graphics/toolbars/folder.png' width='15' height='15' data-visible='${listItem.isFolder}'></div><!-
        ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
        ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
        ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, true, 2, numItemCnt, fncPrintCnt);
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
    let tlbItem = document.getElementById('upload');
    tlbItem.addEventListener('click', function(){
        divPopup.style.display = 'block';
        let ctlFile = divPopup.appendChild(document.createElement('input'));
        ctlFile.setAttribute('type', 'file');
        ctlFile.setAttribute('multiple', 'true');
        ctlFile.setAttribute('accept', '.rmb');
        
        const cmdOK = fncCreateOKCancel(divPopup);
        
        cmdOK.addEventListener('click', async function(){
            const addedFile = ctlFile.files; // must come before removing
            let jsonBody = {action: 'upload', sort: sortMode, files: addedFile, dir: Number(lblTitle.dataset.id)};
            fncClearPopup(divPopup);
            await doFetch('./manage', 'POST', JSON.stringify(jsonBody), '', '파일 업로드를 실패했습니다.', async function(result){
                const jsnRes = await result.json(addedFile);
                if (jsnRes.alreadyExists){
                    fncAnswerDlg('업로드를 완료했습니다.', '파일 업로드를 실패했습니다.', '업로드에 실패한 파일이 있습니다.', dlgOverwrite, jsonBody);
                }
                return await fncInsertFile(jsnRes, false, '업로드를 완료했습니다.', '업로드에 실패한 파일이 있습니다.');
            });
        })
    });
}

{
    let tlbItem = document.getElementById('download');
    tlbItem.addEventListener('click', function(){
        open('./download', '_blank', 'popup=true');
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
        if (divSelected){
            txtRename.value = divSelected.children[2].childNodes[1].innerText.trim();
            divSelected.children[2].appendChild(txtRename);
            txtRename.dataset.itemId = divSelected.dataset.id;
			txtRename.dataset.timestamp = divSelected.timestamp;
            txtRename.style.display = 'inline';
            txtRename.focus();
        }
    });
}

{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', async function(){
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push({id: Number(listItem.dataset.id), timestamp: new Date(listItem.dataset.timestamp));
            }
        }
        if (lstDeleteName.length > 0){
            await doFetch('./manage', 'DELETE', JSON.stringify({action: 'selected', sort: sortMode, files: lstDeleteName}), 
            '', '삭제에 오류가 발생했습니다.', async function(result){
                const jsnRes = await result.json();
                return fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.');
            });
        }
    });
}

{
    let tlbItem = document.getElementById('share');
    tlbItem.addEventListener('click', async function(){
		await fncShare(divPopup, list);
    });
}

{
    let tlbItem = document.getElementById('copy');
    tlbItem.addEventListener('click', function(){
        await fncCopyMove('copy', '복사를 완료했습니다.', '복사를 실패했습니다.', '복사되지 못한 파일이 있습니다.', divPopup, list, dlgOverwrite, './manage', 'POST');
    });
}

{
    let tlbItem = document.getElementById('move');
    tlbItem.addEventListener('click', function(){
        await fncCopyMove('move', '이동을 완료했습니다.', '이동을 실패했습니다.', '이동되지 못한 파일이 있습니다.', divPopup, list, dlgOverwrite);
    });
}

{
    let tlbItem = document.getElementById('createDir');
    tlbItem.addEventListener('click', async function(){
        let strName = prompt('폴더의 이름을 입력하십시오.', '');
        if (strName){
            await doFetch('./manage', 'PUT', JSON.stringify({action: 'createDir', sort: sortMode, id: Number(lblTitle.dataset.id), name: strName, timestamp: new Date(lblTitle.dataset.timestamp}), '', '파일 추가에 실패했습니다.', async function(result){
                const jsnRes = await result.json();
                return await fncInsertFile(jsnRes, false, '', '폴더 추가에 실패했습니다.');
            })
        }
    });
}

{
    let tlbItem = document.getElementById('createFile');
    tlbItem.addEventListener('click', async function(){
        let strName = prompt('파일의 이름을 입력하십시오.', '');
        if (strName){
            await doFetch('./manage', 'PUT', JSON.stringify({action: 'createFile', sort: sortMode, id: Number(lblTitle.dataset.id), name: strName, timestamp: new Date(lblTitle.dataset.timestamp)}), '', '파일 추가에 실패했습니다.', async function(result){
                const jsnRes = await result.json();
                return await fncInsertFile(jsnRes, false, '', '파일 추가에 실패했습니다.');
            })
        }
    });
}