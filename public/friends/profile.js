import {doFetch, showMessage} from "/printmsg.js"

let sortMode = {criteria: "date", incr: true};
const list = document.getElementById("list");
const lblItemCnt = document.getElementById("itemCount");
const lblLoadMore = document.getElementById("loadMore");
const lblNickname = document.getElementById("title");
const lblID = document.getElementById("friendID");
const divPopup = document.getElementById("popup");
let numItemCnt = 0;

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + "개의 항목"
}

function fncClearPopup(){
    while (divPopup.children.length){
        divPopup.children[0].remove();
    }
    divPopup.style.display = "none";
}
divPopup.addEventListener("blur", fncClearPopup);

function fncResetSort(){
    for (const listItem of listHead.children){
        listItem.dataset.set = "0";
    }
}

function fncInsertFile(resJson, last, msgPos, msgNeg, checkItems){
    for (const listItem of resJson.arr){
        let itmAfter = null;
        let itmNew = null;
        if (!last && !listItem.before){itmAfter = document.getElementById(listItem.before);}
        const strHtml = `
        <div class="listItem grayLink" id="${listItem.id}">
            <input class="listItemChkbox listItemCol" type="checkbox"><!-
            ><div class="listOwnerImg listItemCol"><img class="listItemCol ownerImg" src="${listItem.ownerImg}" width="30" height="30" style="display:none"></div><!-
            ><div class="listOwner listItemCol">${listItem.ownerName}</div><!-
            ><div class="listItemText listItemCol">${listItem.text}  <div class="itemBookmark listItemCol" data-bookmarked="${listItem.bookmarked}"><img src="/graphics/toolbars/bookmark.png" width="15" height="15"></div></div><!-
            ><div class="listProfile listItemCol">${listItem.shared}</div><!-
            ><div class="listDateShared listItemCol">${listItem.dateShared}</div><!-
            ><div class="listDate listItemCol">${listItem.date}</div>
        </div>
        `;
        if (!itmAfter){
            if (lblLoadMore.parentNode){
                lblLoadMore.insertAdjacentHTML("beforebegin", strHtml)
            } else {
                list.insertAdjacentHTML("beforeend", strHtml);
            }
            itmNew = list.children[list.children.length - 2];
        } else {
            itmAfter.insertAdjacentHTML("beforebegin", strHtml);
            itmNew = itmAfter.nextSibling;
        }
        itmNew.firstElementChild.checked = checkItems;
        itmNew.addEventListener("click", function(event){
            const listChkbox = itmNew.firstElementChild;
            if (event.target !== listChkbox){
                for (const tmpListItem of list.children){
                    tmpListItem.children[0].checked = false;
                }
                listChkbox.checked = true;
            }    
        });
        numItemCnt++;
    }
    if (resJson.deleteArr){
        for (const listItem of resJson.deleteArr){
            try{
                document.getElementById(listItem).remove();
                itemCnt--;
            } catch {
                continue;
            }
        }
    }
    fncPrintCnt();

    if (resJson.failed){
        if (resJson.failed.reason){
            return resJson.failed;
        } else if (resJson.failed.length > 0){
            return msgPos;
        } else {
            return msgNeg;   
        }
    }
}

function fncClearList(){
    while (list.children.length){
        list.children[0].remove();
    }
    list.appendChild(lblLoadMore);
}

async function fncLoadMore(){
    lblLoadMore.childNodes[2].textContent = "추가 로드 중입니다...";
    lblLoadMore.dataset.isbutton = "false"
    let idCurLast = "loadmore";
    if (list.children.length !== 1){
        idCurLast = list.children[list.children.length - 2].id;
    }
    await doFetch(`./loadmore?sort=${sortMode.criteria}&sortincr=${sortMode.incr}&startafter=` + idCurLast, "GET", "", "", "추가 로드에 실패했습니다.", async function(result){
        let resJson = await result.json();
        fncInsertFile(resJson, true, "", "", lblLoadMore.firstElementChild.checked);
        fncPrintCnt();
        if (resJson.loadMore === "false") {
            lblLoadMore.remove();
        }
        return "";
    });
    lblLoadMore.childNodes[2].textContent = "추가 로드"
    lblLoadMore.dataset.isbutton = "true"
}

fncLoadMore();

function fncRefresh(){
    fncClearList();
    fncLoadMore();
}

document.addEventListener("scroll", async function(){
    if (lblLoadMore.parentNode && (lblLoadMore.dataset.isbutton === "true") && (document.body.scrollHeight - 45 - lblLoadMore.scrollHeight <= window.innerHeight + window.scrollY)){
        fncLoadMore();
    }
});

lblLoadMore.addEventListener("click", function(event){
    if (event.target.dataset.isbutton === "true"){
        fncLoadMore();
    }
})

{
    let tlbItem = document.getElementById("rename");
    tlbItem.addEventListener("click", function(){
        let newNickname = prompt("수정할 닉네임을 입력해 주십시오.", lblNickname.innerText);
        if (!newNickname){
            return;
        }
        doFetch("./update", "PUT", JSON.stringify({action: "rename", id: lblID.innerText, newname: newNickname}),
            "닉네임 변경이 완료되었습니다.", "닉네임 변경에 실패했습니다.", function(){
                lblNickname.innerText = newNickname;
                return "";
            })
    })
}

