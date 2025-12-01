import {doFetch} from '/printmsg.js';

export function fncRefresh(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path){
    fncClearList(lblLoadMore);
    fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path);
}

export function fncClearList(lblLoadMore){
    list.appendChild(lblLoadMore);
    while (list.children.length > 1){
        list.children[0].remove();
    }
}

export async function fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path){
    lblLoadMore.childNodes[2].textContent = '추가 로드 중입니다...';
    lblLoadMore.dataset.isbutton = 'false'
    let idCurLast = 'loadmore';
    if (list.children.length !== 1){
        idCurLast = list.children[list.children.length - 2].id;
    }
    await doFetch(`./loadmore?path=${path}&sort=${sortMode.criteria}&sortincr=${sortMode.incr}&startafter=` + idCurLast, 'GET', '', '', '추가 로드에 실패했습니다.', async function(result){
        let jsnRes = await result.json();
        fncInsertFile(jsnRes, true, '', '', lblLoadMore.firstElementChild.checked);
        fncPrintCnt();
        if (jsnRes.loadMore === false) {
            lblLoadMore.style.display = 'none';
            document.body.appendChild(lblLoadMore);
        }
        return '';
    });
    lblLoadMore.childNodes[2].textContent = '추가 로드'
    lblLoadMore.dataset.isbutton = 'true'
}

export function fncAutoloadSetup(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path){
    lblLoadMore.addEventListener('click', function(event){
        if (event.target.dataset.isbutton === 'true'){
            fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path);
        }
    });

    document.addEventListener('scroll', async function(){
        if (lblLoadMore.parentNode && (lblLoadMore.dataset.isbutton === 'true') && (document.body.scrollHeight - 45 - lblLoadMore.scrollHeight <= window.innerHeight + window.scrollY)){
            fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path);
        }
    });

    document.getElementById('refresh').addEventListener('click', () => {fncRefresh(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path);});

    fncLoadMore(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, path);
}

