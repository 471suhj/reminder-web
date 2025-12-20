import {doFetch, showMessage} from '/printmsg.js';
import {sortMode} from '/autoload.js'

export function fncClearPopup(divPopup){
    while (divPopup.children.length){
        divPopup.children[0].remove();
    }
    divPopup.style.display = 'none';
}

export function fncCreateOKCancel(divPopup){
    const cmdOK = divPopup.appendChild(document.createElement('button'));
    cmdOK.innerText = '확인';
    const cmdCancel = divPopup.appendChild(document.createElement('button'));
    cmdCancel.innerText = '취소';
    cmdCancel.addEventListener('click', () => {fncClearPopup(divPopup);});
    return cmdOK;
}

export async function fncShare(divPopup, list){
	divPopup.style.display = 'block';
	let arrSelFiles = [];
	const lblTitle = document.getElementById('title');
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
	divPopup.innerHTML = `
		<h1>공유</h1>
		공유 방식: <br><input type='radio' name="share" checked='true' id='popoptCopy'><label for='popoptCopy'>사본 전달</label>
		<input type='radio' name="share" id='popoptRead'><label for='popoptRead'>읽기 권한 공유</label>
		<input type='radio' name="share" id='popoptEdit'><label for='popoptEdit'>편집 권한 공유</label><br><br><br>
		공유할 친구를 선택하십시오.<br>
		ctrl 키를 누른 상태에서 클릭하면 여러 친구를 동시에 선택할 수 있습니다.<br><br>
		<input type='text' placeholder='검색' id='popfriendsearch' style="width:100%"><br>
		<select multiple='true' id='poplst' style="width:100%"></select><br>
		공유와 함께 전송할 메시지를 입력하십시오.<br>
		<textarea id='popMsg' style="width:100%"></textarea>
		<br>`;
	
	const txtSearch = document.getElementById('popfriendsearch');
	const lstFriends = document.getElementById('poplst');
	txtSearch.addEventListener('keydown', function(event){
		const strSearch = event.target.value.toLowerCase();
		let itmSearch = null;
		for (const listItem of lstFriends.children){
			if (listItem.dataset.nickname.toLowerCase() >= strSearch){
				itmSearch = listItem;
				break;
			} 
		}
		if (itmSearch){
			itmSearch.scrollIntoView();
		}
	});
	const optCopy = document.getElementById('popoptCopy');
	const optShareRead = document.getElementById('popoptRead');
	const optShareEdit = document.getElementById('popoptEdit');
	const txtMessage = document.getElementById('popMsg');
	const cmdOK = fncCreateOKCancel(divPopup);
	await doFetch('/friends/list', 'GET', '', '', '친구 목록을 불러올 수 없었습니다.', async function(result){
		const jsnRes = await result.json();
		for (const listItem of jsnRes.arr){
			const ctlOption = lstFriends.appendChild(document.createElement('option'));
			ctlOption.innerText = `${listItem.nickname} (${listItem.username})`;
			ctlOption.dataset.id = listItem.id;
			ctlOption.dataset.nickname = listItem.nickname;
		}				
	}, ()=>fncClearPopup(divPopup));
	cmdOK.addEventListener('click', async function(event){
		if (lstFriends.selectedOptions.length <= 0){
			showMessage('선택된 친구가 없습니다.')
			return;
		}
		let shareMode = null;
		if (optCopy.checked){shareMode = 'copy'} else if (optShareRead.checked) {shareMode = 'read'} else {shareMode = 'edit'} 
		const jsonBody = {files: arrSelFiles, last: idCurLast, source: 'files', sort: sortMode, from: Number(lblTitle.dataset.id), timestamp: lblTitle.dataset.timestamp, mode: shareMode, message: txtMessage.value, friends: Array.from(lstFriends.selectedOptions).map((val)=>Number(val.dataset.id))};
		await doFetch('./share', 'PUT', JSON.stringify(jsonBody), '',
			'공유에 실패했습니다.', async function(result){
				fncClearPopup(divPopup);
				const jsnRes = await result.json();
				for (const listItem of jsnRes.addarr){
					document.getElementById('item' + listItem.timestamp + listItem.id).children[3].innerText = listItem.shared;
				}
				if (jsnRes.failreason){
					return jsnRes.failreason;
				} else if (jsnRes.failed.length > 0){
					return '공유에 실패한 항목이 있었습니다.';
				} else {
					return '공유가 완료되었습니다.';
				}
		});
	});
}