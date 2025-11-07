import {doFetch, showMessage} from "/printmsg.js"

let sortMode = {criteria: "name", incr: true};
const list = document.getElementById("list");
const lblItemCnt = document.getElementById("itemCount");
const lblLoadMore = document.getElementById("loadMore");
const divPopup = document.getElementById("popup");
const dlgOverwrite = document.getElementById("overwriteDlg");
let numItemCnt = 0;

const txtRename = document.createElement("input");
txtRename.setAttribute("type", "text");
txtRename.style.display = "none";
async function fncRename(){
    const newName = txtRename.value;
    const itemId = txtRename.dataset.itemId;
    txtRename.style.display = "none";
    if (newName !== ""){
        doFetch("./update", "PUT", JSON.stringify({action: "rename", sort: sortMode, id: itemId, name: newName}),
    "", `${newName}로 이름 바꾸기를 실패했습니다.`, function(){
        document.getElementById(itemId).childNodes[1].innerText = newName + " ";
        return "";
    })
    }
}
txtRename.addEventListener("focusout", fncRename);
txtRename.addEventListener("keyup", async function(event){
    if (event.key === "Enter"){
        fncRename(event);
    }
})

function fncClearPopup(){
    while (divPopup.children.length){
        divPopup.children[0].remove();
    }
    divPopup.style.display = "none";
}
divPopup.addEventListener("blur", fncClearPopup);

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + "개의 항목"
}

