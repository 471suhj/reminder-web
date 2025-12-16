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

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblTitle.dataset.id, 'files');
fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblTitle.dataset.id);

async function fncRename(){
    const newName = txtRename.value;
    const itemId = txtRename.dataset.itemId;
    txtRename.style.display = 'none';
    if (newName !== ''){
		let jsonBody = {action: 'rename', sort: sortMode, id: Number(lblTitle.datset.id), file: Number(itemId), name: newName, timestamp: new Date(txtRename.dataset.timestamp)};
        await doFetch('./manage', 'PUT', JSON.stringify(jsonBody),
			'', `${newName}로 이름 바꾸기를 실패했습니다.`, async (result)=>{
			const jsnRes = await result.json();
				if (jsnRes.expired){
					return '창을 새로고침(Ctrl+R)한 후 다시 시도해 주십시오.';
				} else if (jsnRes.alreadyExists){
					return '이미 존재하는 이름입니다.';
				} else if (jsnRes.failmessage) {
					return jsnRes.failmessage;
				} else if (jsnRes.failed.length > 0){
					return `${newName}(으)로의 이름 변경에 실패했습니다.`;
				} else {
					return await fncInsertFile(jsnRes, false, '', '이름 변경에 실패했습니다.');
				}
		});
    }
}
txtRename.addEventListener('focusout', fncRename);
txtRename.addEventListener('keyup', async (event)=>{
    if (event.key === 'Enter'){
        fncRename(event);
    }
});
txtRename.addEventListener('input', (event)=>{
	event.target.value = event.target.value.slice(0, 40);
});

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

