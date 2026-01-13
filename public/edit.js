import {showMessage, doFetch} from '/printmsg.js';
import {fncClearPopup} from '/popup.js';

const divEdit = document.getElementById('editPane');
const divPopup = document.getElementById('popup');
const cmdShare = document.getElementById('imgShareOptions');
const mnuShare = document.getElementById('shareMenu');
const txtMain = document.getElementById('mainText');
const txtBack = document.getElementById('backText')
const lstItems = document.getElementById('indexList');
const lblStatus = {};
lblStatus.title = document.getElementById('fileName');
lblStatus.shared = document.getElementById('shared');
lblStatus.saveState = document.getElementById('saveState');
lblStatus.curUsers = document.getElementById('curUsers')
const mnuShareItems = {};
mnuShareItems.copy = document.getElementById('shareCopy');
mnuShareItems.read = document.getElementById('shareRead');
mnuShareItems.edit = document.getElementById('shareEdit');
mnuShareItems.forceRead = document.getElementById('shareForceRead');
const cmdIndex = {};
cmdIndex.delete = document.getElementById('deleteCurItems');
cmdIndex.duplicate = document.getElementById('duplicateCurItems');
cmdIndex.add = document.getElementById('addItem');
cmdIndex.up = document.getElementById('moveItemUp');
cmdIndex.down = document.getElementById('moveItemDown');

let intAgeCnt = 0; //(mod 10)
const rngLoc = document.createRange();
await getInitData(lblStatus, lstItems, txtMain, txtBack);

function toPx(val){
    return String(val) + 'px';
}

function fncUnshared(){
    alert('사용자에 대한 공유가 취소되었습니다.');
    window.close();
}

function fncCloseMnuShare(){
    mnuShare.style.display = 'none';
}

function fncSetCaret(curLoc){
    intAgeCnt = (intAgeCnt + 1) % 10;
    for (const locItem of curLoc){
        const caretIdB = 'userCaretB_' + locItem.userId;
        const caretIdA = 'userCaretA_' + locItem.userId;
        let userCaretB = document.getElementById(caretIdB);
        let userCaretA = document.getElementById(caretIdA);
        if (userCaretB){
            userCaretB = divEdit.appendChild(document.createElement('div'));
            userCaretA = divEdit.appendChild(document.createElement('div'));
            userCaretB.id = caretIdB;
            userCaretB.dataset.careta = caretIdA;
            userCaretA.id = caretIdA;
            userCaretB.class = 'userCaretB';
            userCaretA.innerText = locItem.userNickname;
        }
        rngLoc.setStart(txtBack, locItem.selStart);
        rngLoc.setEnd(txtBack, locItem.selEnd);
        const rctSelect = rngLoc.getClientRects();
        userCaretB.style.left = toPx(rctSelect.x); userCaretB.style.top = toPx(rctSelect.y);
        userCaretB.style.height = toPx(rctSelect.height);
        userCaretA.style.left = toPx(rctSelect.x); userCaretA.style.top = toPx(rctSelect.y - 17);

        userCaret.dataset.age = intAgeCnt;
    }
    for (const carItem of document.getElementsByClassName('userCaretB')){
        if (carItem.dataset.age !== intAgeCnt){
            document.getElementById(carItem.dataset.careta).remove();
            carItem.remove();
        }
    }
}

function fncUpdateShareIcon(newValue){ // bool input
    newValue = String(newValue);
    if (cmdShare.dataset.shared !== newValue){
        cmdShare.dataset.shared = newValue;
        cmdShare.src = (newValue === 'true') ? '/graphics/edit/users.png' : '/graphics/edit/user.png';
    }
}

function fncChangeReadonly(propVal){ // bool input
    for (const prop in cmdIndex){
        cmdIndex[prop].disabled = propVal;
    }
    txtMain.readOnly = propVal;
    mnuShareItems.read.disabled = propVal;
    mnuShareItems.edit.disabled = propVal;
    mnuShareItems.forceRead.disabled = propVal;
    lblStatus.saveState.innerText = propVal ? '읽기 전용' : '저장 완료';
}

