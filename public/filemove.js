import {fncClearPopup, fncCreateOKCancel} from '/popup.js';
import {doFetch, showMessage} from '/printmsg.js';
import {sortMode} from '/autoload.js';

const list = document.getElementById('list');
const lblLoadMore = document.getElementById('loadMore');

export async function fncRemoveItems(jsnRes, fncPrintCnt, msgNeg, msgPos, objCnt){
    for (const listItem of jsnRes.delarr ?? []){
        try{
            document.getElementById('item' + (listItem.timestamp ?? '') + listItem.id).remove();
            objCnt.numItemCnt--;
        } catch {
            continue;
        }
    }
    fncPrintCnt();
    if (jsnRes.failmessage){
        showMessage(jsnRes.failmessage);
    } else if ((jsnRes.failed ?? []).length > 0){
		if (msgNeg){
			showMessage(msgNeg);
		}
    } else {
		if (msgPos){
			showMessage(msgPos);
		}
    }
}

export async function fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, includeBookmark, childLoc, objCnt, fncPrintCnt){
    for (const listItem of jsnRes.addarr){
        let itmAfter = null; // the new item should come before this item. itmAfter is after the new file. null if last=true
        let itmNew = null;
		let notFound = false;
        if (!last && listItem.before !== undefined){
			// this returns null if not exists
			itmAfter = document.getElementById('item' + (listItem.before.timestamp ?? '') + listItem.before.id);
			if (itmAfter === null){
				notFound = true;
			}
		} else if (!last) { // shouldn't happen
			notFound = true;
			listItem.before.id = -1;
		}
		if (last === true){ // when last===true
			lblLoadMore.insertAdjacentHTML('beforebegin', strHtml(listItem));
			itmNew = list.children[list.children.length - 2];
		} else if (notFound === true || itmAfter === null){
			if (listItem.before.id === -1){
				list.insertAdjacentHTML('afterbegin', strHtml(listItem));
				itmNew = list.children[0];
			} else { // when new item belongs to overflow
				continue;
			}
        } else {
            itmAfter.insertAdjacentHTML('beforebegin', strHtml(listItem));
            itmNew = itmAfter.previousSibling;
        }

        let imgBookmark = null;
        itmNew.firstElementChild.checked = checkItems;
        itmNew.addEventListener('click', (event)=>{
            const listChkbox = itmNew.firstElementChild;
            if (event.target !== listChkbox && event.target !== imgBookmark){
                for (const tmpListItem of list.children){
                    tmpListItem.children[0].checked = false;
                }
                listChkbox.checked = true;
            }    
        });
		if (listItem.link === undefined){
		} else if (listItem.link.slice(0, 5) === '/edit'){
			itmNew.addEventListener('dblclick', ()=>{
				open(listItem.link, '_blank');
			});
		} else {
			itmNew.addEventListener('dblclick', ()=>{
				window.location.href = listItem.link;
			});
		}
        objCnt.numItemCnt++;
        if (!includeBookmark){
            continue;
        }
        const divBookmark = itmNew.children[childLoc].firstElementChild;
        imgBookmark = divBookmark.firstElementChild;
        divBookmark.addEventListener('click', async function(){
            let action = 'PUT';
            if (divBookmark.dataset.bookmarked === 'true'){
                action = 'DELETE';
            }
			const reqBody = {action: 'bookmark', sort: sortMode, files: [{id: Number(itmNew.dataset.id),
			timestamp: new Date(itmNew.dataset.timestamp)}], last: {id: 0, timestamp: '2000-01-01T00:00:00.000Z'}};
            await doFetch('./bookmark', action, JSON.stringify(reqBody),
            '', '처리에 실패했습니다.', async function(result){
                const jsnRes = await result.json();
                if (jsnRes.failed.length > 0){
                    return '처리에 실패했습니다.'
                }
                if (action === 'DELETE'){
                    divBookmark.dataset.bookmarked = 'false';
                    imgBookmark.style.display = 'none';
                } else {
                    divBookmark.dataset.bookmarked = 'true';
                    imgBookmark.style.display = 'block';
                }
            });
        });
        divBookmark.addEventListener('mouseenter', function(){
            imgBookmark.style.display = 'block';
        })
        divBookmark.addEventListener('mouseleave', function(){
            if (divBookmark.dataset.bookmarked === 'false'){
                imgBookmark.style.display = 'none';
            }
        })
        if (divBookmark.dataset.bookmarked !== 'true'){
            imgBookmark.style.display = 'none';
        }
    }

    await fncRemoveItems(jsnRes, fncPrintCnt, msgNeg, msgPos, objCnt);
}

