import {doFetch, showMessage} from "/printmsg.js"

const list = document.getElementsByClassName("list")[0];
const lblItemCnt = document.getElementById("itemCount");
let itemCnt = Number(lblItemCnt.dataset.itemcnt);
const txtRename = document.createElement("input");
txtRename.setAttribute("type", "text");
txtRename.style.display = "none";
txtRename.addEventListener("keyup", async function(event){
    if (event.key === "Enter"){
        const newName = txtRename.value;
        const itemId = txtRename.dataset.itemId;
        txtRename.style.display = "none";
        if (newName !== ""){
            doFetch("./rename", "PUT", JSON.stringify({id: itemId, name: newName}),
        "", `${newName}로 이름 바꾸기를 실패했습니다.`, function(){
            document.getElementById(itemId).innerText = newName + " ";
        })
        }
    }
})

for (const listItem of list.children){
    const divBookmark = listItem.children[1].firstElementChild;
    const imgBookmark = divBookmark.firstElementChild;
    listItem.addEventListener("click", function(event){
        const listChkbox = listItem.firstElementChild;
        if (event.target !== listChkbox && event.target !== imgBookmark){
            for (const tmpListItem of list.children){
                tmpListItem.firstElementChild.checked = false;
            }
            listChkbox.checked = true;
        }    
    });
    divBookmark.addEventListener("click", async function(){
        let remove = false;
        if (divBookmark.dataset.bookmarked === "true"){
            remove = true;
        }
        doFetch("./changebookmark", "PUT", JSON.stringify({id: listItem.getAttribute("id"), remove: remove}),
        "", "처리에 실패했습니다.", function(result){
            if (remove){
                divBookmark.dataset.bookmarked = "false";
                imgBookmark.style.display = "none";
            } else {
                divBookmark.dataset.bookmarked = "true";
                imgBookmark.style.display = "block";
            }
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
    let tlbItem = document.getElementById("upload");
    tlbItem.addEventListener("click", function(){
        open("./upload", "_blank", "popup=true");
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
            txtRename.value = divSelected.children[1].innerText.trim();
            divSelected.children[1].appendChild(txtRename);
            txtRename.dataset.itemId = divSelected.id;
            txtRename.style.display = "inline";
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
            doFetch("./deleteItem", "PUT", JSON.stringify(lstDeleteName), 
            "삭제가 완료되었습니다.", "삭제에 오류가 발생했습니다.", function(){
                for (listItem of lstDelete){
                    listItem.remove();
                }
                itemCnt -= lstDeleteName.length;
                printItemCnt(false);
            });
        }
    });
}
{
    let tlbItem = document.getElementById("share");
    tlbItem.addEventListener("click", function(){
        open("./share", "_blank", "popup=true");
    });
}
{
    let tlbItem = document.getElementById("move");
    tlbItem.addEventListener("click", function(){
        open("./share", "_blank", "popup=true");
    });
}
{
    let tlbItem = document.getElementById("copy");
    tlbItem.addEventListener("click", function(){
        open("./share", "_blank", "popup=true");
    });
}