async function getInitData(){
    let retry = true;
    while (retry){
        await doFetch(`/edit/inter?id=${lblStatus.title.dataset.fileid}`, 'GET', '', '', '', async (result)=>{
            const jsnRes = await result.json();

            lblStatus.shared.innerText = jsnRes.sharedAccounts ? jsnRes.sharedAccounts : '공유중이지 않음';
            fncUpdateShareIcon(jsnRes.sharedState);
            fncChangeReadonly(jsnRes.readOnly);
            lblStatus.curUsers.innerText = jsnRes.curUsers;

            while (lstItems.children.length){
                lstItems.children[0].remove();
            }
            for (let i = 1; i <= jsnRes.itmUsers.length; i++){
                const itmIndex = lstItems.appendChild(document.createElement('option'));
                itmIndex.dataset.index = i;
                itmIndex.innerText = String(i);
                if (jsnRes.itmUsers[i - 1] !== ''){
                    itmIndex.innerText += ` (${jsnRes.itmUsers[i - 1]})`;
                }
            }
            lstItems.children[jsnRes.itmCur - 1].selected = true;
            txtMain.textContent = jsnRes.txtCur;
            txtBack.textContent = jsnRes.txtCur;

            fncSetCaret(jsnRes.curLoc);

            retry = false;
        }, ()=>{
            alert("로드에 실패했습니다.");
			retry = false;
			// retry = true;
        });
    }
}

function fncDelItem(){

}

showMessage("이 웹사이트의 '파일 열람/편집' 기능은 완성되지 않았습니다. 기능이 최적화되어 있지 않고 대부분의 기능이 작동하지 않으니 참고하시기 바랍니다.\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
fncChangeReadonly(true);
{
	let i = 0;
	for (const itm of lstItems.children){
		i++;
		const reqInfo = {loc: i};
		itm.addEventListener('click', async (event)=>{
			await doFetch(`/edit/inter?id=${lblStatus.title.dataset.fileid}&loc=${reqInfo.loc}`,
			'GET', '', '', '불러오기에 실패했습니다.', async (result)=>{
				const jsnRes = await result.json();

				lstItems.children[jsnRes.itmCur - 1].selected = true;
				txtMain.textContent = jsnRes.txtCur;
				txtBack.textContent = jsnRes.txtCur;
			});
		});
	}
}

document.addEventListener('visibilitychange', ()=>{
    showMessage('make the feature to save');
})


cmdShare.addEventListener('click', (event)=>{
    mnuShare.style.left = String(event.clientX)+'px';
    mnuShare.style.top = String(event.clientY)+'px';
    mnuShare.style.display = 'block';
    mnuShare.focus();
});

mnuShare.addEventListener('blur', ()=>{
    fncCloseMnuShare();
})

cmdIndex.delete.addEventListener('click', ()=>{
    //fncDelItem();
});


document.addEventListener('keydown', (event)=>{
    if (event.key === 'Control'){
        lstItems.multiple = true;
    } else {
        lstItems.multiple = false;
    }
});

document.addEventListener('keyup', (event)=>{
    if (event.key === 'Control'){
        lstItems.multiple = true;
    } else {
        lstItems.multiple = false;
    }
});

for (const prop in mnuShareItems){
    const mnuItem = mnuShareItems[prop];
    mnuItem.addEventListener('click', ()=>{
		showMessage('구현되지 않은 기능입니다.');
		return;
        fncCloseMnuShare();
        divPopup.style.display = 'block';

        doFetch(`/edit/friendlist?mode=${mnuItem.dataset.action}&file=${lblStatus.title.dataset.fileid}`, 'GET', '', '', '친구 목록을 불러올 수 없었습니다.', async function(result){
            const jsnRes = await result.json();
    
            const txtSearch = divPopup.appendChild(document.createElement('input'));
            txtSearch.type = 'text';
            txtSearch.placeholder = '검색';
            const lstFriends = divPopup.appendChild(document.createElement('select'));
            lstFriends.multiple = true;
        
            const txtMessage = divPopup.appendChild(document.createElement('textarea'));
        
            const cmdOK = fncCreateOKCancel(divPopup);
            
            for (const listItem of jsnRes.arr){
                const ctlOption = lstFriends.appendChild(document.createElement('option'));
                ctlOption.innerText = `${listItem.name} (${listItem.id})`;
                ctlOption.dataset.userid = listItem.id;
                ctlOption.checked = listItem.selected;
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
                const txtBody = JSON.stringify({action: 'share', files: arrSelFiles, mode: mnuItem.dataset.action, message: txtMessage.value, friends: lstFriends.value});
                fncClearPopup(divPopup);
                doFetch('', 'PUT', txtBody, '공유 상태가 변경되었습니다.', '공유 상태 변경에 실패했습니다.', async function(result){
                    const jsnRes = result.json();
                    lblStatus.shared.innerText = jsnRes.sharedDetails;
                    fncUpdateShareIcon(jsnRes.sharedStatus);
                });
            });
            return '';
        }, () => {fncClearPopup(divPopup)});
    });    
}
