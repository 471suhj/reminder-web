import {doFetch} from "/printmsg.js"

export function fncRefresh(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt){
    fncClearList(lblLoadMore);
    fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);
}

export function fncClearList(lblLoadMore){
    while (list.children.length){
        list.children[0].remove();
    }
    list.appendChild(lblLoadMore);
}

export async function fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt){
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

export function fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt){
    lblLoadMore.addEventListener("click", function(event){
        if (event.target.dataset.isbutton === "true"){
            fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);
        }
    });

    document.addEventListener("scroll", async function(){
        if (lblLoadMore.parentNode && (lblLoadMore.dataset.isbutton === "true") && (document.body.scrollHeight - 45 - lblLoadMore.scrollHeight <= window.innerHeight + window.scrollY)){
            fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);
        }
    });

    document.getElementById("refresh").addEventListener("click", () => {fncRefresh(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);});

    fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt);
}

