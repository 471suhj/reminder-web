import {doFetch} from '/printmsg.js';
import {sortMode} from '/sortmode.js'
const list = document.getElementById('list');
const lblLoadMore = document.getElementById('loadMore');

export let sortMode = {criteria: 'colName', incr: true};


export function fncRefresh(fncInsertFile, fncPrintCnt, dirid){
    fncClearList();
    fncLoadMore(fncInsertFile, fncPrintCnt, dirid);
}

export function fncClearList(){
    list.appendChild(lblLoadMore);
    while (list.children.length > 1){
        list.children[0].remove();
    }
}

export async function fncLoadMore(fncInsertFile, fncPrintCnt, dirid){
    lblLoadMore.childNodes[2].textContent = '추가 로드 중입니다...';
    lblLoadMore.dataset.isbutton = 'false'
	const lblTitle = document.getElementById('title');
    let idCurLast = {id: '0', timestamp: '2000-01-01T00:00:00.000Z'};
    if (list.children.length !== 1){
        idCurLast.id = list.children[list.children.length - 2].dataset.id;
		idCurLast.timestamp = list.children[list.children.length - 2].dataset.timestamp;
    }
	let strLink = `/files/loadmore?dirid=${dirid}&lastrenamed=${lblTitle.dataset.timestamp}`;
	strLink += `&sort=${sortMode.criteria}&sortincr=${sortMode.incr}&startafter=${idCurLast.id}&startaftertimestamp=${idCurLast.timestamp}`;
    await doFetch(strLink, 'GET', '', '', '추가 로드에 실패했습니다.', async function(result){
        let jsnRes = await result.json();
		if (jsnRes.needReload){
			location.reload();
			return;
		if (jsnRes.needRefresh){
			document.getElementById('refresh').click();
			return;
		}
        await fncInsertFile(jsnRes, true, '', '', lblLoadMore.firstElementChild.checked);
        fncPrintCnt();
        if (jsnRes.loadMore === false) {
            lblLoadMore.style.display = 'none';
            document.body.appendChild(lblLoadMore);
        }
		if (jsnRes.lastItem !== -1){
			lblLoadMore.dataset.lastitem = jsnRes.lastItem;
			lblLoadMore.dataset.lasttimestamp = jsnRes.lastItemTimestamp;
		}
        return;
    });
    lblLoadMore.childNodes[2].textContent = '추가 로드'
    lblLoadMore.dataset.isbutton = 'true'
}

export function fncAutoloadSetup(fncInsertFile, fncPrintCnt, dirid){
    lblLoadMore.addEventListener('click', function(event){
        if (event.target.dataset.isbutton === 'true'){
            fncLoadMore(fncInsertFile, fncPrintCnt, dirid);
        }
    });

    document.addEventListener('scroll', async function(){
        if (lblLoadMore.parentNode && (lblLoadMore.dataset.isbutton === 'true') && (document.body.scrollHeight - 45 - lblLoadMore.scrollHeight <= window.innerHeight + window.scrollY)){
            fncLoadMore(fncInsertFile, fncPrintCnt, dirid);
        }
    });

    document.getElementById('refresh').addEventListener('click', () => {fncRefresh(fncInsertFile, fncPrintCnt, dirid);});

    fncLoadMore(fncInsertFile, fncPrintCnt, dirid);
}

export function fncResort(colName, colItem, fncResetSort, listHead, fncInsertFile, fncPrintCnt, dirid){
    if (sortMode.criteria === colName){
        sortMode.incr = !sortMode.incr;
        colItem.dataset.set = sortMode.incr ? '1' : '2';
    } else {
        sortMode.criteria = colName;
        sortMode.incr = true;
        fncResetSort(listHead);
        colItem.dataset.set = '1';
    }
    fncRefresh(list, sortMode, fncInsertFile, fncPrintCnt, dirid);
}

export function fncResetSort(listHead){
    for (const listItem of listHead.children){
        listItem.dataset.set = '0';
    }
}

export function fncSetupHeaderSort(listHead, fncInsertFile, fncPrintCnt, dirid){
    const colLink = document.getElementsByClassName('colLink');
    for (const colItem of colLink){
        colItem.addEventListener('click', function(event){
            fncResort(event.target.id, colItem, fncResetSort, listHead, fncInsertFile, fncPrintCnt, dirid);
        });
    }
}
