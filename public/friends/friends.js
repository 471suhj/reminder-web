import {doFetch, showMessage} from "/printmsg.js"

let sortMode = {criteria: "name", incr: true};
const list = document.getElementById("list");
const lblItemCnt = document.getElementById("itemCount");
const lblLoadMore = document.getElementById("loadMore");
const tlbSort = document.getElementById("tlbSort");
let numItemCnt = 0;

function fncPrintCnt(){
    lblItemCnt.textContent = String(numItemCnt) + "개의 항목"
}

function fncResetSort(){
    for (const listItem of tlbSort.children){
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
            <input class="listItemChkbox" type="checkbox">
            <div class="listBlock">
                <img src="${listItem.profileimg}" width="25" height="25"><!-
                ><div class="listItemText listItemCol">${listItem.nickname}</div><div class="listItemCol listSpecs">(${listItem.name})</div><!-
                ><div class="listSpecs">${listItem.userid}</div><!-
                ><div class="listSpecs">${listItem.sharedFiles}</div>
            </div>
        </div>`;
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
        itmNew.addEventListener("dblclick", function(){
            window.location.href = listItem.link;
        })
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
    let tlbItem = document.getElementById("upload");
    tlbItem.addEventListener("click", function(){
        const friendID = prompt("추가할 친구의 ID를 입력하십시오.");
        if (!friendID){
            return;
        }
        doFetch("./update", "PUT", JSON.stringify({action: "add", id: friendID}), "", "친구 추가를 실패했습니다.",
        async function(result){
            return fncInsertFile(await result.json(), false, "친구 추가를 완료했습니다.", "친구 추가를 실패했습니다.");
        });
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
        if (!divSelected){
            return;
        }
        const newName = prompt(`${divSelected.children[1].children[2].innerText.slice(1, -1)}의 새 닉네임을 입력해 주세요.`, divSelected.children[1].children[1].innerText);
        doFetch("./update", "PUT", JSON.stringify({action: "rename", id: divSelected.children[1].children[3].innerText, newname: newName}),
            "닉네임 변경이 완료되었습니다.", "닉네임 변경을 실패했습니다.", function(){
                divSelected.children[1].children[1].innerText = newName;
                return "";
            })
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
        if ((lstDeleteName.length <= 0) || !confirm("정말로 친구를 취소하시겠습니까? 모든 파일들의 공유가 취소됩니다.")){
            return;
        }
        doFetch("./update", "DELETE", JSON.stringify({sort: sortMode, files: lstDeleteName}), 
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
            if (resJson.failed.reason){
                return resJson.failed;
            } else if (resJson.failed.length > 0){
                return "삭제에 실패한 항목이 있습니다."
            } else {
                return "삭제가 완료되었습니다.";
            }
        });
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
{
    let colItem = document.getElementById("colFreq");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "freq"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "freq";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}
{
    let colItem = document.getElementById("colAdded");
    colItem.addEventListener("click", function(){
        if (sortMode.criteria === "added"){
            sortMode.incr = !sortMode.incr;
            colItem.dataset.set = sortMode.incr ? "1" : "2";
        } else {
            sortMode.criteria = "added";
            sortMode.incr = true;
            fncResetSort();
            colItem.dataset.set = "1";
        }
        fncRefresh();
    })
}