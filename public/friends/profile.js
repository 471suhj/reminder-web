import {doFetch, showMessage} from '/printmsg.js';
import {fncClearPopup} from '/popup.js';
import {fncRefresh, fncAutoloadSetup, sortMode, fncSetupHeaderSort} from '/autoload.js';
import {fncCreateOKCancel, fncAddItems} from '/filemove.js';

sortMode.criteria = 'colDate';
const list = document.getElementById('list');
const lblItemCnt = document.getElementById('itemCount');
const lblLoadMore = document.getElementById('loadMore');
const lblNickname = document.getElementById('title');
const lblID = document.getElementById('friendID');
const listHead = document.getElementById('listHead');
const divPopup = document.getElementById('popup');
const lblTitle = document.getElementById('title');
let numItemCnt = 0;

fncAutoloadSetup(fncInsertFile, fncPrintCnt, lblNickname.dataset.id);
fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, lblNickname.dataset.id);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + '개의 항목'
}

function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class='listItem grayLink' id='item${listItem.id} data-id='${listItem.id}'>
            <input class='listItemChkbox listItemCol' type='checkbox'><!-
            ><div class='listOwnerImg listItemCol'><img class='listItemCol ownerImg' src='${listItem.ownerImg}' width='30' height='30' style='display:none'></div><!-
            ><div class='listOwner listItemCol'>${listItem.ownerName}</div><!-
            ><div class='listItemText listItemCol'>${listItem.text}  <div class='itemBookmark listItemCol' data-bookmarked='${listItem.bookmarked}'><img src='/graphics/toolbars/bookmark.png' width='15' height='15'></div></div><!-
            ><div class='listProfile listItemCol'>${listItem.shared}</div><!-
            ><div class='listDateShared listItemCol'>${listItem.dateShared}</div><!-
            ><div class='listDate listItemCol'>${listItem.date}</div>
        </div>`;
    }
    fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, strHtml, false, 2, numItemCnt, fncPrintCnt);
}


{
    let tlbItem = document.getElementById('rename');
    tlbItem.addEventListener('click', async function(){
        let newNickname = prompt('수정할 닉네임을 입력해 주십시오.', lblNickname.innerText);
        if (!newNickname){
            return;
        }
        await doFetch('./', 'PUT', JSON.stringify({id: Number(lblTitle.dataset.id), newname: newNickname}),
            '닉네임 변경이 완료되었습니다.', '닉네임 변경에 실패했습니다.', async function(result){
				const jsnRes = await result.json();
				if (jsnRes.success){
					lblNickname.innerText = newNickname;
				} else if (jsnRes.failmessage) {
					showMessage(jsnRes.failmessage);
				} else {
					showMessage('닉네임 변경에 실패했습니다.');
				}
            })
    })
}

{
    let tlbItem = document.getElementById('delete');
    tlbItem.addEventListener('click', function(){
        let arrSelFiles = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                arrSelFiles.push(Number(listItem.dataset.id));
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
        cmdOK.addEventListener('click', async function(){
            const txtBody = JSON.stringify({action: 'selected', files: arrSelFiles, friend: Number(lblTitle.dataset.id), sort: sortMode, message: txtMsg.value});
            fncClearPopup(divPopup);
            await doFetch('', 'DELETE', txtBody,
                '공유가 취소되었습니다.', '공유 취소를 실패했습니다.', async function(result){
                const jsnRes = await result.json();
                fncRemoveItems(jsnRes, fncPrintCnt, '공유 취소에 실패한 항목이 있습니다.', '공유 취소가 완료되었습니다.');
            });
        });
    });
}

{
    let tlbItem = document.getElementById('topShare');
    tlbItem.addEventListener('click', async function(){
        divPopup.style.display = 'block';
		divPopup.innerHTML = `
			<h1>공유</h1>
			공유 방식: <input type='radio' checked='true' id='popoptCopy'><label for='popoptCopy'>사본 전달</label>
			<input type='radio' id='popoptRead'><label for='popoptRead'>읽기 권한 공유</label>
			<input type='radio' id='popoptEdit'><label for='popoptEdit'>편집 권한 공유</label>
			공유할 파일을 선택하십시오.<br>
			ctrl 키를 누른 상태에서 클릭하면 여러 파일을 동시에 선택할 수 있습니다.<br><br>
			<div id='poppath'></div>
			<select size='8' id='poplst'></select>
			<select multiple='true' id='poplst2'></select>			
			공유와 함께 전송할 메시지를 입력하십시오.<br>
			<textarea id='popMsg'></textarea>
			<br>`;
		
		const lstDir = document.getElementById('poplst');
		const lstFiles = document.getElementById('poplst2');
		const optCopy = document.getElementById('popoptCopy');
		const optShareRead = document.getElementById('popoptRead');
		const optShareEdit = document.getElementById('popoptEdit');
		const txtMessage = document.getElementById('popMsg');
		const txtPath = document.getElementById('poppath');
		const cmdOK = fncCreateOKCancel(divPopup);
		let fncFetchfolder;
		fncFetchFolder = async function(dirid){
			lstDir.children.forEach((element)=>{element.remove();});
			lstFiles.children.forEach((element)=>{element.remove();});
			let link = './list?select=sepall';
			link += dirid ? '&dirid=' + dirid : '';
			await doFetch(link, 'GET',
				'', '', '파일 목록을 불러올 수 없었습니다.', async function(result){
				const jsnRes = await result.json();
				txtPath.innerText = jsnRes.path;
				for (const listItem of jsnRes.arr){
					const ctlOption = lstDir.appendChild(document.createElement('option'));
					ctlOption.innerText = `${listItem.name}`;
					ctlOption.dataset.id = listItem.id;
					ctlOption.addEventListener('dblclick', async function(event){
						fncClickOption(event);
						await fetchFolder(event.target.dataset.id);
					});
				}
				for (const listItem of jsnRes.arr2){
					const ctlOption = lstFiles.appendChild(document.createElement('option'));
					ctlOption.innerText = `${listItem.name}`;
					ctlOption.dataset.id = listItem.id;
				}
			});
		}
		await fncFetchFolder();
		cmdOK.addEventListener('click', async function(event){
			if (lstFiles.selectedOptions.length <= 0){
				showMessage('선택된 파일이 없습니다.')
				return;
			}
			let shareMode = null;
			if (optCopy.checked){shareMode = 'copy'} else if (optShareRead) {shareMode = 'read'} else {shareMode = 'edit'} 
			const jsonBody = {files: Array.from(lstFiles.selectedOptions).map((val)=>Number(val.dataset.id)), mode: shareMode, message: txtMessage.value, friends: [Number(lblTitle.dataset.id)]};
			await doFetch('/files/share', 'PUT', JSON.stringify(jsonBody), '',
				'공유에 실패했습니다.', async function(result){
					fncClearPopup(divPopup);
					const jsnRes = await result.json();
					await fncInsertFile(jsnRes, false, '공유가 완료되었습니다.', '공유되지 못한 파일이 있습니다.');
					fncPrintCnt();
					if (jsnRes.failreason){
						return jsnRes.failreason;
					} else if (jsnRes.failed.length > 0){
						return '공유에 실패한 항목이 있었습니다.';
					} else {
						return '공유가 완료되었습니다.';
					}
			});
		});
	});
}

{
    let colItem = document.getElementById('removeFriend');
    colItem.addEventListener('click', async function(){
        if (!confirm('정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.')){
            return;
        }
        await doFetch('./', 'DELETE', JSON.stringify({sort: sortMode, files: [Number(lblTitle.dataset.id)]}), 
        '', '친구 취소에 오류가 발생했습니다.', async function(result){
            const jsnRes = await result.json();
            if (jsnRes.failmessage){
                return jsnRes.failmessage;
            } else if ((jsnRes.arr.length !== 1) || (jsnRes.failed.length > 0)){
                return '친구 최소에 실패했습니다.';
            } else {
                alert('친구 취소가 완료되었습니다.');
                document.location.href = '/friends'
                return '';
            }
        });
    })
}