function fncInsertFile(resJson, last, msgPos, msgNeg, checkItems){
    for (const listItem of resJson.arr){
        let itmAfter = null;
        let itmNew = null;
        if (!last && !listItem.before){itmAfter = document.getElementById(listItem.before);}
        if (!itmAfter){
            const strHtml = `
            <div class="listItem grayLink" id="${listItem.id}">
                <input class="listItemChkbox listItemCol" type="checkbox"><!-
                ><div class="listItemType listItemCol"><img class="listItemCol isFolder" src="/graphics/toolbars/folder.png" width="15" height="15" data-visible="${listItem.isFolder}"></div><!-
                ><div class="listItemText listItemCol">${listItem.text}  <div class="itemBookmark listItemCol" data-bookmarked="${listItem.bookmarked}"><img src="/graphics/toolbars/bookmark.png" width="15" height="15"></div></div><!-
                ><div class="listProfile listItemCol">.</div><!-
                ><div class="listDate listItemCol">.${listItem.date}</div>
            </div>`;
            if (lblLoadMore.parentNode){
                lblLoadMore.insertAdjacentHTML("beforebegin", strHtml)
            } else {
                list.insertAdjacentHTML("beforeend", strHtml);
            }
            itmNew = list.children[list.children.length - 2];
        } else {
            itmAfter.insertAdjacentHTML("beforebegin", `
            <div class="listItem grayLink" id="${listItem.id}">
                <input class="listItemChkbox listItemCol" type="checkbox"><!-
                ><div class="listItemType listItemCol"><img class="listItemCol" src="/graphics/toolbars/folder.png" width="15" height="15" style="${listItem.folderDisplay}"></div><!-
                ><div class="listItemText listItemCol">${listItem.text}  <div class="itemBookmark listItemCol" data-bookmarked="${listItem.bookmarked}"><img src="/graphics/toolbars/bookmark.png" width="15" height="15"></div></div><!-
                ><div class="listProfile listItemCol">.</div><!-
                ><div class="listDate listItemCol">.${listItem.date}</div>
            </div>
            `);
            itmNew = itmAfter.nextSibling;
        }
        const divBookmark = itmNew.children[2].firstElementChild;
        const imgBookmark = divBookmark.firstElementChild;
        itmNew.firstElementChild.checked = checkItems;
        itmNew.addEventListener("click", function(event){
            const listChkbox = itmNew.firstElementChild;
            if (event.target !== listChkbox && event.target !== imgBookmark){
                for (const tmpListItem of list.children){
                    tmpListItem.children[0].checked = false;
                }
                listChkbox.checked = true;
            }    
        });
        divBookmark.addEventListener("click", async function(){
            let remove = false;
            if (divBookmark.dataset.bookmarked === "true"){
                remove = true;
            }
            doFetch("./update", "PUT", JSON.stringify({action: "bookmark", id: itmNew.getAttribute("id"), remove: remove}),
            "", "처리에 실패했습니다.", async function(result){
                const resJson = result.json();
                if (resJson.failed){
                    return "처리에 실패했습니다."
                }
                if (remove){
                    divBookmark.dataset.bookmarked = "false";
                    imgBookmark.style.display = "none";
                } else {
                    divBookmark.dataset.bookmarked = "true";
                    imgBookmark.style.display = "block";
                }
                return "";
            });
        });
        divBookmark.addEventListener("mouseenter", function(){
            imgBookmark.style.display = "block";
        })
        divBookmark.addEventListener("mouseleave", function(){
            if (divBookmark.dataset.bookmarked === "false"){
                imgBookmark.style.display = "none";
            }
        })
        if (divBookmark.dataset.bookmarked === "false"){
            imgBookmark.style.display = "none";
        }
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
        if (resJson.failed.length > 0){
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

async function fncCopyMove(mode, msgPos, msgNegAll, msgNegPart){
    divPopup.style.display = "block";
    let arrSelFiles = [];
    for (const listItem of list.children){
        if (listItem.firstElementChild.checked){
            arrSelFiles.push(listItem.id);
        }
    }
    if (!arrSelFiles.length){
        showMessage("파일이 선택되지 않았습니다.");
        fncClearPopup();
        return;
    }
    doFetch("./list?select=folders", "GET", "", "", "폴더 목록을 불러올 수 없었습니다.", async function(result){
        const txtPath = divPopup.appendChild(document.createElement("div"));
        const lstDir = divPopup.appendChild(document.createElement("select"));
        let cmdOK = null, cmdCancel = null;
        divPopup.appendChild(cmdOK = document.createElement("button"));
        cmdOK.innerText = "확인";
        divPopup.appendChild(cmdCancel = document.createElement("button"));
        cmdCancel.innerText = "취소";
        cmdCancel.addEventListener("click", fncClearPopup);

        const resJson = await result.json();
        txtPath.innerText = resJson.path;
        for (const listItem of resJson.arr){
            const ctlOption = null;
            lstDir.appendChild(ctlOption = document.createElement("option"));
            ctlOption.innerText = `${listItem.name})`;
        }
        cmdOK.addEventListener("click", function(){
            if (!lstDir.value){
                showMessage("선택된 폴더가 없습니다.")
                return;
            }
            let jsonBody = {action: mode, sort: sortMode, files: arrSelFiles, topath: lstDir.value};
            doFetch("./update", "POST", JSON.stringify(jsonBody), "",
                "복사에 실패했습니다.", async function(result){
                    const resJson = await result.json();
                    if (resJson.alreadyExists){
                        let btnDlg = document.getElementById("buttonoverwrite");
                        btnDlg.onclick = async function(){
                            btnDlg.close();
                            jsonBody.overwrite = "overwrite";
                            doFetch("./update", "POST", JSON.stringify(jsonBody), "", msgNegAll, async function(result){
                                const jsonNew = await result.json();
                                return fncInsertFile(jsonNew, false, msgPos, msgNegPart);
                            })
                        }
                        btnDlg = document.getElementById("buttonrename");
                        btnDlg.onclick = async function(){
                            btnDlg.close();
                            jsonBody.overwrite = "rename";
                            doFetch("./update", "POST", JSON.stringify(jsonBody), "", msgNegAll, async function(result){
                                const jsonNew = await result.json();
                                return fncInsertFile(jsonNew, false, msgPos, msgNegPart);
                            })
                        }
                        btnDlg = document.getElementById("buttonCancel");
                        btnDlg.onclick = function(){btnDlg.close();}
                        dlgOverwrite.showModal();
                        fncClearPopup();
                        return "";
                    } else {
                        fncClearPopup();
                        return fncInsertFile(resJson, false, msgPos, msgNegPart);
                    }
                }
            ), fncClearPopup});
    }, fncClearPopup);
    
}

for (const listItem of list.children){
    if (listItem === list.lastElementChild){
        continue;
    }
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
    let tlbItem = document.getElementById("selectAll");
    tlbItem.addEventListener("click", function(){
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
    let tlbItem = document.getElementById("upload");
    tlbItem.addEventListener("click", function(){
        divPopup.style.display = "block";
        let ctlFile = divPopup.appendChild(document.createElement("input"));
        ctlFile.setAttribute("type", "file");
        ctlFile.setAttribute("multiple", "true");
        ctlFile.setAttribute("accept", ".rmb");
        
        let lstFriends = divPopup.appendChild(document.createElement("button"));
        lstFriends.innerText = "확인"
        

        lstFriends.addEventListener("click", async function(){
            const addedFile = ctlFile.files; // must come before removing
            fncClearPopup();
            let jsonBody = {action: "upload", sort: sortMode, files: addedFile};
            doFetch("./update", "POST", JSON.stringify(jsonBody), "", "파일 업로드를 실패했습니다.", async function(result){
                const resJson = await result.json(addedFile);
                if (resJson.alreadyExists){
                    let btnDlg = document.getElementById("buttonoverwrite");
                    btnDlg.onclick = async function(){
                        btnDlg.close();
                        jsonBody.overwrite = "overwrite";
                        doFetch("./update", "POST", JSON.stringify(jsonBody), "", "파일 업로드를 실패했습니다.", async function(result){
                            const jsonNew = await result.json();
                            return fncInsertFile(jsonNew, false, "업로드를 완료했습니다.", "업로드에 실패한 파일이 있습니다.");
                        })
                    }
                    btnDlg = document.getElementById("buttonrename");
                    btnDlg.onclick = async function(){
                        btnDlg.close();
                        jsonBody.overwrite = "rename";
                        doFetch("./update", "POST", JSON.stringify(jsonBody), "", "파일 업로드를 실패했습니다.", async function(result){
                            const jsonNew = await result.json();
                            return fncInsertFile(jsonNew, false, "업로드를 완료했습니다.", "업로드에 실패한 파일이 있습니다.");
                        })
                    }
                    btnDlg = document.getElementById("buttonCancel");
                    btnDlg.onclick = function(){btnDlg.close();}
                    dlgOverwrite.showModal();
                    return "";
                }
                return fncInsertFile(resJson, false, "업로드를 완료했습니다.", "업로드에 실패한 파일이 있습니다.");
            });
        })
        
        lstFriends = divPopup.appendChild(document.createElement("button"));
        lstFriends.innerText = "취소"
        lstFriends.addEventListener("click", fncClearPopup);
    });
}
{
    let tlbItem = document.getElementById("download");
    tlbItem.addEventListener("click", function(){
        open("./download", "_blank", "popup=true");
    });
}
{
    let tlbItem = document.getElementById("rename");
    tlbItem.addEventListener("click", function(){
        let divSelected = null;
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                if (divSelected){
                    showMessage("한 개의 항목만 선택해 주십시오.")
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
            txtRename.dataset.itemId = divSelected.id;
            txtRename.style.display = "inline";
            txtRename.focus();
        }
    });
}
{
    let tlbItem = document.getElementById("delete");
    tlbItem.addEventListener("click", async function(){
        const lstDeleteName = [];
        const lstDelete = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(listItem.id);
                lstDelete.push(listItem);
            }
        }
        if (lstDeleteName.length > 0){
            doFetch("./update", "DELETE", JSON.stringify({action: "selected", sort: sortMode, files: lstDeleteName}), 
            "", "삭제에 오류가 발생했습니다.", async function(result){
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
                if (resJson.failed.length > 0){
                    return "삭제에 실패한 항목이 있습니다."
                } else {
                    return "삭제가 완료되었습니다.";
                }
            });
        }
    });
}
{
    let tlbItem = document.getElementById("share");
    tlbItem.addEventListener("click", async function(){
        divPopup.style.display = "block";
        let arrSelFiles = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                arrSelFiles.push(listItem.id);
            }
        }
        if (!arrSelFiles.length){
            showMessage("파일이 선택되지 않았습니다.");
            fncClearPopup();
            return;
        }
        doFetch("/friends/list", "GET", "", "", "친구 목록을 불러올 수 없었습니다.", async function(result){
            const txtSearch = divPopup.appendChild(document.createElement("input"));
            txtSearch.type = "text";
            const lstFriends = divPopup.appendChild(document.createElement("select"));
            lstFriends.setAttribute("multiple", "true");
            let cmdOK = null, cmdCancel = null;
            divPopup.appendChild(cmdOK = document.createElement("button"));
            cmdOK.innerText = "확인";
            divPopup.appendChild(cmdCancel = document.createElement("button"));
            cmdCancel.innerText = "취소";
            cmdCancel.addEventListener("click", fncClearPopup);
            
            const resJson = await result.json();
            for (const listItem of resJson.arr){
                const ctlOption = null;
                lstFriends.appendChild(ctlOption = document.createElement("option"));
                ctlOption.innerText = `${listItem.name} (${listItem.id})`;
                ctlOption.dataset.userid = listItem.id;
            }
            txtSearch.addEventListener("keydown", function(event){
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
            cmdOK.addEventListener("click", function(event){
                if (!lstFriends.value){
                    showMessage("선택된 친구가 없습니다.")
                    return;
                }
                doFetch("./update", "PUT", JSON.stringify({action: "share", files: arrSelFiles, friends: lstFriends.value}), "",
                    "공유에 실패했습니다.", async function(result){
                        const resJson = result.json();
                        for (const listItem of resJson.arr){
                            document.getElementById(listItem.id).children[3].innerText = listItem.friends;
                        }
                        fncClearPopup();
                        if (resJson.failed.length > 0){
                            return "공유에 실패한 항목이 있었습니다.";
                        } else {
                            return "공유가 완료되었습니다.";
                        }
                    }
                ), fncClearPopup});

        }, fncClearPopup);
    });
}

{
    let tlbItem = document.getElementById("copy");
    tlbItem.addEventListener("click", function(){
        fncCopyMove("copy");
    });
}
{
    let tlbItem = document.getElementById("move");
    tlbItem.addEventListener("click", function(){
        fncCopyMove("move");
    });
}
{
    let tlbItem = document.getElementById("createDir");
    tlbItem.addEventListener("click", function(){
        let strName = prompt("폴더의 이름을 입력하십시오.", "");
        if (strName){
            doFetch("./update", "PUT", JSON.stringify({action: "createDir", sort: sortMode, name: strName}), "", "파일 추가에 실패했습니다.", async function(result){
                const resJson = await result.json();
                return fncInsertFile(resJson, false, "", "폴더 추가에 실패했습니다.");
            })
        }
    });
}{
    let tlbItem = document.getElementById("createFile");
    tlbItem.addEventListener("click", function(){
        let strName = prompt("파일의 이름을 입력하십시오.", "");
        if (strName){
            doFetch("./update", "PUT", JSON.stringify({action: "createFile", sort: sortMode, name: strName}), "", "파일 추가에 실패했습니다.", async function(result){
                const resJson = await result.json();
                return fncInsertFile(resJson, false, "", "파일 추가에 실패했습니다.");
            })
        }
    });
}

{
    let tlbItem = document.getElementById("refresh");
    tlbItem.addEventListener("click", fncRefresh);
}

{
    let colItem = document.getElementById("colName");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "name"){
            sortMode.incr = !sortMode.incr;
        } else {
            sortMode.criteria = "name";
            sortMode.incr = true;
        }
        fncRefresh();
    })
}
{
    let colItem = document.getElementById("colDate");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "date"){
            sortMode.incr = !sortMode.incr;
        } else {
            sortMode.criteria = "date";
            sortMode.incr = true;
        }
        fncRefresh();
    })
}