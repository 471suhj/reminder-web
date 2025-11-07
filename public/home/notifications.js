import {doFetch} from "/printmsg.js"

const list = document.getElementsByClassName("list")[0];
const lblItemCnt = document.getElementById("newItemCount");

let unreadCnt = 0;
let itemCnt = Number(lblItemCnt.dataset.itemcnt);
const printItemCnt = function(printNew){
    if (printNew){
        if (unreadCnt){
            lblItemCnt.innerText = `${unreadCnt}개의 새 알림이 있습니다.\n`;
        } else{
            lblItemCnt.innerText = "새 알림이 없습니다.\n";
        }
    } else {
        lblItemCnt.innerText = "";
    }
    lblItemCnt.innerText += `총 ${itemCnt}개의 알림이 있습니다. 알림은 최근 100개만 저장됩니다.`;
}

for (const listItem of list.children){
    listItem.addEventListener("click", function(event){
        const listChkbox = listItem.firstElementChild;
        if (event.target !== listChkbox){
            listChkbox.checked = !listChkbox.checked;
        }    
    });    
    if (listItem.dataset.unread === "true"){
        unreadCnt++;
    }    
}    

printItemCnt(true);

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
            doFetch("./notifications/update", "DELETE", JSON.stringify(lstDeleteName), 
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
                printItemCnt(false);
            });
        }
        if (resJson.failed.length > 0){
            return "삭제에 실패한 항목이 있습니다.";
        } else {
            return "삭제가 완료되었습니다.";
        }
    });
}

{
    let tlbItem = document.getElementById("deleteAll");
    tlbItem.addEventListener("click", async function(){
        doFetch("./notifications/deleteAll", "PUT", "", "삭제가 완료되었습니다.", "삭제에 오류가 발생했습니다.", function(){
            if (!result.ok){
                throw new Error(`result error: ${result.status}`);
            }
            for (let i = list.children.length - 1; i >= 0; i--){
                try{
                    list.children[i].remove();
                } catch {}
            }
            itemCnt = 0;
            printItemCnt(false);
            document.getElementById("loadMore").remove();
        });
    });
}

{
    let cmdLoadMore = document.getElementById("loadMore");
    cmdLoadMore.addEventListener("click", async function(event){
        if (cmdLoadMore.dataset.enabled === "false"){ // never test for "true". may be undefined
            return;
        } else {
            cmdLoadMore.dataset.enabled = "false";
        }
        await doFetch("./notifications/loadMore", "GET", "", "", "로드 과정에 오류가 발생했습니다.", async function(result){
            let resJson = await result.json();
            for (const newItem of resJson.arr){
                let newListItem = null;
                let newChk = null, newLbl = null, newDiv = null;
                list.appendChild(newListItem = document.createElement("div"));
                newListItem.appendChild(newChk = document.createElement("input"));
                newListItem.appendChild(newLbl = document.createElement("label"));
                newListItem.appendChild(newDiv = document.createElement("div"));
                newListItem.setAttribute("class", "listItem grayLink");
                newListItem.setAttribute("id", newItem.id);
                newListItem.setAttribute("data-unread", newItem.unread);
                newListItem.addEventListener("click", function(event){
                    const listChkbox = newListItem.firstElementChild;
                    if (event.target !== listChkbox){
                        listChkbox.checked = !listChkbox.checked;
                    }    
                });
                newChk.setAttribute("type", "checkbox");
                newLbl.setAttribute("class", "listItemChk");
                newLbl.setAttribute("for", newItem.id);
                newLbl.innerText = "  " + newItem.date;
                newDiv.setAttribute("class", "listItemText");
                newDiv.innerText = "\n" + newItem.text;
            }
            if (resJson.loadMore === "false"){
                document.getElementById("loadMore").remove();
            }
            printItemCnt(false);
            return "";
        });
        cmdLoadMore.dataset.enabled = "true";
    });
}