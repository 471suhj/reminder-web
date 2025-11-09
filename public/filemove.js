import {fncClearPopup} from "/popup.js"
import {doFetch} from "/printmsg.js"

export async function fncRemoveItems(resJson, fncPrintCnt, msgNeg, msgPos){
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
        return msgNeg;
    } else {
        return msgPos;
    }
}

export function fncAddItems(resJson, last, msgPos, msgNeg, checkItems, list, strHtml, includeBookmark, childLoc, lblLoadMore, numItemCnt, fncPrintCnt){
    for (const listItem of resJson.arr){
        let itmAfter = null;
        let itmNew = null;
        if (!last && !listItem.before){itmAfter = document.getElementById(listItem.before);}
        if (!itmAfter){
            if (lblLoadMore.parentNode){
                lblLoadMore.insertAdjacentHTML("beforebegin", strHtml(listItem))
            } else {
                list.insertAdjacentHTML("beforeend", strHtml(listItem));
            }
            itmNew = list.children[list.children.length - 2];
        } else {
            itmAfter.insertAdjacentHTML("beforebegin", strHtml(listItem));
            itmNew = itmAfter.nextSibling;
        }

        let imgBookmark = null;
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
        itmNew.addEventListener("dblclick", function(){
            window.location.href = listItem.link;
        })
        numItemCnt++;
        if (!includeBookmark){
            continue;
        }
        const divBookmark = itmNew.children[childLoc].firstElementChild;
        imgBookmark = divBookmark.firstElementChild;
        divBookmark.addEventListener("click", async function(){
            let action = "PUT";
            if (divBookmark.dataset.bookmarked === "true"){
                action = "DELETE";
            }
            doFetch("", action, JSON.stringify({action: "bookmark", id: itmNew.getAttribute("id")}),
            "", "처리에 실패했습니다.", async function(result){
                const resJson = result.json();
                if (resJson.failed){
                    return "처리에 실패했습니다."
                }
                if (action === "DELETE"){
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
    }

    resJson.arr = resJson.deleteArr;
    fncRemoveItems(resJson, fncPrintCnt, msgNeg, msgPos)
}

export function fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite){
    btnDlg = document.getElementById("buttonrename");
    btnDlg.onclick = async function(event){
        btnDlg.close();
        jsonBody.overwrite = event.target.id;
        doFetch("", "POST", JSON.stringify(jsonBody), "", msgNegAll, async function(result){
            const jsonNew = await result.json();
            return fncInsertFile(jsonNew, false, msgPos, msgNegPart);
        })
    }
    dlgOverwrite.showModal();
}

export function fncCreateOKCancel(divPopup){
    const cmdOK = divPopup.appendChild(document.createElement("button"));
    cmdOK.innerText = "확인";
    const cmdCancel = divPopup.appendChild(document.createElement("button"));
    cmdCancel.innerText = "취소";
    cmdCancel.addEventListener("click", () => {fncClearPopup(divPopup);});
    return cmdOK;
}

export function fncCopyMove(mode, msgPos, msgNegAll, msgNegPart, divPopup, list, dlgOverwrite){
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
    doFetch("./list?select=folders", "GET", "", "", "폴더 목록을 불러올 수 없었습니다.", async function(result){
        const txtPath = divPopup.appendChild(document.createElement("div"));
        const lstDir = divPopup.appendChild(document.createElement("select"));
        lstDir.multiple = true;
        const cmdOK = fncCreateOKCancel(divPopup);

        const resJson = await result.json();
        txtPath.innerText = resJson.path;
        for (const listItem of resJson.arr){
            const ctlOption = lstDir.appendChild(document.createElement("option"));
            ctlOption.innerText = `${listItem.name}`;
        }
        cmdOK.addEventListener("click", function(){
            if (!lstDir.value){
                showMessage("선택된 폴더가 없습니다.")
                return;
            }
            let jsonBody = {action: mode, sort: sortMode, files: arrSelFiles, topath: lstDir.value};
            fncClearPopup(divPopup);
            doFetch("", "POST", JSON.stringify(jsonBody), "",
                msgNegAll, async function(result){
                    const resJson = await result.json();
                    if (resJson.alreadyExists){
                        fncAnswerDlg(msgPos, msgNegAll, msgNegPart, dlgOverwrite);
                        return "";
                    } else {
                        return fncInsertFile(resJson, false, msgPos, msgNegPart);
                    }
                });
            });
    }, () => {fncClearPopup(divPopup);});
    
}