{
    let tlbItem = document.getElementById("refresh");
    tlbItem.addEventListener("click", fncRefresh);
}

{
    let tlbItem = document.getElementById("unshare");
    tlbItem.addEventListener("click", function(){
        let arrSelFiles = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                arrSelFiles.push(listItem.id);
            }
        }
        if (!arrSelFiles.length){
            showMessage("파일이 선택되지 않았습니다.");
            return;
        }
        if (!confirm("공유를 취소하시겠습니까?")){
            return;
        }
        doFetch("./update", "PUT", JSON.stringify({action: "unshare", files: arrSelFiles, friend: lblID, sort: sortMode}),
            "공유가 취소되었습니다.", "공유 취소를 실패했습니다.", async function(result){
                const resJson = await result.json();
                for (listItem of resJson.arr){
                    try{
                        document.getElementById(listItem).remove();
                        itemCnt--;
                    } catch {
                        continue;
                    }
                }
                fncPrintCnt();
                if (resJson.failed.reason){
                    return resJson.failed;
                } else if (resJson.failed.length > 0){
                    return "공유 취소에 실패한 항목이 있습니다."
                } else {
                    return "공유 취소가 완료되었습니다.";
                }
            });
    });
}

{
    let tlbItem = document.getElementById("topShare");
    tlbItem.addEventListener("click", function(){
        divPopup.style.display = "block";
        doFetch("./list?select=sepall", "GET", "", "", "파일 목록을 불러올 수 없었습니다.", async function(result){
            const optCopy = divPopup.appendChild(document.createElement("input"));
            optCopy.type = "radio";
            optCopy.checked = true;
            let lblNew = divPopup.appendChild(document.createElement("label"));
            lblNew.innerText = "사본 전달";
            lblNew.addEventListener("click", function(){optCopy.checked = true;});

            const optShareRead = divPopup.appendChild(document.createElement("input"));
            optShareRead.type = "raido";
            lblNew = divPopup.appendChild(document.createElement("label"));
            lblNew.innerText = "읽기 권한 공유";
            lblNew.addeventListner("click", function(){optShareRead.checked = true;});

            const optShareEdit = divPopup.appendChild(document.cretaeElement("input"));
            optShareEdit.type = "radio";
            lblNew = divPopup.appendChild(document.createElement("label"));
            lblNew.innerText = "편집 권한 공유";
            lblNew.addeventListner("click", function(){optShareEdit.checked = true;});
            lblNew = null;
            
            const txtPath = divPopup.appendChild(document.createElement("div"));
            const lstDir = divPopup.appendChild(document.createElement("select"));
            const lstFiles = divPopup.appendChild(document.createElement("select"));
            lstFiles.multiple = true;
            let cmdOK = null, cmdCancel = null;
            divPopup.appendChild(cmdOK = document.createElement("button"));
            cmdOK.innerText = "확인";
            divPopup.appendChild(cmdCancel = document.createElement("button"));
            cmdCancel.innerText = "취소";
            cmdCancel.addEventListener("click", fncClearPopup);

            const resJson = await result.json();
            txtPath.innerText = resJson.path;
            for (const listItem of resJson.dirarr){
                const ctlOption = lstDir.appendChild(document.createElement("option"));
                ctlOption.innerText = `${listItem.name}`;
            }
            for (const listItem of resJson.filearr){
                const ctlOption = lstFiles.appendChild(document.createElement("option"));
                ctlOption.innerText = `${listItem.name}`;
            }
            cmdOK.addEventListener("click", function(){
                if (!lstFiles.value){
                    showMessage("선택된 파일이 없습니다.")
                    return;
                }
                let shareMode = null;
                if (optCopy.checked){shareMode = "copy"} else if (optShareRead) {shareMode = "read"} else {shareMode = "edit"} 

                let jsonBody = {action: "share", mode: shareMode, sort: sortMode, files: arrSelFiles, fromPath: lstDir.value, file: lstFiles.value};
                doFetch("./update", "POST", JSON.stringify(jsonBody), "", "공유를 실패했습니다.",
                    async function(result){
                        const resJson = await result.json();
                        fncClearPopup();
                        return fncInsertFile(resJson, false, "공유가 완료되었습니다.", "공유되지 못한 파일이 있습니다.");
                    }
                ), fncClearPopup});
        }, fncClearPopup);
    })
}

{
    let colItem = document.getElementById("removeFriend");
    colItem.addEventListener("click", async function(){
        if (!confirm("정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.")){
            return;
        }
        await doFetch("./update", "DELETE", JSON.stringify({sort: sortMode, files: [lblID.innerText]}), 
        "", "삭제에 오류가 발생했습니다.", async function(result){
            const resJson = await result.json();
            if (resJson.failed.reason){
                return resJson.failed;
            } else if ((resJson.arr.length !== 1) || (resJson.failed.length > 0)){
                return "친구 최소에 실패했습니다."
            } else {
                document.location.href = "/friends"
                alert("친구가 취소되었습니다.");
                return "";
            }
        });
    })
}

{
    let colItem = document.getElementById("colOwner");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "owner"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "owner";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}

{
    let colItem = document.getElementById("colName");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "name"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "name";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}

{
    let colItem = document.getElementById("colDateShared");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "dateShared"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "dateShared";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}

{
    let colItem = document.getElementById("colDate");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "date"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "date";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}