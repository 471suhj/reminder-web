import {doFetch, showMessage} from "/printmsg.js"
import {sortMode, fncSetupHeaderSort} from "/sortmode.js"
import {fncRefresh, fncAutoloadSetup} from "/autoload.js"
import {fncAddItems} from "/filemove.js"

const list = document.getElementById("list");
const listHead = document.getElementById("listHead");
const lblItemCnt = document.getElementById("itemCount");
const lblLoadMore = document.getElementById("loadMore");
let numItemCnt = 0;

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + "개의 항목"
}

function fncInsertFile(resJson, last, msgPos, msgNeg, checkItems){
    const strHtml = function(listItem){
        return `
        <div class="listItem grayLink" id="${listItem.id}">
            <input class="listItemChkbox listItemCol" type="checkbox"><!-
            ><div class="listItemType listItemCol"><img class="listItemCol isFolder" src="/graphics/toolbars/folder.png" width="15" height="15" style="display:none"></div><!-
            ><div class="listItemText listItemCol">${listItem.text}</div><!-
            ><div class="listPath listItemCol">${listItem.origPath}</div><!-
            ><div class="listDelDate listItemCol">${listItem.dateDeleted}</div><!-
            ><div class="listDate listItemCol">${listItem.date}</div>
        </div>`;
    }
    fncAddItems(resJson, last, msgPos, msgNeg, checkItems, list, strHtml, false, 2, lblLoadMore, numItemCnt, fncPrintCnt);
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
                const resJson = await result.json();
                fncRemoveItems(resJson, fncPrintCnt, "삭제에 실패한 항목이 있습니다.", "삭제가 완료되었습니다.");
            });
        }
    });
}

{
    let tlbItem = document.getElementById("restore");
    tlbItem.addEventListener("click", async function(){
        const lstDeleteName = [];
        for (const listItem of list.children){
            if (listItem.firstElementChild.checked){
                lstDeleteName.push(listItem.id);
            }
        }
        if (lstDeleteName.length > 0){
            doFetch("", "PUT", JSON.stringify({action: "restore", sort: sortMode, files: lstDeleteName}), 
            "", "삭제에 오류가 발생했습니다.", async function(result){
                const resJson = await result.json();
                fncRemoveItems(resJson, fncPrintCnt, "복원에 실패한 항목이 있습니다.", "복원이 완료되었습니다.");
                if (resJson.alreadyExists){
                    alert("같은 파일명이 존재한 경우가 있었으며, 이 경우 파일명에 -2가 추가되었습니다.");
                }
            });
        }
    });
}

fncSetupHeaderSort(fncRefresh, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt);