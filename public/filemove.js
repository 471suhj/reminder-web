import {fncClearPopup} from '/popup.js';
import {doFetch} from '/printmsg.js';

const list = document.getElementById('list');
const lblLoadMore = document.getElementById('loadMore');

export async function fncRemoveItems(jsnRes, fncPrintCnt, msgNeg, msgPos){
    for (listItem of jsnRes.arr){
        try{
            document.getElementById('item' + listItem).remove();
            itemCnt--;
        } catch {
            continue;
        }
    }
    fncPrintCnt();
    if (jsnRes.failmessage){
        return jsnRes.failmessage;
    } else if (jsnRes.failed.length > 0){
        return msgNeg;
    } else {
        return msgPos;
    }
}

export async function fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, includeBookmark, childLoc, numItemCnt, fncPrintCnt){
    for (const listItem of jsnRes.arr){
        let itmAfter = null; // the new item should come before this item. itmAfter is after the new file. null if last=true
        let itmNew = null;
        if (!last && !listItem.before){itmAfter = document.getElementById('item' + listItem.before);}
        if (!itmAfter){
            if (lblLoadMore.parentNode){
                lblLoadMore.insertAdjacentHTML('beforebegin', strHtml(listItem))
            } else {
                list.insertAdjacentHTML('beforeend', strHtml(listItem));
            }
            itmNew = list.children[list.children.length - 2];
        } else {
            itmAfter.insertAdjacentHTML('beforebegin', strHtml(listItem));
            itmNew = itmAfter.nextSibling;
        }

        let imgBookmark = null;
        itmNew.firstElementChild.checked = checkItems;
        itmNew.addEventListener('click', function(event){
            const listChkbox = itmNew.firstElementChild;
            if (event.target !== listChkbox && event.target !== imgBookmark){
                for (const tmpListItem of list.children){
                    tmpListItem.children[0].checked = false;
                }
                listChkbox.checked = true;
            }    
        });
        itmNew.addEventListener('dblclick', function(){
            window.location.href = listItem.link;
        })
        numItemCnt++;
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
            await doFetch('./bookmark', action, JSON.stringify({action: 'bookmark', files: [{id: Number(itmNew.dataset.id), timestamp: new Date(itmNew.dataset.timestamp)}]}),
            '', '처리에 실패했습니다.', async function(result){
                const jsnRes = result.json();
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
        if (divBookmark.dataset.bookmarked === 'false'){
            imgBookmark.style.display = 'none';
        }
    }

    jsnRes.arr = jsnRes.deleteArr;
    fncRemoveItems(jsnRes, fncPrintCnt, msgNeg, msgPos)
}

export function fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite, jsonBody, link, method){
    let btnDlg = document.getElementById('buttonrename');
    btnDlg.onclick = async function(event){
        btnDlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch(link, method, JSON.stringify(jsonBody), '', msgNegAll, async function(result){
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttonoverwrite');
    btnDlg.onclick = async function(event){
        btnDlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch('./manage', 'POST', JSON.stringify(jsonBody), '', msgNegAll, async function(result){
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttonskip');
    btnDlg.onclick = async function(event){
        btnDlg.close();
        jsonBody.overwrite = event.target.id;
        await doFetch('./manage', 'POST', JSON.stringify(jsonBody), '', msgNegAll, async function(result){
            const jsonNew = await result.json();
            return await fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    btnDlg = document.getElementById('buttoncancel');
    btnDlg.onclick = async function(event){
        btnDlg.close();
    }
    dlgOverwrite.showModal();
}

export function fncCreateOKCancel(divPopup){
    const cmdOK = divPopup.appendChild(document.createElement('button'));
    cmdOK.innerText = '확인';
    const cmdCancel = divPopup.appendChild(document.createElement('button'));
    cmdCancel.innerText = '취소';
    cmdCancel.addEventListener('click', () => {fncClearPopup(divPopup);});
    return cmdOK;
}

export async function fncCopyMove(mode, msgPos, msgNegAll, msgNegPart, divPopup, list, dlgOverwrite){
    divPopup.style.display = 'block';
	const lblTitle = document.getElementById('title');
    let arrSelFiles = [];
    for (const listItem of list.children){
        if (listItem.firstElementChild.checked){
            arrSelFiles.push(Number(listItem.dataset.id));
        }
    }
    if (!arrSelFiles.length){
        showMessage('파일이 선택되지 않았습니다.');
        fncClearPopup(divPopup);
        return;
    }
	let wintitle = (mode === 'copy') ? '복사' : '이동';
	divPopup.innerHTML = `
		<h1>파일 ${wintitle}</h1>
		${wintitle}할 폴더를 선택하십시오.<br><br>
		<div id='poppath'></div>
		<select size='8' id='poplst'></select>
		<div>선택한 폴더: <span id='popseldir' data-dir='${lblTitle.dataset.id}'>${lblTitle.dataset.path.split('/').slice(-1)[0]}</span></div>
		<br>`;
	
	const txtPath = document.getElementById('poppath');
	const lstDir = document.getElementById('poplst');
	const lblSelDir = document.getElementById('popseldir');
	const cmdOK = fncCreateOKCancel(divPopup);
	let fncFetchfolder;
	const fncClickOption = function(event){
		lblSelDir.innerText = event.target.innerText;
		lblSelDir.dataset.dir = event.target.dataset.id;
	};
	fncFetchFolder = async function(dirid){
		lstDir.children.forEach((element)=>{element.remove();});
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
					await fetchFolder(event.target.dataset.id);
				});
			}
		});
	}
	await fncFetchFolder(lblTitle.dataset.id);
	cmdOK.addEventListener('click', function(){
		if (!lstDir.value){
			showMessage('선택된 폴더가 없습니다.')
			return;
		}
		let jsonBody = {action: mode, sort: sortMode, files: arrSelFiles, from: lblTitle.dataset.id, timestamp: new Date(lblTitle.dataset.timestamp), to: Number(lblSelDir.dataset.dir)};
		await doFetch('./move', 'PUT', JSON.stringify(jsonBody), '',
			msgNegAll, async function(result){
				fncClearPopup(divPopup);
				const jsnRes = await result.json();
				if (jsnRes.alreadyExists){
					fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite, jsonBody, './move', 'PUT');
					return;
				} else if (jsnRes.failmessage) {
					return jsnRes.failmessage;
				} else if (jsnRes.failed){
					return '복사 또는 이동에 실패했습니다.';
				} else {
					return await fncInsertFile(jsnRes, false, msgPos, msgNegPart);
				}
		});
	});
    
}