async function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = (listItem)=>{
        return `
        <div class='listItem grayLink' id='item${listItem.timestamp}${listItem.id}' data-id='${listItem.id}' data-timestamp='${listItem.timestamp}'>
        <input class='listItemChkbox listItemCol' type='checkbox'><!-
        ><div class='listItemType listItemCol'><img class='listItemCol isFolder' src='/graphics/toolbars/folder.png' width='15' height='15' data-visible='${listItem.isFolder}'></div><!-
        ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
        ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
        ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
	let objCnt = {numItemCnt};
    await fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, true, 2, objCnt, fncPrintCnt);
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
    let tlbItem = document.getElementById('upload');
    tlbItem.addEventListener('click', ()=>{
        divPopup.style.display = 'block';
		let ctl = document.createElement('h1');
		ctl.innerText = '파일 업로드\n';
		divPopup.appendChild(ctl);
		ctl = document.createElement('p');
		ctl.innerText = '업로드할 파일을 선택하십시오. 파일은 100개 까지만 한 번에 업로드할 수 있습니다.';
		divPopup.appendChild(ctl);
        let ctlFile = divPopup.appendChild(document.createElement('input'));
        ctlFile.type = 'file';
        ctlFile.multiple = true;
        ctlFile.accept = '.rmb';
        divPopup.appendChild(document.createElement('br'));
        const cmdOK = fncCreateOKCancel(divPopup);
        
        cmdOK.addEventListener('click', async ()=>{
			if (ctlFile.files.length <= 0 || ctlFile.files.length > 100){
				alert('파일이 선택되지 않았거나 100개를 초과하여 선택되었습니다.');
				return;
			}
			const dat = new FormData();
			let cnt = 0;
			for (const itm of ctlFile.files){
				dat.append('file' + (cnt++), itm);
			}
            await doFetch('./manage?id=' + lblTitle.dataset.id, 'POST', dat, '', '파일 업로드를 실패했습니다.', async (result)=>{
				fncClearPopup(divPopup);
                const jsnRes = await result.json();
                return await fncInsertFile(jsnRes, false, '업로드를 완료했습니다.', '업로드에 실패한 파일이 있습니다.');
            }, undefined, 'FormData');
        })
    });
}

{
    let tlbItem = document.getElementById('download');
	if (tlbItem){
		tlbItem.addEventListener('click', ()=>{
			open('./download', '_blank', 'popup=true');
		});
	}
}

{
    let tlbItem = document.getElementById('rename');
    tlbItem.addEventListener('click', ()=>{
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
    tlbItem.addEventListener('click', async ()=>{
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push({id: Number(listItem.dataset.id), timestamp: new Date(listItem.dataset.timestamp)});
            }
        }
		let idCurLast = {id: 0, timestamp: new Date()};
		if (list.children.length !== 1){
			idCurLast.id = Number(list.children[list.children.length - 2].dataset.id);
			idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
		}
        if (lstDeleteName.length > 0){
			let fncFetch;
			const jsonBody = {action: 'selected', last: idCurLast, sort: sortMode, from: Number(lblTitle.dataset.id),
				files: lstDeleteName, timestamp: lblTitle.dataset.timestamp};
			fncFetch = async ()=>{
				await doFetch('./manage', 'DELETE', JSON.stringify(jsonBody), 
				'', '삭제에 오류가 발생했습니다.', async (result)=>{
					const jsnRes = await result.json();
					if (jsnRes.expired){
						if (confirm('현재 창이 표시된 이후 폴더의 위치나 이름이 바뀌었습니다.\n'
						+ '"계속"할 경우 표시된 폴더가 아닌 새로 바뀐 위치의 폴더에서 삭제가 진행됩니다.\n'
						+ '현재 폴더가 작업하려는 폴더가 맞는지 확실하지 않다면 작업을 "취소"하고 새로고침(Ctrl+R)하십시오. "계속"하시겠습니까?')){
							jsonBody.ignoreTimestamp = true;
							await fncFetch();
						}
						return;
					}
					let objCnt = {numItemCnt};
					await fncRemoveItems(jsnRes, fncPrintCnt, '삭제에 실패한 항목이 있습니다.', '삭제가 완료되었습니다.', objCnt);
					numItemCnt = objCnt.numItemCnt;
				});
			}
			await fncFetch();
        }
    });
}

{
    let tlbItem = document.getElementById('share');
    tlbItem.addEventListener('click', async ()=>{
		await fncShare(divPopup, list);
    });
}

{
    let tlbItem = document.getElementById('copy');
    tlbItem.addEventListener('click', async ()=>{
        await fncCopyMove('copy', '복사를 완료했습니다.', '복사를 실패했습니다.', '복사되지 못한 파일이 있습니다.', divPopup, list, dlgOverwrite, './manage', 'POST');
    });
}

{
    let tlbItem = document.getElementById('move');
    tlbItem.addEventListener('click', async ()=>{
        await fncCopyMove('move', '이동을 완료했습니다.', '이동을 실패했습니다.', '이동되지 못한 파일이 있습니다.', divPopup, list, dlgOverwrite);
    });
}

{
    let tlbItem = document.getElementById('createDir');
    tlbItem.addEventListener('click', async ()=>{
        let strName = '';
		while (((strName = prompt('폴더의 이름을 입력하십시오.', strName)) ?? []).length > 40){
			if (strName === null){
				return;
			}
			alert('폴더의 이름은 40자를 넘을 수 없습니다.');
		}
        if (strName){
            await doFetch('./manage', 'PUT', JSON.stringify({action: 'createDir', sort: sortMode, id: Number(lblTitle.dataset.id), name: strName, timestamp: new Date(lblTitle.dataset.timestamp)}), '', '파일 추가에 실패했습니다.', async (result)=>{
                const jsnRes = await result.json();
				if (jsnRes.alreadyExists){
					showMessage('이미 존재하는 파일 이름입니다.');
				}
                return await fncInsertFile(jsnRes, false, '', '폴더 추가에 실패했습니다.');
            });
        }
    });
}

{
    let tlbItem = document.getElementById('createFile');
    tlbItem.addEventListener('click', async ()=>{
        let strName = '';
		while (((strName = prompt('파일의 이름을 입력하십시오.', strName)) ?? []).length > 40){
			if (strName === null){
				return;
			}
			alert('파일의 이름은 40자를 넘을 수 없습니다.');
		}
        if (strName){
            await doFetch('./manage', 'PUT', JSON.stringify({action: 'createFile', sort: sortMode, id: Number(lblTitle.dataset.id), name: strName, timestamp: new Date(lblTitle.dataset.timestamp)}), '', '파일 추가에 실패했습니다.', async (result)=>{
                const jsnRes = await result.json();
				if (jsnRes.alreadyExists){
					showMessage('이미 존재하는 파일 이름입니다.');
				}
                return await fncInsertFile(jsnRes, false, '', '파일 추가에 실패했습니다.');
            })
        }
    });
}