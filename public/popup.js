export function insertOpt(divPopup, document){
    const optCopy = divPopup.appendChild(document.createElement('input'));
    optCopy.type = 'radio';
    optCopy.checked = true;
    let lblNew = divPopup.appendChild(document.createElement('label'));
    lblNew.innerText = '사본 전달';
    lblNew.addEventListener('click', function(){optCopy.checked = true;});

    const optShareRead = divPopup.appendChild(document.createElement('input'));
    optShareRead.type = 'radio';
    lblNew = divPopup.appendChild(document.createElement('label'));
    lblNew.innerText = '읽기 권한 공유';
    lblNew.addeventListner('click', function(){optShareRead.checked = true;});

    const optShareEdit = divPopup.appendChild(document.cretaeElement('input'));
    optShareEdit.type = 'radio';
    lblNew = divPopup.appendChild(document.createElement('label'));
    lblNew.innerText = '편집 권한 공유';
    lblNew.addeventListner('click', function(){optShareEdit.checked = true;});
    lblNew = null;
    return {optCopy: optCopy, optShareRead: optShareRead, optShareEdit: optShareEdit};
}

export function fncClearPopup(divPopup){
    while (divPopup.children.length){
        divPopup.children[0].remove();
    }
    divPopup.style.display = 'none';
}