export function fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite, jsonBody, link, method, fncInsertFile){
	const dlg =  document.getElementById('overwriteDlg');
    let btnDlg = document.getElementById('buttonrename');
    btnDlg.onclick = async (event)=>{
        dlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch(link, method, JSON.stringify(jsonBody), '', msgNegAll, async (result)=>{
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttonoverwrite');
    btnDlg.onclick = async (event)=>{
        dlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch(link, method, JSON.stringify(jsonBody), '', msgNegAll, async (result)=>{
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttonskip');
    btnDlg.onclick = async (event)=>{
        dlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch(link, method, JSON.stringify(jsonBody), '', msgNegAll, async (result)=>{
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttoncancel');
    btnDlg.onclick = async (event)=>{
        dlg.close();
    }
    dlgOverwrite.showModal();
}

export async function fncCopyMove(mode, msgPos, msgNegAll, msgNegPart, divPopup, list, dlgOverwrite, fncInsertFile){
    divPopup.style.display = 'block';
	const lblTitle = document.getElementById('title');
    let arrSelFiles = [];
    for (const listItem of list.children){
        if (listItem.firstElementChild.checked){
            arrSelFiles.push({id: Number(listItem.dataset.id), timestamp: new Date(listItem.dataset.timestamp)});
        }
    }
    if (!arrSelFiles.length){
        showMessage('파일이 선택되지 않았습니다.');
        fncClearPopup(divPopup);
        return;
    }
	let idCurLast = {id: '0', timestamp: new Date()};
	if (list.children.length !== 1){
		idCurLast.id = Number(list.children[list.children.length - 2].dataset.id);
		idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
	}
	let wintitle = (mode === 'copy') ? '복사' : '이동';
	divPopup.innerHTML = `
		<h1>파일 ${wintitle}</h1>
		${wintitle}할 폴더를 선택하십시오.<br><br>
		<div id='poppath'></div>
		<select size='8' id='poplst' style="width:100%"></select>
		<div>선택한 폴더: <span id='popseldir' data-dir='${lblTitle.dataset.id}'>${lblTitle.dataset.path.split('/').slice(-1)[0]}</span></div>
		<br>`;
	
	const txtPath = document.getElementById('poppath');
	const lstDir = document.getElementById('poplst');
	const lblSelDir = document.getElementById('popseldir');
	const cmdOK = fncCreateOKCancel(divPopup);
	let fncFetchFolder;
	const fncClickOption = function(event){
		lblSelDir.innerText = event.target.innerText;
		lblSelDir.dataset.dir = event.target.dataset.id;
	};
	fncFetchFolder = async function(dirid){
		Array.from(lstDir.children).forEach((element)=>{element.remove();});
		await doFetch('./list?select=folders&dirid=' + dirid, 'GET',
			'', '', '폴더 목록을 불러올 수 없었습니다.', async function(result){
			const jsnRes = await result.json();
			txtPath.innerText = jsnRes.path;
			for (const listItem of jsnRes.arr){
				const ctlOption = lstDir.appendChild(document.createElement('option'));
				ctlOption.innerText = `${listItem.name}`;
				ctlOption.dataset.id = listItem.id;
				ctlOption.addEventListener('click', fncClickOption);
				ctlOption.addEventListener('dblclick', async function(event){
					fncClickOption(event);
					await fncFetchFolder(event.target.dataset.id);
				});
			}
		});
	}
	await fncFetchFolder(lblTitle.dataset.id);
	cmdOK.addEventListener('click', async ()=>{
		let jsonBody = {action: mode, last: idCurLast, sort: sortMode, files: arrSelFiles, from: Number(lblTitle.dataset.id), timestamp: new Date(lblTitle.dataset.timestamp), to: Number(lblSelDir.dataset.dir)};
		let fncFetch;
		fncFetch = async function(){
			await doFetch('./move', 'PUT', JSON.stringify(jsonBody), '',
				msgNegAll, async function(result){
					fncClearPopup(divPopup);
					const jsnRes = await result.json();
					if (jsnRes.expired){
						if (confirm('현재 창이 표시된 이후 폴더의 위치나 이름이 바뀌었습니다.\n'
						+ '"계속"할 경우 표시된 폴더가 아닌 새로 바뀐 위치의 폴더에서 복사/이동 작업이 진행됩니다.\n'
						+ '현재 폴더가 작업하려는 폴더가 맞는지 확실하지 않다면 작업을 "취소"하고 새로고침(Ctrl+R)하십시오. "계속"하시겠습니까?')){
							jsonBody.ignoreTimestamp = true;
							fncFetch();
						}
						return;
					} else if (jsnRes.alreadyExists){
						fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite, jsonBody, './move', 'PUT', fncInsertFile);
						return;
					} else if (jsnRes.failmessage) {
						return jsnRes.failmessage;
					} else if (jsnRes.failed.length > 0){
						return '복사 또는 이동에 실패했습니다.';
					} else {
						return await fncInsertFile(jsnRes, false, msgPos, msgNegPart);
					}
			});
		}
		await fncFetch();
	});
    
}
