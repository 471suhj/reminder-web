import {doFetch, showMessage} from "/printmsg.js"
import {sortMode, fncSetupHeaderSort} from "/sortmode.js"
import {insertOpt, fncClearPopup} from "/popup.js"
import {fncRefresh, fncAutoloadSetup} from "/autoload.js"
import {fncCopyMove, fncRemoveItems, fncAddItems, fncAnswerDlg, fncCreateOKCancel} from "/filemove.js"

const list = document.getElementById("list");
const listHead = document.getElementById("listHead");
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
        doFetch("", "PUT", JSON.stringify({action: "rename", sort: sortMode, id: itemId, name: newName}),
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

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + "개의 항목"
}

function fncInsertFile(jsnRes, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class="listItem grayLink" id="${listItem.id}">
        <input class="listItemChkbox listItemCol" type="checkbox"><!-
        ><div class="listItemType listItemCol"><img class="listItemCol isFolder" src="/graphics/toolbars/folder.png" width="15" height="15" data-visible="${listItem.isFolder}"></div><!-
        ><div class="listItemText listItemCol">${listItem.text}  <div class="itemBookmark listItemCol" data-bookmarked="${listItem.bookmarked}"><img src="/graphics/toolbars/bookmark.png" width="15" height="15"></div></div><!-
        ><div class="listProfile listItemCol">${listItem.shared}</div><!-
        ><div class="listDate listItemCol">${listItem.date}</div>
        </div>`;
    }
    fncAddItems(jsnRes, last, msgPos, msgNeg, checkItems, list, strHtml, true, 2, lblLoadMore, numItemCnt, fncPrintCnt);
}

fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);

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
        
        const cmdOK = fncCreateOKCancel(divPopup);
        
        cmdOK.addEventListener("click", async function(){
            const addedFile = ctlFile.files; // must come before removing
            let jsonBody = {action: "upload", sort: sortMode, files: addedFile};
            fncClearPopup(divPopup);
            doFetch("", "POST", JSON.stringify(jsonBody), "", "파일 업로드를 실패했습니다.", async function(result){
                const jsnRes = await result.json(addedFile);
                if (jsnRes.alreadyExists){
                    fncAnswerDlg("업로드를 완료했습니다.", "파일 업로드를 실패했습니다.", "업로드에 실패한 파일이 있습니다.", dlgOverwrite);
                    return "";
                }
                return fncInsertFile(jsnRes, false, "업로드를 완료했습니다.", "업로드에 실패한 파일이 있습니다.");
            });
        })
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
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(listItem.id);
            }
        }
        if (lstDeleteName.length > 0){
            doFetch("", "DELETE", JSON.stringify({action: "selected", sort: sortMode, files: lstDeleteName}), 
            "", "삭제에 오류가 발생했습니다.", async function(result){
                const jsnRes = await result.json();
                return fncRemoveItems(jsnRes, fncPrintCnt, "삭제에 실패한 항목이 있습니다.", "삭제가 완료되었습니다.");
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
            fncClearPopup(divPopup);
            return;
        }
        doFetch("/friends/list", "GET", "", "", "친구 목록을 불러올 수 없었습니다.", async function(result){
            const {optCopy, optShareRead} = insertOpt(divPopup, document);

            const txtSearch = divPopup.appendChild(document.createElement("input"));
            txtSearch.type = "text";
            txtSearch.placeholder = "검색";
            const lstFriends = divPopup.appendChild(document.createElement("select"));
            lstFriends.setAttribute("multiple", "true");

            const txtMessage = divPopup.appendChild(document.createElement("textarea"));

            const cmdOK = fncCreateOKCancel(divPopup);
            
            const jsnRes = await result.json();
            for (const listItem of jsnRes.arr){
                const ctlOption = lstFriends.appendChild(document.createElement("option"));
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
                let shareMode = null;
                if (optCopy.checked){shareMode = "copy"} else if (optShareRead) {shareMode = "read"} else {shareMode = "edit"} 
                const jsonBody = {action: "share", files: arrSelFiles, mode: shareMode, message: txtMessage.value, friends: lstFriends.value};
                fncClearPopup(divPopup);
                doFetch("", "PUT", JSON.stringify(jsonBody), "",
                    "공유에 실패했습니다.", async function(result){
                        const jsnRes = result.json();
                        for (const listItem of jsnRes.arr){
                            document.getElementById(listItem.id).children[3].innerText = listItem.friends;
                        }
                        if (jsnRes.failed.reason){
                            return jsnRes.failed;
                        } else if (jsnRes.failed.length > 0){
                            return "공유에 실패한 항목이 있었습니다.";
                        } else {
                            return "공유가 완료되었습니다.";
                        }
                });
            }, () => {fncClearPopup(divPopup);});
        });
    })
}

{
    let tlbItem = document.getElementById("copy");
    tlbItem.addEventListener("click", function(){
        fncCopyMove("copy", "복사를 완료했습니다.", "복사를 실패했습니다.", "복사되지 못한 파일이 있습니다.", divPopup, list, dlgOverwrite);
    });
}
{
    let tlbItem = document.getElementById("move");
    tlbItem.addEventListener("click", function(){
        fncCopyMove("move", "이동을 완료했습니다.", "이동을 실패했습니다.", "이동되지 못한 파일이 있습니다.", divPopup, list, dlgOverwrite);
    });
}
{
    let tlbItem = document.getElementById("createDir");
    tlbItem.addEventListener("click", function(){
        let strName = prompt("폴더의 이름을 입력하십시오.", "");
        if (strName){
            doFetch("", "PUT", JSON.stringify({action: "createDir", sort: sortMode, name: strName}), "", "파일 추가에 실패했습니다.", async function(result){
                const jsnRes = await result.json();
                return fncInsertFile(jsnRes, false, "", "폴더 추가에 실패했습니다.");
            })
        }
    });
}{
    let tlbItem = document.getElementById("createFile");
    tlbItem.addEventListener("click", function(){
        let strName = prompt("파일의 이름을 입력하십시오.", "");
        if (strName){
            doFetch("", "PUT", JSON.stringify({action: "createFile", sort: sortMode, name: strName}), "", "파일 추가에 실패했습니다.", async function(result){
                const jsnRes = await result.json();
                return fncInsertFile(jsnRes, false, "", "파일 추가에 실패했습니다.");
            })
        }
    });
}

fncSetupHeaderSort(fncRefresh, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt);