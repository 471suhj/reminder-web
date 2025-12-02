export let sortMode = {criteria: 'colName', incr: true};

export function fncResort(colName, colItem, fncRefresh, fncResetSort, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt, dirid){
    if (sortMode.criteria === colName){
        sortMode.incr = !sortMode.incr;
        colItem.dataset.set = sortMode.incr ? '1' : '2';
    } else {
        sortMode.criteria = colName;
        sortMode.incr = true;
        fncResetSort(listHead);
        colItem.dataset.set = '1';
    }
    fncRefresh(lblLoadMore, list, sortMode, fncInsertFile, fncPrintCnt, dirid);
}

export function fncResetSort(listHead){
    for (const listItem of listHead.children){
        listItem.dataset.set = '0';
    }
}

export function fncSetupHeaderSort(fncRefresh, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt, dirid){
    const colLink = document.getElementsByClassName('colLink');
    for (const colItem of colLink){
        colItem.addEventListener('click', function(event){
            fncResort(event.target.id, colItem, fncRefresh, fncResetSort, listHead, lblLoadMore, list, fncInsertFile, fncPrintCnt, dirid);
        });
    }
}
